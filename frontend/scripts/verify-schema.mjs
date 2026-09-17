#!/usr/bin/env node
/**
 * Deploy gate — schema parity and live-schema presence.
 *
 * Two production dashboard outages have had the same cause: application code was
 * deployed ahead of the database schema (migrations are applied by hand with
 * psql; nothing in the deploy pipeline runs or verifies them). Phase 17's
 * `placement_simulations` made it worse by being declared in `schema.ts` with no
 * migration file at all, so no amount of applying migrations could provision it.
 *
 * This gate makes both conditions fail the build:
 *
 *   1. STATIC — every table/enum `src/db/schema.ts` declares must be created by
 *      some `src/db/migrations/*.sql` file. Catches "declared but unshippable".
 *   2. LIVE — when `DATABASE_URL` is set, every declared table/enum must exist in
 *      that database, and no live table may be absent from the migration set.
 *      Catches "code deployed ahead of the schema" before the deploy ships.
 *
 * Runs with plain Node (no TypeScript, no extra dependencies) so it works in any
 * build environment. `npm run build` invokes it via the `prebuild` hook.
 *
 * Exit codes: 0 = ok (or live check skipped because the database is unreachable),
 *             1 = drift found — the message names the migration files to apply.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(projectRoot, "src", "db", "schema.ts");
const migrationsDir = path.join(projectRoot, "src", "db", "migrations");

const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

function fail(lines) {
  console.error(`\n${RED}✖ SCHEMA GATE FAILED${RESET}`);
  for (const line of lines) console.error(line);
  process.exit(1);
}

function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

/**
 * Minimal .env loader: `prebuild` runs as its own process, so Next.js has not
 * loaded .env.local yet. Values are only ever read into process.env — never
 * printed, logged, or included in any message this script emits.
 */
function loadEnvFiles() {
  for (const name of [".env.local", ".env.production.local", ".env"]) {
    const file = path.join(projectRoot, name);
    if (!fs.existsSync(file)) continue;
    for (const line of readFile(file).split("\n")) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue; // real environment wins
      const value = rawValue.replace(/^['"]|['"]$/g, "").trim();
      if (value) process.env[key] = value;
    }
  }
}

loadEnvFiles();

if (process.env.SKIP_SCHEMA_GATE === "true") {
  console.log(`${YELLOW}⚠ schema gate: skipped via SKIP_SCHEMA_GATE=true${RESET}\n`);
  process.exit(0);
}

function matchAll(source, pattern, group = 1) {
  const out = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let m;
  while ((m = re.exec(source)) !== null) out.push(m[group]);
  return out;
}

if (!fs.existsSync(schemaPath)) fail([`  schema.ts not found at ${schemaPath}`]);

const schemaSource = readFile(schemaPath);
const schemaTables = [...new Set(matchAll(schemaSource, /pgTable\(\s*"([a-z0-9_]+)"/i))].sort();
const schemaEnums = [...new Set(matchAll(schemaSource, /pgEnum\(\s*"([a-z0-9_]+)"/i))].sort();
const schemaIndexes = [...new Set(matchAll(schemaSource, /(?:uniqueIndex|index)\(\s*"([a-z0-9_]+)"/i))].sort();

if (schemaTables.length === 0) fail(["  parsed 0 tables from schema.ts — parser or schema format changed"]);

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** object name -> migration file that creates it */
const tableSource = new Map();
const enumSource = new Map();
const indexSource = new Map();

for (const file of migrationFiles) {
  const sql = readFile(path.join(migrationsDir, file));
  for (const name of matchAll(sql, /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:(?:"[a-z0-9_]+"|[a-z0-9_]+)\.)?"?([a-z0-9_]+)"?/i)) {
    if (!tableSource.has(name)) tableSource.set(name, file);
  }
  for (const name of matchAll(sql, /CREATE TYPE(?:\s+IF NOT EXISTS)?\s+(?:(?:"[a-z0-9_]+"|[a-z0-9_]+)\.)?"?([a-z0-9_]+)"?/i)) {
    if (!enumSource.has(name)) enumSource.set(name, file);
  }
  for (const name of matchAll(sql, /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF NOT EXISTS)?\s+(?:(?:"[a-z0-9_]+"|[a-z0-9_]+)\.)?"?([a-z0-9_]+)"?/i)) {
    if (!indexSource.has(name)) indexSource.set(name, file);
  }
}

console.log(`${DIM}[schema-gate]${RESET} schema.ts: ${schemaTables.length} tables, ${schemaEnums.length} enum types, ${schemaIndexes.length} indexes · ${migrationFiles.length} migration files`);

// ---------------------------------------------------------------------------
// 1. Static parity — anything declared must be creatable from migrations alone.
// ---------------------------------------------------------------------------
const tablesWithoutMigration = schemaTables.filter((t) => !tableSource.has(t));
const enumsWithoutMigration = schemaEnums.filter((e) => !enumSource.has(e));
const indexesWithoutMigration = schemaIndexes.filter((i) => !indexSource.has(i));

if (tablesWithoutMigration.length > 0 || enumsWithoutMigration.length > 0 || indexesWithoutMigration.length > 0) {
  const lines = [
    "",
    "  These objects are declared in src/db/schema.ts but NO migration file creates them,",
    "  so a database provisioned from src/db/migrations/*.sql (i.e. production) cannot have them:",
    "",
  ];
  for (const t of tablesWithoutMigration) lines.push(`    table: ${t}`);
  for (const e of enumsWithoutMigration) lines.push(`    type:  ${e}`);
  for (const i of indexesWithoutMigration) lines.push(`    index: ${i}`);
  lines.push(
    "",
    "  Fix: add a new, idempotent migration (CREATE TABLE IF NOT EXISTS / CREATE TYPE guarded",
    "  with a duplicate_object exception / CREATE INDEX IF NOT EXISTS) that creates them, register it in",
    "  src/db/migrations/meta/_journal.json, and apply it to every environment.",
    ""
  );
  fail(lines);
}

// ---------------------------------------------------------------------------
// 2. Live presence — only when a database is reachable.
// ---------------------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log(`${DIM}[schema-gate]${RESET} DATABASE_URL not set — live schema check skipped (static parity passed)`);
  console.log(`${GREEN}✓ schema gate passed${RESET} (static only)\n`);
  process.exit(0);
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 8000, max: 2 });

