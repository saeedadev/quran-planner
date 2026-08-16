import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["scratch/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", ".AGENTS/**"],
  },
});
