import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, "..");
const migrationsDirectory = "apps/web/supabase/migrations";
const migrationNamePattern = /^(\d{12})_.+\.sql$/;
const requiredSafetyReviewerMigrations = new Map([
  ["202608130001_clear_initial_snapshot_continuity_context.sql", []],
  ["202608130002_safety_reviewer_token_budget.sql", []],
  ["202608130003_safety_reviewer_subject_rate_limit.sql", []],
  ["202608130004_safety_reviewer_retention.sql", [
    "public.safety_reviewer_token_reservations",
    "public.safety_reviewer_daily_token_usage",
    "public.safety_reviewer_subject_minute_usage",
  ]],
]);

export function collectSupabaseMigrationVersionChecks({
  repoRoot = defaultRepoRoot,
} = {}) {
  const migrationsPath = path.join(repoRoot, migrationsDirectory);
  if (!fs.existsSync(migrationsPath) || !fs.statSync(migrationsPath).isDirectory()) {
    return [fail(migrationsDirectory, "missing migrations directory")];
  }

  const migrations = fs.readdirSync(migrationsPath)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const versions = new Map();
  const checks = [];

  for (const migration of migrations) {
    const match = migrationNamePattern.exec(migration);
    if (!match) {
      checks.push(fail(migration, "must use a 12-digit version prefix"));
      continue;
    }

    const version = match[1];
    const existing = versions.get(version) ?? [];
    existing.push(migration);
    versions.set(version, existing);
  }

  for (const [version, files] of versions) {
    if (files.length > 1) {
      checks.push(fail(
        version,
        `duplicate migration version: ${files.join(", ")}`,
      ));
    }
  }

  for (const [migration, requiredFragments] of requiredSafetyReviewerMigrations) {
    const migrationPath = path.join(migrationsPath, migration);
    if (!fs.existsSync(migrationPath)) {
      checks.push(fail(migration, "required Safety Reviewer migration is missing"));
      continue;
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    for (const fragment of requiredFragments) {
      if (!sql.includes(fragment)) {
        checks.push(fail(
          migration,
          `required retention target is missing: ${fragment}`,
        ));
      }
    }
  }

  return checks.length > 0
    ? checks
    : [pass("all migration versions are unique")];
}

export function formatSupabaseMigrationVersionReport(checks) {
  return checks.map((check) =>
    `[${check.status === "pass" ? "PASS" : "FAIL"}] migration: ${check.name}${
      check.message ? `\n  ${check.message}` : ""
    }`
  ).join("\n");
}

function pass(name) {
  return { status: "pass", name, message: "" };
}

function fail(name, message) {
  return { status: "fail", name, message };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checks = collectSupabaseMigrationVersionChecks();
  console.log(formatSupabaseMigrationVersionReport(checks));
  if (checks.some((check) => check.status === "fail")) {
    process.exitCode = 1;
  }
}
