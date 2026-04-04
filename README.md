<div align="center">

<h1>RSQL / FIQL</h1>
<p>RSQL emitter and parser for Node.js and Browsers</p>

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![tested with vitest](https://img.shields.io/badge/tested_with-vitest-6e9f18.svg)](https://vitest.dev/)

</div>

> **Fork Notice:** This is a fork of the original [rsql](https://github.com/piotr-oles/rsql) project by Piotr Oleś. Thank you for creating this excellent library!

> RSQL is a query language for parametrized filtering of entries in RESTful APIs. It's based on FIQL
> (Feed Item Query Language) – an URI-friendly syntax for expressing filters across the entries in an Atom Feed.
> FIQL is great for use in URI; there are no unsafe characters, so URL encoding is not required. On the other side,
> FIQL's syntax is not very intuitive and URL encoding isn't always that big deal, so RSQL also provides a friendlier
> syntax for logical operators and some of the comparison operators.
>
> For example, you can query your resource like this: /movies?query=name=="Kill Bill";year=gt=2003 or
> /movies?query=director.lastName==Nolan and year>=2000. See examples below.
>
> Source: https://github.com/jirutka/rsql-parser

## Packages

This repository is a monorepo which means that it contains several packages.
All packages are published on the [npm registry](https://www.npmjs.com/) under the `@resenty` scope.

| Package                                                    | Description                                |
| ---------------------------------------------------------- | ------------------------------------------ |
| [`@resenty/rsql-builder`](./packages/builder)              | Simple API for building RSQL               |
| [`@resenty/rsql-parser`](./packages/parser)                | RSQL parser `string => AST`                |
| [`@resenty/rsql-emitter`](./packages/emitter)              | RSQL emitter `AST => string`               |
| [`@resenty/rsql-ast`](./packages/ast)                      | RSQL AST definitions and functions         |
| [`@resenty/rsql-drizzle`](./packages/drizzle) *(unstable)* | RSQL to Drizzle ORM `where` conditions     |

> Each package contains more detailed documentation. To learn more, click on the links above.

## Installation

```
# with npm
npm install @resenty/rsql-builder

# with pnpm
pnpm add @resenty/rsql-builder
```

## Features

- Fast LALR(1) implementation
- Small package size and 0 dependencies (because it was written by hand, not generated)
- Works both in Node.js and Browser environment
- First class TypeScript support
- Highly modular code - use what you really need

## Grammar

Based on the following specification: https://github.com/jirutka/rsql-parser#grammar-and-semantic

## Custom operators

By default RSQL defines 8 built-in comparison operators: `==`, `!=`, `<`, `>`, `<=`, `>=`, `=in=`, and `=out=`.
You can define your custom operators - the only requirement is that they have to satisfy
following regular expression: `/=[a-z]+=/` (FIQL operator). The parser will accept any comparison that contains
a valid operator. Because of that, you don't have to register it. Instead, we suggest defining your grammar
as a module. Here is an example how you can define `=all=` and `=empty=` operator:

```typescript
// src/rsql/ast.ts
const ALL = "=all=";
const EMPTY = "=empty=";

export * from "@resenty/rsql-ast";
export { ALL, EMPTY };

// src/rsql/builder.ts
import builder from "@resenty/rsql-builder";
import { ALL, EMPTY } from "./ast";

export default {
  ...builder,
  all(selector: string, values: string[]) {
    return builder.comparison(selector, ALL, values);
  },
  empty(selector: string, empty: boolean) {
    return builder.comparison(selector, EMPTY, empty ? "yes" : "no");
  },
};
```

## Example

```typescript
// parsing
import { parse } from "@resenty/rsql-parser";
const expression = parse("year>=2003");

// exploring
import { isComparisonNode } from "@resenty/rsql-ast";
if (isComparisonNode(expression)) {
  console.log(`Selector: ${expression.left.selector}`);
  // > Selector: year
  console.log(`Operator: ${expression.operator}`);
  // > Operator: >=
  console.log(`Value: ${expression.right.value}`);
  // > Value: 2003
}

// building
import builder from "@resenty/rsql-builder";
const newExpression = builder.and(expression, builder.le("year", "2020"));

// emitting
import { emit } from "@resenty/rsql-emitter";
const rsql = emit(newExpression);
console.log(`Emitted: ${rsql}`);
// > Emitted: year>=2003;year<=2020
```

## License

MIT
