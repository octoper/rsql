import { defineProject } from "vitest/config";
import { resolve } from "path";

export default defineProject({
  test: {
    name: "ast",
    environment: "node",
    include: ["__tests__/**/*.spec.ts"],
    alias: {
      "rsql-ast": resolve(__dirname, "src"),
    },
  },
});
