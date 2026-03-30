# rsql-parser

RSQL parser for Node.js and Browsers

[![npm](https://img.shields.io/npm/v/rsql-parser)](https://www.npmjs.com/package/rsql-parser)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![tested with vitest](https://img.shields.io/badge/tested_with-vitest-6e9f18.svg)](https://vitest.dev/)
[![auto release](https://img.shields.io/badge/release-auto.svg?colorA=888888&colorB=9B065A&label=auto)](https://github.com/intuit/auto)

## Installation

```sh
# with npm
npm install --save rsql-parser

# with pnpm
pnpm add rsql-parser
```

## API

#### `parse(source: string): ExpressionNode`

Parses RSQL string and returns Abstract Syntax Tree. It can throw the following errors:

- `TypeError` - in the case of invalid argument type passed to the `parse` function
- `SyntaxError` - in the case of any problems encountered during parsing

## License

MIT
