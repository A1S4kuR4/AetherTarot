/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { spawn } = require("node:child_process");

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE ??= "1";

const nextArgs = process.argv.slice(2);
const isDevelopmentServer = nextArgs[0] === "dev";
const isProductionServer = nextArgs[0] === "start";

if (isProductionServer) {
  process.env.HOSTNAME = "127.0.0.1";
}

if (isDevelopmentServer) {
  process.env.AETHERTAROT_LOCAL_ONLY ??= "1";

  if (process.env.AETHERTAROT_LOCAL_ONLY === "1") {
    process.env.AETHERTAROT_READING_PROVIDER = "placeholder";
    if (process.env.AETHERTAROT_LOCAL_ONLY_ENCYCLOPEDIA_UI === "1") {
      process.env.AETHERTAROT_ENCYCLOPEDIA_PROVIDER = "llm";
      process.env.AETHERTAROT_LLM_BASE_URL = "http://127.0.0.1:9/v1";
      process.env.AETHERTAROT_LLM_API_KEY = "";
    } else {
      process.env.AETHERTAROT_ENCYCLOPEDIA_PROVIDER = "disabled";
    }
    process.env.AUTH_SECRET ??= "aethertarot-local-only-development-secret";

    console.log(
      "[local-only] admin bypass enabled; Supabase and external LLM providers disabled.",
    );
  }
}

const nextBin = require.resolve("next/dist/bin/next");
const workspaceRoot = path.resolve(__dirname, "..");
const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
