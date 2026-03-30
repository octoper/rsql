import { defineProject } from "vitest/config";
import { resolve } from "path";

export default defineProject({
  test: {
    name: "builder",
    environment: "node",
    include: ["__tests__/**/*.spec.ts"],
    alias: {
      "rsql-ast": resolve(__dirname, "../ast/src"),
      "rsql-builder": resolve(__dirname, "src"),
      "rsql-emitter": resolve(__dirname, "../emitter/src"),
    },
  },
});
