import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // `server-only` throws outside React Server Components; tests run server code directly.
    alias: {
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/env-setup.ts"],
          // One shared database: run files one after another.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/server/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts", "**/fixtures/**"],
      thresholds: {
        // The calculation engine must stay fully covered (acceptance criterion).
        "src/lib/engine/**/*.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
