import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts"],
      thresholds: {
        // The calculation engine must stay fully covered (acceptance criterion).
        "src/lib/engine/**/*.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
