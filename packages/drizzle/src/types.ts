import type { Column, SQL } from "drizzle-orm";
import type { ComparisonOperator } from "@resenty/rsql-ast";

/** Mapping from RSQL selector strings to Drizzle columns. Acts as a strict allowlist. */
type ColumnMapping = Record<string, Column>;

/** Handler for a custom RSQL operator. Returns a Drizzle SQL condition. */
type CustomOperatorHandler = (column: Column, value: string | string[]) => SQL;

/** Registry of custom operator handlers keyed by operator string. */
type CustomOperatorHandlers = Record<string, CustomOperatorHandler>;

/** Common database scalar types for value coercion. */
type ScalarValue = string | number | boolean | Date;

/**
 * Value coercion function. Receives raw RSQL string value and returns
 * the coerced value matching the target column type.
 */
type ValueCoercion = (value: string, selector: string, operator: ComparisonOperator) => ScalarValue;

/** Mapping from table alias to its column mapping. */
type TableMapping = Record<string, ColumnMapping>;

interface ToDrizzleBaseOptions {
  /** Handlers for custom RSQL operators (e.g. `=like=`). */
  customOperators?: CustomOperatorHandlers;
  /** Optional coercion function to convert string values to proper types (numbers, dates, etc.). */
  coerce?: ValueCoercion;
}

interface ToDrizzleWithColumns extends ToDrizzleBaseOptions {
  /** Mapping from RSQL selector names to Drizzle column references. Only mapped selectors are queryable. */
  columns: ColumnMapping;
  /** Mapping from table aliases to their column mappings for dot-notated selectors. */
  tables?: TableMapping;
}

interface ToDrizzleWithTables extends ToDrizzleBaseOptions {
  /** Mapping from RSQL selector names to Drizzle column references. Only mapped selectors are queryable. */
  columns?: ColumnMapping;
  /** Mapping from table aliases to their column mappings for dot-notated selectors. */
  tables: TableMapping;
}

type ToDrizzleOptions = ToDrizzleWithColumns | ToDrizzleWithTables;

/** Selectors config: array = allowlist (names used as-is), record = rename mapping. */
type SelectorConfig = string[] | Record<string, string>;

/** Table column config for dotted selectors in query filters. */
type QueryFilterTableMapping = Record<string, string[] | Record<string, string>>;

/** Custom operator handler for query filters. Returns an operator object (e.g. { like: value }). */
type QueryFilterCustomOperatorHandler = (
  value: string | string[],
  selector: string,
  operator: string,
) => Record<string, unknown>;

/** Registry of custom operator handlers for query filters. */
type QueryFilterCustomOperatorHandlers = Record<string, QueryFilterCustomOperatorHandler>;

/** A Drizzle RQB v2 compatible where filter object. */
type DrizzleQueryFilter = Record<string, unknown>;

interface ToQueryFiltersBaseOptions {
  /** Optional coercion function to convert string values to proper types (numbers, dates, etc.). */
  coerce?: ValueCoercion;
  /** Handlers for custom RSQL operators (e.g. `=like=`). */
  customOperators?: QueryFilterCustomOperatorHandlers;
}

interface ToQueryFiltersWithSelectors extends ToQueryFiltersBaseOptions {
  /** Selector allowlist or rename mapping. Only mapped selectors are queryable. */
  selectors: SelectorConfig;
  /** Mapping from table aliases to their column lists/mappings for dot-notated selectors. */
  tables?: QueryFilterTableMapping;
}

interface ToQueryFiltersWithTables extends ToQueryFiltersBaseOptions {
  /** Selector allowlist or rename mapping. Only mapped selectors are queryable. */
  selectors?: SelectorConfig;
  /** Mapping from table aliases to their column lists/mappings for dot-notated selectors. */
  tables: QueryFilterTableMapping;
}

type ToQueryFiltersOptions = ToQueryFiltersWithSelectors | ToQueryFiltersWithTables;

export type {
  ColumnMapping,
  CustomOperatorHandler,
  CustomOperatorHandlers,
  ScalarValue,
  TableMapping,
  ValueCoercion,
  ToDrizzleOptions,
  SelectorConfig,
  QueryFilterTableMapping,
  QueryFilterCustomOperatorHandler,
  QueryFilterCustomOperatorHandlers,
  DrizzleQueryFilter,
  ToQueryFiltersOptions,
};
