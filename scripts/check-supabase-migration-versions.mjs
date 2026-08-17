import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, "..");
const migrationsDirectory = "apps/web/supabase/migrations";
const migrationNamePattern = /^(\d{12})_.+\.sql$/;

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
