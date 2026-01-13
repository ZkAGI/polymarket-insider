import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", "dist", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", ".next", "tests", "**/*.config.*"],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/api": path.resolve(__dirname, "./src/api"),
      "@/app": path.resolve(__dirname, "./app"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/utils": path.resolve(__dirname, "./src/utils"),
    },
  },
});
