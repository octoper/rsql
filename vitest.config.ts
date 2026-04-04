import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "ast",
          root: resolve(__dirname, "packages/ast"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
        },
      },
      {
        test: {
          name: "builder",
          root: resolve(__dirname, "packages/builder"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
        },
      },
      {
        test: {
          name: "emitter",
          root: resolve(__dirname, "packages/emitter"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
        },
      },
      {
        test: {
          name: "parser",
          root: resolve(__dirname, "packages/parser"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
        },
      },
    ],
  },
});
