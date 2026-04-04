# @resenty/rsql-drizzle

> **Warning:** This package is unstable and not safe for production use. The API may change without notice.

RSQL to [Drizzle ORM](https://orm.drizzle.team/) `where` conditions.

Converts parsed RSQL ASTs into type-safe Drizzle query conditions, enabling REST API query filtering with RSQL syntax.

## Installation

```bash
npm install rsql-drizzle rsql-parser drizzle-orm
```

## Basic Usage

```ts
import { parse } from "rsql-parser";
import { toDrizzle } from "rsql-drizzle";
import { users } from "./schema";

const ast = parse("name==John;age>25");
const condition = toDrizzle(ast, {
  columns: { name: users.name, age: users.age },
});
const result = await db.select().from(users).where(condition);
```

## Column Mapping

The `columns` option defines a strict allowlist of queryable fields. Only selectors explicitly mapped to Drizzle columns are permitted — any unmapped selector throws an `UnknownSelectorError`.

```ts
import { pgTable, integer, varchar } from "drizzle-orm/pg-core";

const users = pgTable("users", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  age: integer("age"),
  internalNote: varchar("internal_note", { length: 500 }), // not exposed
});

// Only name, email, and age are queryable via RSQL
const columns = {
  name: users.name,
  email: users.email,
  age: users.age,
};
```

## Value Coercion

RSQL values are always strings. Use the `coerce` callback to convert values to the appropriate types:

```ts
const condition = toDrizzle(ast, {
  columns: { name: users.name, age: users.age },
  coerce: (value, selector) => {
    if (selector === "age") return Number(value);
    return value;
  },
});
```

## Custom Operators

Register handlers for custom RSQL operators:

```ts
import { like, ilike } from "drizzle-orm";

const condition = toDrizzle(ast, {
  columns: { name: users.name },
  customOperators: {
    "=like=": (column, value) => like(column, value as string),
    "=ilike=": (column, value) => ilike(column, value as string),
  },
});
```

## Error Handling

```ts
import { UnknownSelectorError, UnsupportedOperatorError, InvalidValueError } from "rsql-drizzle";

try {
  const condition = toDrizzle(ast, { columns });
} catch (error) {
  if (error instanceof UnknownSelectorError) {
    // Selector not in column mapping
  } else if (error instanceof UnsupportedOperatorError) {
    // Custom operator with no handler
  } else if (error instanceof InvalidValueError) {
    // Wrong value shape for operator (e.g. =in= with non-array)
  }
}
```

## Security

- **Field allowlisting**: The `columns` mapping acts as a strict allowlist. Unmapped selectors are rejected with `UnknownSelectorError`.
- **SQL injection prevention**: All values flow through Drizzle's built-in operators (`eq()`, `gt()`, `inArray()`, etc.), which automatically parameterize values. Selectors are resolved via the fixed column mapping object, never interpolated into SQL.
