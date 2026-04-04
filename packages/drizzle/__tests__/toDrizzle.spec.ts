import { describe, it, expect, vi } from "vitest";
import { integer, pgTable, text, varchar, PgDialect } from "drizzle-orm/pg-core";
import { like, type SQL } from "drizzle-orm";
import { parse } from "@resenty/rsql-parser";
import builder from "@resenty/rsql-builder";
import {
  toDrizzle,
  RsqlDrizzleError,
  UnknownSelectorError,
  UnknownTableError,
  UnknownColumnError,
  UnsupportedOperatorError,
  InvalidValueError,
} from "@resenty/rsql-drizzle";

const dialect = new PgDialect();

function toQuery(condition: SQL) {
  return dialect.sqlToQuery(condition);
}

const users = pgTable("users", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: text("email"),
  age: integer("age"),
  status: varchar("status", { length: 50 }),
});

const columns = {
  name: users.name,
  email: users.email,
  age: users.age,
  status: users.status,
};

describe("toDrizzle", () => {
  describe("comparison operators", () => {
    it("handles == (eq)", () => {
      const ast = parse("name==John");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["John"]);
    });

    it("handles != (ne)", () => {
      const ast = parse("name!=John");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" <> $1');
      expect(params).toEqual(["John"]);
    });

    it("handles < (lt)", () => {
      const ast = parse("age<30");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" < $1');
      expect(params).toEqual(["30"]);
    });

    it("handles > (gt)", () => {
      const ast = parse("age>18");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" > $1');
      expect(params).toEqual(["18"]);
    });

    it("handles <= (lte)", () => {
      const ast = parse("age<=65");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" <= $1');
      expect(params).toEqual(["65"]);
    });

    it("handles >= (gte)", () => {
      const ast = parse("age>=21");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" >= $1');
      expect(params).toEqual(["21"]);
    });
  });

  describe("verbose operator aliases", () => {
    it("handles =lt=", () => {
      const ast = parse("age=lt=30");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" < $1');
      expect(params).toEqual(["30"]);
    });

    it("handles =le=", () => {
      const ast = parse("age=le=65");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" <= $1');
      expect(params).toEqual(["65"]);
    });

    it("handles =gt=", () => {
      const ast = parse("age=gt=18");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" > $1');
      expect(params).toEqual(["18"]);
    });

    it("handles =ge=", () => {
      const ast = parse("age=ge=21");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."age" >= $1');
      expect(params).toEqual(["21"]);
    });
  });

  describe("array operators", () => {
    it("handles =in=", () => {
      const ast = parse("status=in=(active,inactive)");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."status" in ($1, $2)');
      expect(params).toEqual(["active", "inactive"]);
    });

    it("handles =out=", () => {
      const ast = parse("status=out=(banned,deleted)");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."status" not in ($1, $2)');
      expect(params).toEqual(["banned", "deleted"]);
    });
  });

  describe("logic operators", () => {
    it("handles AND with ;", () => {
      const ast = parse("name==John;age>25");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('(("users"."name" = $1) and ("users"."age" > $2))');
      expect(params).toEqual(["John", "25"]);
    });

    it("handles OR with ,", () => {
      const ast = parse("name==John,name==Jane");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('(("users"."name" = $1) or ("users"."name" = $2))');
      expect(params).toEqual(["John", "Jane"]);
    });

    it("handles verbose AND", () => {
      const ast = parse("name==John and age>25");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('(("users"."name" = $1) and ("users"."age" > $2))');
      expect(params).toEqual(["John", "25"]);
    });

    it("handles verbose OR", () => {
      const ast = parse("name==John or name==Jane");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('(("users"."name" = $1) or ("users"."name" = $2))');
      expect(params).toEqual(["John", "Jane"]);
    });

    it("handles nested logic with grouping", () => {
      const ast = parse("(name==John,name==Jane);age>25");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('(((("users"."name" = $1) or ("users"."name" = $2))) and ("users"."age" > $3))');
      expect(params).toEqual(["John", "Jane", "25"]);
    });
  });

  describe("custom operators", () => {
    it("handles custom operator with handler", () => {
      const ast = parse("name=like=Jo*");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          columns,
          customOperators: {
            "=like=": (column, value) => like(column, value as string),
          },
        }),
      );
      expect(sql).toBe('"users"."name" like $1');
      expect(params).toEqual(["Jo*"]);
    });
  });

  describe("value coercion", () => {
    it("coerces values using the coerce callback", () => {
      const coerce = vi.fn((value: string, selector: string) => {
        if (selector === "age") return Number(value);
        return value;
      });

      const ast = parse("age>25");
      const { sql, params } = toQuery(toDrizzle(ast, { columns, coerce }));

      expect(coerce).toHaveBeenCalledWith("25", "age", ">");
      expect(sql).toBe('"users"."age" > $1');
      expect(params).toEqual([25]);
    });

    it("coerces array values for =in= operator", () => {
      const coerce = vi.fn((value: string, selector: string) => {
        if (selector === "age") return Number(value);
        return value;
      });

      const ast = parse("age=in=(25,30,35)");
      const { sql, params } = toQuery(toDrizzle(ast, { columns, coerce }));

      expect(coerce).toHaveBeenCalledTimes(3);
      expect(sql).toBe('"users"."age" in ($1, $2, $3)');
      expect(params).toEqual([25, 30, 35]);
    });
  });

  describe("error handling", () => {
    it("throws UnknownSelectorError for unmapped selector", () => {
      const ast = parse("unknown==value");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("throws UnsupportedOperatorError for unregistered custom operator", () => {
      const ast = parse("name=like=Jo*");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnsupportedOperatorError);
    });

    it("throws InvalidValueError for =in= with non-array value", () => {
      const ast = builder.comparison("status", "=in=", "active");
      expect(() => toDrizzle(ast, { columns })).toThrow(InvalidValueError);
    });
  });

  describe("builder-constructed ASTs", () => {
    it("works with builder-constructed comparison", () => {
      const ast = builder.comparison("name", "==", "John");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["John"]);
    });

    it("works with builder-constructed logic", () => {
      const ast = builder.and(builder.comparison("name", "==", "John"), builder.comparison("age", ">", "25"));
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('(("users"."name" = $1) and ("users"."age" > $2))');
      expect(params).toEqual(["John", "25"]);
    });
  });

  describe("tables option", () => {
    const posts = pgTable("posts", {
      id: integer("id").primaryKey(),
      title: varchar("title", { length: 255 }),
      body: text("body"),
    });

    it("resolves dotted selector via tables", () => {
      const ast = parse("user.name==John");
      const { sql, params } = toQuery(toDrizzle(ast, { tables: { user: { name: users.name } } }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["John"]);
    });

    it("resolves cross-table AND", () => {
      const ast = parse("user.name==John;post.title==Hello");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
        }),
      );
      expect(sql).toBe('(("users"."name" = $1) and ("posts"."title" = $2))');
      expect(params).toEqual(["John", "Hello"]);
    });

    it("tables + columns coexist", () => {
      const ast = parse("user.name==John;status==active");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
          columns: { status: users.status },
        }),
      );
      expect(sql).toBe('(("users"."name" = $1) and ("users"."status" = $2))');
      expect(params).toEqual(["John", "active"]);
    });

    it("flat dotted keys in columns still work", () => {
      const ast = parse("user.name==John");
      const { sql, params } = toQuery(toDrizzle(ast, { columns: { "user.name": users.name } }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["John"]);
    });

    it("resolves cross-table OR", () => {
      const ast = parse("user.name==John,post.title==Hello");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
        }),
      );
      expect(sql).toBe('(("users"."name" = $1) or ("posts"."title" = $2))');
      expect(params).toEqual(["John", "Hello"]);
    });

    it("resolves nested logic across two tables", () => {
      const ast = parse("(user.name==John,user.name==Jane);post.title==Hello");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
        }),
      );
      expect(sql).toBe('(((("users"."name" = $1) or ("users"."name" = $2))) and ("posts"."title" = $3))');
      expect(params).toEqual(["John", "Jane", "Hello"]);
    });

    it("handles comparison operators on second table", () => {
      const ast = parse("post.title!=Draft");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
        }),
      );
      expect(sql).toBe('"posts"."title" <> $1');
      expect(params).toEqual(["Draft"]);
    });

    it("handles =in= on second table", () => {
      const ast = parse("post.title=in=(Hello,World)");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
        }),
      );
      expect(sql).toBe('"posts"."title" in ($1, $2)');
      expect(params).toEqual(["Hello", "World"]);
    });

    it("tables + columns coexist with second table columns", () => {
      const ast = parse("post.title==Hello;status==active");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: { post: { title: posts.title } },
          columns: { status: users.status },
        }),
      );
      expect(sql).toBe('(("posts"."title" = $1) and ("users"."status" = $2))');
      expect(params).toEqual(["Hello", "active"]);
    });

    it("throws UnknownColumnError for unknown column on second table", () => {
      const ast = parse("post.unknown==x");
      expect(() =>
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("custom operator works on second table", () => {
      const ast = parse("post.title=like=Hello*");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: {
            user: { name: users.name },
            post: { title: posts.title },
          },
          customOperators: {
            "=like=": (column, value) => like(column, value as string),
          },
        }),
      );
      expect(sql).toBe('"posts"."title" like $1');
      expect(params).toEqual(["Hello*"]);
    });

    it("coerce receives full dotted selector for second table", () => {
      const coerce = vi.fn((value: string) => value);
      const ast = parse("post.title==Hello");
      toDrizzle(ast, {
        tables: { post: { title: posts.title } },
        coerce,
      });
      expect(coerce).toHaveBeenCalledWith("Hello", "post.title", "==");
    });

    it("throws UnknownTableError for unknown table", () => {
      const ast = parse("foo.bar==x");
      expect(() => toDrizzle(ast, { tables: { user: { name: users.name } } })).toThrow(UnknownTableError);
    });

    it("throws UnknownColumnError for unknown column in known table", () => {
      const ast = parse("user.unknown==x");
      expect(() => toDrizzle(ast, { tables: { user: { name: users.name } } })).toThrow(UnknownColumnError);
    });

    it("throws UnknownSelectorError for non-dotted selector with tables only", () => {
      const ast = parse("status==active");
      expect(() => toDrizzle(ast, { tables: { user: { name: users.name } } })).toThrow(UnknownSelectorError);
    });

    it("coerce receives full dotted selector", () => {
      const coerce = vi.fn((value: string) => Number(value));
      const ast = parse("user.age>25");
      toDrizzle(ast, {
        tables: { user: { age: users.age } },
        coerce,
      });
      expect(coerce).toHaveBeenCalledWith("25", "user.age", ">");
    });

    it("custom operator works with tables", () => {
      const ast = parse("user.name=like=Jo*");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
          customOperators: {
            "=like=": (column, value) => like(column, value as string),
          },
        }),
      );
      expect(sql).toBe('"users"."name" like $1');
      expect(params).toEqual(["Jo*"]);
    });

    it("tables takes precedence over columns for dotted selectors", () => {
      const ast = parse("user.name==John");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
          columns: { "user.name": users.email },
        }),
      );
      // Should use users.name from tables, not users.email from columns
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["John"]);
    });

    it("throws RsqlDrizzleError if neither columns nor tables is provided", () => {
      const ast = parse("name==John");
      expect(() => toDrizzle(ast, {} as any)).toThrow(RsqlDrizzleError);
    });
  });

  describe("security", () => {
    it("throws UnknownSelectorError for unmapped selector in nested expression", () => {
      const ast = parse("name==John;secret==value");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects unquoted SQL injection via parser (semicolon is RSQL AND)", () => {
      expect(() => parse("name==value; DROP TABLE users")).toThrow();
    });

    it("safely parameterizes quoted SQL injection attempts in values", () => {
      const ast = parse(`name=="'; DROP TABLE users--"`);
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["'; DROP TABLE users--"]);
    });

    it("rejects unmapped selector even when deeply nested in logic", () => {
      const ast = parse("(name==John;age>20),(email==a@b.com;secret==x)");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects dotted selector that targets an unknown table", () => {
      const ast = parse("admin.password==secret");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownTableError);
    });

    it("rejects unknown column within a known table", () => {
      const ast = parse("user.password==secret");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("rejects __proto__ as a selector", () => {
      const ast = parse("__proto__==polluted");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects constructor as a selector", () => {
      const ast = parse("constructor==polluted");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects prototype as a table name in dotted selector", () => {
      const ast = parse("prototype.name==polluted");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownTableError);
    });

    it("rejects __proto__ as a column in a known table", () => {
      const ast = parse("user.__proto__==polluted");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("custom operators still require the selector to be mapped", () => {
      const ast = parse("secret=like=value");
      expect(() =>
        toDrizzle(ast, {
          columns,
          customOperators: {
            "=like=": (column, value) => like(column, value as string),
          },
        }),
      ).toThrow(UnknownSelectorError);
    });

    it("safely parameterizes values with newlines and null bytes", () => {
      const ast = parse(`name=="line1\\nline2\\0end"`);
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toHaveLength(1);
      expect(typeof params[0]).toBe("string");
    });

    it("safely parameterizes values containing SQL comment syntax", () => {
      const ast = parse(`name=="value /* comment */ --"`);
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["value /* comment */ --"]);
    });

    it("safely parameterizes =in= values containing SQL injection attempts", () => {
      const ast = parse(`status=in=("'; DROP TABLE users--","normal")`);
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."status" in ($1, $2)');
      expect(params).toEqual(["'; DROP TABLE users--", "normal"]);
    });

    it("rejects every branch of a complex OR when one selector is unmapped", () => {
      const ast = parse("name==John,secret==value,age>25");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("dotted selector falls through to columns when table is not found", () => {
      // Ensure a dotted key in flat columns is reachable and does not accidentally
      // expose unmapped tables
      const ast = parse("user.name==John");
      const { sql, params } = toQuery(
        toDrizzle(ast, {
          columns: { "user.name": users.name },
          tables: { post: { title: users.name } },
        }),
      );
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["John"]);
    });

    it("rejects dotted selector when table exists but column does not, even with flat columns fallback", () => {
      const ast = parse("user.secret==value");
      expect(() =>
        toDrizzle(ast, {
          columns: { "user.secret": users.name },
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("rejects toString as a selector (inherited Object.prototype property)", () => {
      const ast = parse("toString==polluted");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects valueOf as a selector (inherited Object.prototype property)", () => {
      const ast = parse("valueOf==polluted");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects hasOwnProperty as a selector (inherited Object.prototype property)", () => {
      const ast = parse("hasOwnProperty==polluted");
      expect(() => toDrizzle(ast, { columns })).toThrow(UnknownSelectorError);
    });

    it("rejects constructor as a table name in dotted selector", () => {
      const ast = parse("constructor.name==polluted");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownTableError);
    });

    it("rejects __proto__ as a table name in dotted selector", () => {
      const ast = parse("__proto__.name==polluted");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownTableError);
    });

    it("rejects constructor as a column in a known table", () => {
      const ast = parse("user.constructor==polluted");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("rejects toString as a column in a known table", () => {
      const ast = parse("user.toString==polluted");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("throws InvalidValueError for =out= with non-array value", () => {
      const ast = builder.comparison("status", "=out=", "banned");
      expect(() => toDrizzle(ast, { columns })).toThrow(InvalidValueError);
    });

    it("empty customOperators object does not match inherited properties", () => {
      const ast = parse("name=custom=value");
      // Even with an empty customOperators object, inherited properties like toString
      // should not be invoked as handlers
      expect(() =>
        toDrizzle(ast, {
          columns,
          customOperators: {},
        }),
      ).toThrow(UnsupportedOperatorError);
    });
  });

  describe("OWASP RSQL injection patterns", () => {
    it("treats wildcard * as a literal value, not a glob", () => {
      const ast = parse("name==*");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["*"]);
    });

    it("treats SQL LIKE wildcard % as a literal value", () => {
      const ast = parse("name=='%admin%'");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["%admin%"]);
    });

    it("treats SQL underscore wildcard _ as a literal value", () => {
      const ast = parse("name=='admin_'");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["admin_"]);
    });

    it("parameterizes blind enumeration patterns in =in= arrays", () => {
      const ast = parse("name=in=('*a*','*b*')");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" in ($1, $2)');
      expect(params).toEqual(["*a*", "*b*"]);
    });

    it("blocks nested field traversal with UnknownColumnError", () => {
      const ast = parse("user.password==secret");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("blocks deep traversal (multi-dot) with UnknownTableError", () => {
      // "user.profile.ssn" — the parser sees "user.profile.ssn" as the selector.
      // The first dot splits into table="user", column="profile.ssn".
      // "profile.ssn" is not a valid column in the user table.
      const ast = parse("user.profile.ssn==123");
      expect(() =>
        toDrizzle(ast, {
          tables: { user: { name: users.name } },
        }),
      ).toThrow(UnknownColumnError);
    });

    it("parameterizes reverse logic (!=) values", () => {
      const ast = parse("status!=user");
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."status" <> $1');
      expect(params).toEqual(["user"]);
    });

    it("rejects unquoted SQL fragment via parser", () => {
      expect(() => parse("name==1=1")).toThrow(SyntaxError);
    });

    it("rejects SQL OR injection via parser", () => {
      // "name==value OR 1=1" — "OR" is parsed as a verbose OR operator,
      // then "1=1" fails because "=" is not a valid comparison operator form
      expect(() => parse("name==value OR 1=1")).toThrow(SyntaxError);
    });

    it("safely parameterizes UNION injection in quoted values", () => {
      const ast = parse(`name=="' UNION SELECT * --"`);
      const { sql, params } = toQuery(toDrizzle(ast, { columns }));
      expect(sql).toBe('"users"."name" = $1');
      expect(params).toEqual(["' UNION SELECT * --"]);
    });
  });
});
