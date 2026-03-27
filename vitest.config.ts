// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/audit/setup.ts"],
    include: ["tests/audit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/checkout/**", "src/lib/auth/**", "src/lib/credit/**"],
      reporter: ["text", "html"],
    },
  },
});
