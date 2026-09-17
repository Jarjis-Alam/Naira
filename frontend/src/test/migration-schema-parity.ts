/**
 * Schema ↔ migration parity guard.
 *
 * Born from a production incident: Phase 17's `placement_simulations` and
 * `placement_simulation_rounds` (plus their three enum types) were declared in
 * `src/db/schema.ts` but never shipped as a migration — they only ever reached a
 * database through `drizzle-kit push`. Production is provisioned by applying
 * `src/db/migrations/*.sql`, so those relations did not exist there, and
 * `/dashboard` (which reads `placement_simulations` on every load) died with
 * `relation "placement_simulations" does not exist` → ERR_500_SYSTEM_FAULT.
 *
 * This suite makes that mistake impossible to repeat silently:
 *
 *  1. Static parity — every `pgTable` in schema.ts is created by some migration,
 *     every `pgEnum` is created by some migration.
 *  2. Database parity (when a DB is reachable) — every schema table exists in the
 *     live database, and no live table is missing from the migration set.
 *  3. Resilience contract — the dashboard's non-critical intelligence reads are
 *     wrapped so one failing widget cannot take down the whole page.
 *
 * Read-only: it inspects files and catalog views, and never writes.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

function resolveFromProject(...segments: string[]): string {
  const candidates = [
    path.join(process.cwd(), ...segments),
    path.join(process.cwd(), "frontend", ...segments),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not locate ${segments.join("/")} from ${process.cwd()}`);
}

const SCHEMA_PATH = resolveFromProject("src", "db", "schema.ts");
const MIGRATIONS_DIR = resolveFromProject("src", "db", "migrations");
const DASHBOARD_PATH = resolveFromProject(
  "src",
  "app",
  "(protected)",
  "dashboard",
  "page.tsx"
);

const schemaSource = fs.readFileSync(SCHEMA_PATH, "utf8");
const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migrationSource = migrationFiles
  .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");

function matchAll(source: string, pattern: RegExp, group = 1): string[] {
  const out: string[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(m[group]!);
  return out;
}

const schemaTables = [...new Set(matchAll(schemaSource, /pgTable\(\s*"([a-z0-9_]+)"/i))].sort();
const schemaEnums = [...new Set(matchAll(schemaSource, /pgEnum\(\s*"([a-z0-9_]+)"/i))].sort();
const migrationTables = [
  ...new Set(matchAll(migrationSource, /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z0-9_]+)"?/i)),
].sort();
const migrationEnums = [
  ...new Set(
    matchAll(
      migrationSource,
      // Migrations may qualify the type (`CREATE TYPE "public"."x" AS ENUM`).
      /CREATE TYPE(?:\s+IF NOT EXISTS)?\s+(?:(?:"[a-z0-9_]+"|[a-z0-9_]+)\.)?"?([a-z0-9_]+)"?/i
    )
  ),
].sort();

async function run() {
  console.log("🧪 Schema ↔ migration parity guard\n");

  // ==========================================================================
  console.log("--- 1. Static parity (schema.ts → migrations) ---");
  // ==========================================================================
  assert(schemaTables.length > 25, `schema.ts declares ${schemaTables.length} tables (sanity)`);

  const tablesWithoutMigration = schemaTables.filter((t) => !migrationTables.includes(t));
  assert(
    tablesWithoutMigration.length === 0,
    `every declared table is created by a migration (missing: ${tablesWithoutMigration.join(", ") || "none"})`
  );

  const enumsWithoutMigration = schemaEnums.filter((e) => !migrationEnums.includes(e));
  assert(
    enumsWithoutMigration.length === 0,
    `every declared enum type is created by a migration (missing: ${enumsWithoutMigration.join(", ") || "none"})`
  );

  // The exact incident: these must never lose their migration again.
  for (const table of ["placement_simulations", "placement_simulation_rounds"]) {
    assert(migrationTables.includes(table), `regression guard: ${table} is created by a migration`);
  }
  for (const enumType of ["simulation_status", "simulation_round_type", "simulation_round_status"]) {
    assert(migrationEnums.includes(enumType), `regression guard: enum ${enumType} is created by a migration`);
  }

  const phase17Migration = migrationFiles.find((f) => f.startsWith("0017"));
  assert(!!phase17Migration, "Phase 17 simulation schema ships as its own numbered migration");
  if (phase17Migration) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, phase17Migration), "utf8");
    assert(/CREATE TABLE IF NOT EXISTS/i.test(sql), "0017 creates tables idempotently (IF NOT EXISTS)");
    assert(/DUPLICATE_OBJECT/i.test(sql), "0017 creates enum types idempotently (duplicate_object guard)");
    assert(/CREATE INDEX IF NOT EXISTS/i.test(sql), "0017 creates indexes idempotently");
  }

  // ==========================================================================
  console.log("\n--- 2. Database parity (live DB → schema/migrations) ---");
  // ==========================================================================
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/placement_os";
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 4000 });
  let dbReachable = true;
  let liveTables: string[] = [];
  try {
    const result = await pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by 1"
    );
    liveTables = result.rows.map((r) => r.tablename);
  } catch {
    dbReachable = false;
  }

  if (!dbReachable) {
    console.log("  ⚠ SKIP: database unreachable — static parity above still applies");
  } else {
    const missingInDb = schemaTables.filter((t) => !liveTables.includes(t));
    assert(
      missingInDb.length === 0,
      `every schema table exists in the database (missing: ${missingInDb.join(", ") || "none"})`
    );

    // This is the condition that caused the production outage: a table that
    // exists in a working database but is created by no migration at all.
    const unreproducible = liveTables.filter(
      (t) => !migrationTables.includes(t) && !t.startsWith("drizzle")
    );
    assert(
      unreproducible.length === 0,
      `no live table is missing from the migration set (drift: ${unreproducible.join(", ") || "none"})`
    );

    const enumResult = await pool.query<{ typname: string }>(
      "select typname from pg_type t where t.typtype = 'e' and exists (select 1 from pg_enum e where e.enumtypid = t.oid)"
    );
    const liveEnums = enumResult.rows.map((r) => r.typname);
    const missingEnumsInDb = schemaEnums.filter((e) => !liveEnums.includes(e));
    assert(
      missingEnumsInDb.length === 0,
      `every schema enum exists in the database (missing: ${missingEnumsInDb.join(", ") || "none"})`
    );
  }
  await pool.end().catch(() => undefined);

  // ==========================================================================
  console.log("\n--- 3. Dashboard resilience contract ---");
  // ==========================================================================
  const dashboard = fs.readFileSync(DASHBOARD_PATH, "utf8");
  assert(
    /degradeOnFailure\(\s*"simulation history"/.test(dashboard),
    "dashboard degrades the simulation card instead of crashing the page"
  );
  assert(
    /degradeOnFailure\(\s*"resume health"/.test(dashboard) &&
      /degradeOnFailure\(\s*"application pipeline"/.test(dashboard) &&
      /degradeOnFailure\(\s*"outcome intelligence"/.test(dashboard),
    "dashboard degrades the other non-critical intelligence cards"
  );
  assert(
    /console\.error\(/.test(dashboard.split("degradeOnFailure")[1] ?? ""),
    "degraded reads are logged (failure visible, never concealed)"
  );
  const simulationReads = matchAll(dashboard, /getStudentSimulationHistory\(userId\)/g, 0);
  const guardedSimulationReads = matchAll(
    dashboard,
    /degradeOnFailure\(\s*"simulation history",\s*getStudentSimulationHistory\(userId\)/g,
    0
  );
  assert(
    simulationReads.length > 0 && simulationReads.length === guardedSimulationReads.length,
    `every simulation read in the dashboard is degraded (${guardedSimulationReads.length}/${simulationReads.length} wrapped)`
  );

  console.log(
    `\n${failed === 0 ? "✅" : "❌"} Schema/migration parity: ${passed} passed, ${failed} failed\n`
  );
  if (failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("PARITY SUITE CRASHED:", error);
  process.exitCode = 1;
});
