import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"], environment: "node", env: { NEXT_PUBLIC_DEMO_CLOCK: "2026-11-09T14:00:00Z" } },
});
