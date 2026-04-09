/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE ??= "1";

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: process.cwd(),
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
