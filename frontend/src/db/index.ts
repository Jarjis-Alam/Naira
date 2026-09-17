import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const isProduction = process.env.NODE_ENV === "production";
const connectionString = process.env.DATABASE_URL;

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build" ||
  process.env.BUILDING === "true";

if (isProduction && !connectionString && !isBuildPhase) {
  console.warn(
    "[db] Warning: DATABASE_URL is not set in production runtime environment."
  );
}

const pool = new pg.Pool({
  connectionString:
    connectionString || "postgresql://postgres@localhost:5432/placement_os",
  max: isProduction ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});

export const db = drizzle(pool, { schema });

export default db;
