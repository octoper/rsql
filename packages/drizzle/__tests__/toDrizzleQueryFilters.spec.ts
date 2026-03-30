import { describe, it, expect, vi } from "vitest";
import { parse } from "@resenty/rsql-parser";
import builder from "@resenty/rsql-builder";
import {
  toDrizzleQueryFilters,
  RsqlDrizzleError,
  UnknownSelectorError,
  UnknownTableError,
  UnknownColumnError,
  UnsupportedOperatorError,
  InvalidValueError,
} from "@resenty/rsql-drizzle";

describe("toDrizzleQueryFilters", () => {
  describe("comparison operators", () => {
    it("handles == (eq)", () => {
      const ast = parse("name==John");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name"] });
      expect(result).toEqual({ name: { eq: "John" } });
    });

    it("handles != (ne)", () => {
      const ast = parse("name!=John");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name"] });
      expect(result).toEqual({ name: { ne: "John" } });
    });

    it("handles < (lt)", () => {
      const ast = parse("age<30");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { lt: "30" } });
    });

    it("handles > (gt)", () => {
      const ast = parse("age>18");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { gt: "18" } });
    });

    it("handles <= (lte)", () => {
      const ast = parse("age<=65");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { lte: "65" } });
    });

    it("handles >= (gte)", () => {
      const ast = parse("age>=21");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { gte: "21" } });
    });
  });

  describe("verbose operator aliases", () => {
    it("handles =lt=", () => {
      const ast = parse("age=lt=30");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { lt: "30" } });
    });

    it("handles =le=", () => {
      const ast = parse("age=le=65");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { lte: "65" } });
    });

    it("handles =gt=", () => {
      const ast = parse("age=gt=18");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { gt: "18" } });
    });

    it("handles =ge=", () => {
      const ast = parse("age=ge=21");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"] });
      expect(result).toEqual({ age: { gte: "21" } });
    });
  });

  describe("array operators", () => {
    it("handles =in=", () => {
      const ast = parse("status=in=(active,inactive)");
      const result = toDrizzleQueryFilters(ast, { selectors: ["status"] });
      expect(result).toEqual({ status: { in: ["active", "inactive"] } });
    });

    it("handles =out=", () => {
      const ast = parse("status=out=(banned,deleted)");
      const result = toDrizzleQueryFilters(ast, { selectors: ["status"] });
      expect(result).toEqual({ status: { notIn: ["banned", "deleted"] } });
    });
  });

  describe("logic operators", () => {
    it("handles AND with ;", () => {
      const ast = parse("name==John;age>25");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name", "age"] });
      expect(result).toEqual({
        AND: [{ name: { eq: "John" } }, { age: { gt: "25" } }],
      });
    });

    it("handles OR with ,", () => {
      const ast = parse("name==John,name==Jane");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name"] });
      expect(result).toEqual({
        OR: [{ name: { eq: "John" } }, { name: { eq: "Jane" } }],
      });
    });

    it("handles verbose AND", () => {
      const ast = parse("name==John and age>25");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name", "age"] });
      expect(result).toEqual({
        AND: [{ name: { eq: "John" } }, { age: { gt: "25" } }],
      });
    });

    it("handles verbose OR", () => {
      const ast = parse("name==John or name==Jane");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name"] });
      expect(result).toEqual({
        OR: [{ name: { eq: "John" } }, { name: { eq: "Jane" } }],
      });
    });

    it("handles nested logic with grouping", () => {
      const ast = parse("(name==John,name==Jane);age>25");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name", "age"] });
      expect(result).toEqual({
        AND: [{ OR: [{ name: { eq: "John" } }, { name: { eq: "Jane" } }] }, { age: { gt: "25" } }],
      });
    });
  });

  describe("selector allowlist (string[])", () => {
    it("allows listed selectors", () => {
      const ast = parse("name==John");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name", "age"] });
      expect(result).toEqual({ name: { eq: "John" } });
    });

    it("rejects unlisted selectors", () => {
      const ast = parse("secret==value");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name"] })).toThrow(UnknownSelectorError);
    });
  });

  describe("selector mapping (Record<string, string>)", () => {
    it("maps selector to output key", () => {
      const ast = parse("userName==John");
      const result = toDrizzleQueryFilters(ast, { selectors: { userName: "name" } });
      expect(result).toEqual({ name: { eq: "John" } });
    });

    it("rejects unmapped selectors", () => {
      const ast = parse("secret==value");
      expect(() => toDrizzleQueryFilters(ast, { selectors: { name: "name" } })).toThrow(UnknownSelectorError);
    });
  });

  describe("tables with string[] columns", () => {
    it("resolves dotted selector via tables", () => {
      const ast = parse("user.name==John");
      const result = toDrizzleQueryFilters(ast, { tables: { user: ["name"] } });
      expect(result).toEqual({ user: { name: { eq: "John" } } });
    });

    it("resolves cross-table AND", () => {
      const ast = parse("user.name==John;post.title==Hello");
      const result = toDrizzleQueryFilters(ast, {
        tables: { user: ["name"], post: ["title"] },
      });
      expect(result).toEqual({
        AND: [{ user: { name: { eq: "John" } } }, { post: { title: { eq: "Hello" } } }],
      });
    });

    it("resolves cross-table OR", () => {
      const ast = parse("user.name==John,post.title==Hello");
      const result = toDrizzleQueryFilters(ast, {
        tables: { user: ["name"], post: ["title"] },
      });
      expect(result).toEqual({
        OR: [{ user: { name: { eq: "John" } } }, { post: { title: { eq: "Hello" } } }],
      });
    });
  });

  describe("tables with Record<string, string> column mapping", () => {
    it("maps column names in output", () => {
      const ast = parse("user.userName==John");
      const result = toDrizzleQueryFilters(ast, {
        tables: { user: { userName: "name" } },
      });
      expect(result).toEqual({ user: { name: { eq: "John" } } });
    });

    it("throws UnknownColumnError for unmapped column", () => {
      const ast = parse("user.secret==value");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: { name: "name" } } })).toThrow(UnknownColumnError);
    });
  });

  describe("tables + selectors coexistence", () => {
    it("resolves dotted selectors via tables and flat selectors via selectors", () => {
      const ast = parse("user.name==John;status==active");
      const result = toDrizzleQueryFilters(ast, {
        tables: { user: ["name"] },
        selectors: ["status"],
      });
      expect(result).toEqual({
        AND: [{ user: { name: { eq: "John" } } }, { status: { eq: "active" } }],
      });
    });

    it("tables takes precedence over selectors for dotted selectors", () => {
      const ast = parse("user.name==John");
      const result = toDrizzleQueryFilters(ast, {
        tables: { user: ["name"] },
        selectors: { "user.name": "userDotName" },
      });
      // Should use tables, not selectors
      expect(result).toEqual({ user: { name: { eq: "John" } } });
    });

    it("falls through to selectors when table is not found", () => {
      const ast = parse("user.name==John");
      const result = toDrizzleQueryFilters(ast, {
        tables: { post: ["title"] },
        selectors: ["user.name"],
      });
      expect(result).toEqual({ "user.name": { eq: "John" } });
    });
  });

  describe("custom operators", () => {
    it("handles custom operator with handler", () => {
      const ast = parse("name=like=Jo*");
      const result = toDrizzleQueryFilters(ast, {
        selectors: ["name"],
        customOperators: {
          "=like=": (value, _selector, _operator) => ({ like: value }),
        },
      });
      expect(result).toEqual({ name: { like: "Jo*" } });
    });

    it("passes correct arguments to custom handler", () => {
      const handler = vi.fn(() => ({ like: "Jo*" }));
      const ast = parse("name=like=Jo*");
      toDrizzleQueryFilters(ast, {
        selectors: ["name"],
        customOperators: { "=like=": handler },
      });
      expect(handler).toHaveBeenCalledWith("Jo*", "name", "=like=");
    });

    it("throws UnsupportedOperatorError for unregistered custom operator", () => {
      const ast = parse("name=like=Jo*");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name"] })).toThrow(UnsupportedOperatorError);
    });
  });

  describe("value coercion", () => {
    it("coerces values using the coerce callback", () => {
      const coerce = vi.fn((value: string, selector: string) => {
        if (selector === "age") return Number(value);
        return value;
      });

      const ast = parse("age>25");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"], coerce });

      expect(coerce).toHaveBeenCalledWith("25", "age", ">");
      expect(result).toEqual({ age: { gt: 25 } });
    });

    it("coerces array values for =in= operator", () => {
      const coerce = vi.fn((value: string, selector: string) => {
        if (selector === "age") return Number(value);
        return value;
      });

      const ast = parse("age=in=(25,30,35)");
      const result = toDrizzleQueryFilters(ast, { selectors: ["age"], coerce });

      expect(coerce).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ age: { in: [25, 30, 35] } });
    });

    it("coerce receives full dotted selector for tables", () => {
      const coerce = vi.fn((value: string) => value);
      const ast = parse("user.name==John");
      toDrizzleQueryFilters(ast, {
        tables: { user: ["name"] },
        coerce,
      });
      expect(coerce).toHaveBeenCalledWith("John", "user.name", "==");
    });
  });

  describe("error handling", () => {
    it("throws RsqlDrizzleError if neither selectors nor tables is provided", () => {
      const ast = parse("name==John");
      expect(() => toDrizzleQueryFilters(ast, {} as any)).toThrow(RsqlDrizzleError);
    });

    it("throws UnknownSelectorError for unmapped selector", () => {
      const ast = parse("unknown==value");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name"] })).toThrow(UnknownSelectorError);
    });

    it("throws UnsupportedOperatorError for unregistered custom operator", () => {
      const ast = parse("name=like=Jo*");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name"] })).toThrow(UnsupportedOperatorError);
    });

    it("throws InvalidValueError for =in= with non-array value", () => {
      const ast = builder.comparison("status", "=in=", "active");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["status"] })).toThrow(InvalidValueError);
    });

    it("throws UnknownTableError for unknown table", () => {
      const ast = parse("foo.bar==x");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownTableError);
    });

    it("throws UnknownColumnError for unknown column in known table", () => {
      const ast = parse("user.unknown==x");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownColumnError);
    });
  });

  describe("builder-constructed ASTs", () => {
    it("works with builder-constructed comparison", () => {
      const ast = builder.comparison("name", "==", "John");
      const result = toDrizzleQueryFilters(ast, { selectors: ["name"] });
      expect(result).toEqual({ name: { eq: "John" } });
    });

    it("works with builder-constructed logic", () => {
      const ast = builder.and(builder.comparison("name", "==", "John"), builder.comparison("age", ">", "25"));
      const result = toDrizzleQueryFilters(ast, { selectors: ["name", "age"] });
      expect(result).toEqual({
        AND: [{ name: { eq: "John" } }, { age: { gt: "25" } }],
      });
    });
  });

  describe("security", () => {
    it("rejects unmapped selectors in nested expressions", () => {
      const ast = parse("name==John;secret==value");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name"] })).toThrow(UnknownSelectorError);
    });

    it("rejects non-dotted selector with tables only", () => {
      const ast = parse("status==active");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownSelectorError);
    });

    it("rejects unmapped selector even when deeply nested in logic", () => {
      const ast = parse("(name==John;age>20),(name==Jane;secret==x)");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name", "age"] })).toThrow(UnknownSelectorError);
    });

    it("rejects every branch of a complex OR when one selector is unmapped", () => {
      const ast = parse("name==John,secret==value,age>25");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["name", "age"] })).toThrow(UnknownSelectorError);
    });

    it("rejects dotted selector that targets an unknown table", () => {
      const ast = parse("admin.password==secret");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownTableError);
    });

    it("rejects unknown column within a known table (string[] format)", () => {
      const ast = parse("user.password==secret");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownColumnError);
    });

    it("rejects unknown column within a known table (Record format)", () => {
      const ast = parse("user.password==secret");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: { name: "name" } } })).toThrow(UnknownColumnError);
    });

    // Prototype pollution: selectors
    it("rejects __proto__ as a selector", () => {
      const ast = parse("__proto__==polluted");
      expect(() => toDrizzleQueryFilters(ast, { selectors: { name: "name" } })).toThrow(UnknownSelectorError);
    });

    it("rejects constructor as a selector", () => {
      const ast = parse("constructor==polluted");
      expect(() => toDrizzleQueryFilters(ast, { selectors: { name: "name" } })).toThrow(UnknownSelectorError);
    });

    it("rejects toString as a selector", () => {
      const ast = parse("toString==polluted");
      expect(() => toDrizzleQueryFilters(ast, { selectors: { name: "name" } })).toThrow(UnknownSelectorError);
    });

    it("rejects hasOwnProperty as a selector", () => {
      const ast = parse("hasOwnProperty==polluted");
      expect(() => toDrizzleQueryFilters(ast, { selectors: { name: "name" } })).toThrow(UnknownSelectorError);
    });

    it("rejects valueOf as a selector", () => {
      const ast = parse("valueOf==polluted");
      expect(() => toDrizzleQueryFilters(ast, { selectors: { name: "name" } })).toThrow(UnknownSelectorError);
    });

    // Prototype pollution: table names
    it("rejects __proto__ as a table name in dotted selector", () => {
      const ast = parse("__proto__.name==polluted");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownTableError);
    });

    it("rejects constructor as a table name in dotted selector", () => {
      const ast = parse("constructor.name==polluted");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownTableError);
    });

    it("rejects prototype as a table name in dotted selector", () => {
      const ast = parse("prototype.name==polluted");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: ["name"] } })).toThrow(UnknownTableError);
    });

    // Prototype pollution: column names in Record-based tables
    it("rejects __proto__ as a column in a known table (Record format)", () => {
      const ast = parse("user.__proto__==polluted");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: { name: "name" } } })).toThrow(UnknownColumnError);
    });

    it("rejects constructor as a column in a known table (Record format)", () => {
      const ast = parse("user.constructor==polluted");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: { name: "name" } } })).toThrow(UnknownColumnError);
    });

    it("rejects toString as a column in a known table (Record format)", () => {
      const ast = parse("user.toString==polluted");
      expect(() => toDrizzleQueryFilters(ast, { tables: { user: { name: "name" } } })).toThrow(UnknownColumnError);
    });

    // Custom operator security
    it("custom operators still require the selector to be mapped", () => {
      const ast = parse("secret=like=value");
      expect(() =>
        toDrizzleQueryFilters(ast, {
          selectors: ["name"],
          customOperators: { "=like=": (value) => ({ like: value }) },
        }),
      ).toThrow(UnknownSelectorError);
    });

    it("empty customOperators object does not match inherited properties", () => {
      const ast = parse("name=custom=value");
      expect(() =>
        toDrizzleQueryFilters(ast, {
          selectors: ["name"],
          customOperators: {},
        }),
      ).toThrow(UnsupportedOperatorError);
    });

    // Value-shape validation
    it("throws InvalidValueError for =out= with non-array value", () => {
      const ast = builder.comparison("status", "=out=", "banned");
      expect(() => toDrizzleQueryFilters(ast, { selectors: ["status"] })).toThrow(InvalidValueError);
    });

    // Dotted selector fallthrough
    it("dotted selector falls through to selectors when table is not found", () => {
      const ast = parse("user.name==John");
      const result = toDrizzleQueryFilters(ast, {
        tables: { post: ["title"] },
        selectors: ["user.name"],
      });
      expect(result).toEqual({ "user.name": { eq: "John" } });
    });

    it("rejects dotted selector when table exists but column does not, even with selectors fallback", () => {
      const ast = parse("user.secret==value");
      expect(() =>
        toDrizzleQueryFilters(ast, {
          tables: { user: ["name"] },
          selectors: ["user.secret"],
        }),
      ).toThrow(UnknownColumnError);
    });
  });
});
