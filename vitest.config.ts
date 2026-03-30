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
          alias: {
            "rsql-ast": resolve(__dirname, "packages/ast/src"),
          },
        },
      },
      {
        test: {
          name: "builder",
          root: resolve(__dirname, "packages/builder"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
          alias: {
            "rsql-ast": resolve(__dirname, "packages/ast/src"),
            "rsql-builder": resolve(__dirname, "packages/builder/src"),
            "rsql-emitter": resolve(__dirname, "packages/emitter/src"),
          },
        },
      },
      {
        test: {
          name: "emitter",
          root: resolve(__dirname, "packages/emitter"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
          alias: {
            "rsql-ast": resolve(__dirname, "packages/ast/src"),
            "rsql-builder": resolve(__dirname, "packages/builder/src"),
            "rsql-emitter": resolve(__dirname, "packages/emitter/src"),
            "rsql-parser": resolve(__dirname, "packages/parser/src"),
          },
        },
      },
      {
        test: {
          name: "parser",
          root: resolve(__dirname, "packages/parser"),
          globals: true,
          environment: "node",
          include: ["__tests__/**/*.spec.ts"],
          alias: {
            "rsql-ast": resolve(__dirname, "packages/ast/src"),
            "rsql-parser": resolve(__dirname, "packages/parser/src"),
          },
        },
      },
    ],
  },
});
