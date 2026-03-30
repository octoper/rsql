/** Base error class for rsql-drizzle errors. */
class RsqlDrizzleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RsqlDrizzleError";
  }
}

/** Thrown when an RSQL selector is not present in the column mapping. */
class UnknownSelectorError extends RsqlDrizzleError {
  readonly selector: string;

  constructor(selector: string) {
    super(`Unknown selector "${selector}". Only explicitly mapped columns are allowed.`);
    this.name = "UnknownSelectorError";
    this.selector = selector;
  }
}

/** Thrown when a custom RSQL operator has no registered handler. */
class UnsupportedOperatorError extends RsqlDrizzleError {
  readonly operator: string;

  constructor(operator: string) {
    super(`Unsupported operator "${operator}". Register a custom operator handler to use this operator.`);
    this.name = "UnsupportedOperatorError";
    this.operator = operator;
  }
}

/** Thrown when a value has the wrong shape for the given operator (e.g. =in= with a non-array). */
class InvalidValueError extends RsqlDrizzleError {
  readonly operator: string;
  readonly value: string | string[];

  constructor(operator: string, value: string | string[], expected: string) {
    super(`Invalid value for operator "${operator}": expected ${expected}, got ${JSON.stringify(value)}.`);
    this.name = "InvalidValueError";
    this.operator = operator;
    this.value = value;
  }
}

/** Thrown when a dotted selector references a table not present in the tables mapping. */
class UnknownTableError extends RsqlDrizzleError {
  readonly table: string;
  readonly selector: string;

  constructor(table: string, selector: string) {
    super(`Unknown table "${table}" in selector "${selector}". Only explicitly mapped tables are allowed.`);
    this.name = "UnknownTableError";
    this.table = table;
    this.selector = selector;
  }
}

/** Thrown when a dotted selector references a column not present in the resolved table mapping. */
class UnknownColumnError extends RsqlDrizzleError {
  readonly table: string;
  readonly column: string;
  readonly selector: string;

  constructor(table: string, column: string, selector: string) {
    super(
      `Unknown column "${column}" in table "${table}" (from selector "${selector}"). Only explicitly mapped columns are allowed.`,
    );
    this.name = "UnknownColumnError";
    this.table = table;
    this.column = column;
    this.selector = selector;
  }
}

export {
  RsqlDrizzleError,
  UnknownSelectorError,
  UnsupportedOperatorError,
  InvalidValueError,
  UnknownTableError,
  UnknownColumnError,
};
