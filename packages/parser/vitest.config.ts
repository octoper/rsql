import { defineProject } from "vitest/config";
import { resolve } from "path";

export default defineProject({
  test: {
    name: "parser",
    environment: "node",
    include: ["__tests__/**/*.spec.ts"],
    alias: {
      "rsql-ast": resolve(__dirname, "../ast/src"),
      "rsql-parser": resolve(__dirname, "src"),
    },
  },
});