try {
  const [tablesResult, enumsResult, indexesResult] = await Promise.all([
    pool.query("select tablename from pg_tables where schemaname = 'public'"),
    pool.query(
      "select t.typname as name from pg_type t where t.typtype = 'e' and exists (select 1 from pg_enum e where e.enumtypid = t.oid)"
    ),
    pool.query("select indexname from pg_indexes where schemaname = 'public'"),
  ]);

  const liveTables = new Set(tablesResult.rows.map((r) => r.tablename));
  const liveEnums = new Set(enumsResult.rows.map((r) => r.name));
  const liveIndexes = new Set(indexesResult.rows.map((r) => r.indexname));

  const missingTables = schemaTables.filter((t) => !liveTables.has(t));
  const missingEnums = schemaEnums.filter((e) => !liveEnums.has(e));
  const missingIndexes = schemaIndexes.filter((i) => !liveIndexes.has(i));
  const unreproducible = [...liveTables].filter((t) => !tableSource.has(t)).sort();

  if (missingTables.length > 0 || missingEnums.length > 0 || missingIndexes.length > 0 || unreproducible.length > 0) {
    const neededMigrations = new Set();
    const lines = ["", "  The DATABASE_URL this build can reach does not match the deployed code:", ""];

    for (const t of missingTables) {
      const src = tableSource.get(t);
      lines.push(`    missing table: ${t}${src ? `  ← created by src/db/migrations/${src}` : ""}`);
      if (src) neededMigrations.add(src);
    }
    for (const e of missingEnums) {
      const src = enumSource.get(e);
      lines.push(`    missing type:  ${e}${src ? `  ← created by src/db/migrations/${src}` : ""}`);
      if (src) neededMigrations.add(src);
    }
    for (const i of missingIndexes) {
      const src = indexSource.get(i);
      lines.push(`    missing index: ${i}${src ? `  ← created by src/db/migrations/${src}` : ""}`);
      if (src) neededMigrations.add(src);
    }
    for (const t of unreproducible) {
      lines.push(`    live table with NO migration: ${t}  ← provisioned by db:push; add a migration`);
    }

    if (neededMigrations.size > 0) {
      lines.push("", "  Apply these migrations to the database BEFORE deploying (ascending order):", "");
      for (const m of [...neededMigrations].sort()) lines.push(`    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/db/migrations/${m}`);
      lines.push("", "  See PRODUCTION-MIGRATION-RUNBOOK.md. Never use drizzle-kit push on production.");
    }
    lines.push("");
    fail(lines);
  }

  console.log(
    `${GREEN}✓ schema gate passed${RESET} — ${schemaTables.length}/${schemaTables.length} tables, ${schemaEnums.length}/${schemaEnums.length} enum types, and ${schemaIndexes.length}/${schemaIndexes.length} indexes present in the database\n`
  );
} catch (error) {
  // A database this build cannot reach is NOT evidence of drift: warn, don't block.
  console.warn(
    `${YELLOW}⚠ schema gate: database unreachable — live schema check skipped${RESET}\n${DIM}  ${String(error?.message ?? error).split("\n")[0]}\n  Static parity passed; apply/verify migrations per PRODUCTION-MIGRATION-RUNBOOK.md.${RESET}\n`
  );
} finally {
  await pool.end().catch(() => undefined);
}
