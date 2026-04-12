import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/server/reading/**/*.spec.ts", "src/lib/**/*.spec.ts"],
  },
});
