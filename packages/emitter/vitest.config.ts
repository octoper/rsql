import { defineProject } from "vitest/config";
import { resolve } from "path";

export default defineProject({
  test: {
    name: "emitter",
    environment: "node",
    include: ["__tests__/**/*.spec.ts"],
    alias: {
      "rsql-ast": resolve(__dirname, "../ast/src"),
      "rsql-builder": resolve(__dirname, "../builder/src"),
      "rsql-emitter": resolve(__dirname, "src"),
      "rsql-parser": resolve(__dirname, "../parser/src"),
    },
  },
});
