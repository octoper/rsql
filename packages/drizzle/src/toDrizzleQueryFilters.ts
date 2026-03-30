import { type ComparisonNode, type ExpressionNode, type LogicNode, isComparisonNode, isLogicNode } from "@resenty/rsql-ast";
import type { DrizzleQueryFilter, ScalarValue, ToQueryFiltersOptions } from "./types";
import {
  InvalidValueError,
  RsqlDrizzleError,
  UnknownColumnError,
  UnknownSelectorError,
  UnknownTableError,
  UnsupportedOperatorError,
} from "./errors";

interface ResolvedSelector {
  outputKey: string;
  table?: string;
}

function resolveSelector(selector: string, options: ToQueryFiltersOptions): ResolvedSelector {
  const dotIndex = selector.indexOf(".");
  const hasDot = dotIndex !== -1;

  // Step 1: If selector has a dot and tables is provided, try table lookup
  if (hasDot && options.tables) {
    const tableAlias = selector.substring(0, dotIndex);
    const columnName = selector.substring(dotIndex + 1);

    if (Object.hasOwn(options.tables, tableAlias)) {
      const tableColumns = options.tables[tableAlias];
      if (Array.isArray(tableColumns)) {
        if (!tableColumns.includes(columnName)) {
          throw new UnknownColumnError(tableAlias, columnName, selector);
        }
        return { outputKey: columnName, table: tableAlias };
      }
      // Record<string, string> — key is the RSQL name, value is the output name
      if (!Object.hasOwn(tableColumns, columnName)) {
        throw new UnknownColumnError(tableAlias, columnName, selector);
      }
      return { outputKey: tableColumns[columnName], table: tableAlias };
    }
    // Table not found — fall through to flat selectors lookup
  }

  // Step 2: Try flat selectors lookup
  if (options.selectors) {
    if (Array.isArray(options.selectors)) {
      if (options.selectors.includes(selector)) {
        return { outputKey: selector };
      }
    } else if (Object.hasOwn(options.selectors, selector)) {
      return { outputKey: options.selectors[selector] };
    }
  }

  // Step 3: Nothing matched
  if (hasDot && options.tables) {
    const tableAlias = selector.substring(0, dotIndex);
    throw new UnknownTableError(tableAlias, selector);
  }
  throw new UnknownSelectorError(selector);
}

function coerceValue(value: string, selector: string, operator: string, options: ToQueryFiltersOptions): ScalarValue {
  if (options.coerce) {
    return options.coerce(value, selector, operator);
  }
  return value;
}

function processComparison(node: ComparisonNode, options: ToQueryFiltersOptions): DrizzleQueryFilter {
  const selector = node.left.selector;
  const { outputKey, table } = resolveSelector(selector, options);
  const rawValue = node.right.value;
  const operator = node.operator;

  let condition: Record<string, unknown>;

  switch (operator) {
    case "==":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      condition = { eq: coerceValue(rawValue, selector, operator, options) };
      break;

    case "!=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      condition = { ne: coerceValue(rawValue, selector, operator, options) };
      break;

    case "<":
    case "=lt=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      condition = { lt: coerceValue(rawValue, selector, operator, options) };
      break;

    case "<=":
    case "=le=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      condition = { lte: coerceValue(rawValue, selector, operator, options) };
      break;

    case ">":
    case "=gt=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      condition = { gt: coerceValue(rawValue, selector, operator, options) };
      break;

    case ">=":
    case "=ge=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      condition = { gte: coerceValue(rawValue, selector, operator, options) };
      break;

    case "=in=":
      if (!Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "an array of values");
      }
      condition = { in: rawValue.map((v) => coerceValue(v, selector, operator, options)) };
      break;

    case "=out=":
      if (!Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "an array of values");
      }
      condition = { notIn: rawValue.map((v) => coerceValue(v, selector, operator, options)) };
      break;

    default: {
      // Custom operator — use Object.hasOwn to avoid matching inherited properties
      const handler =
        options.customOperators && Object.hasOwn(options.customOperators, operator)
          ? options.customOperators[operator]
          : undefined;
      if (!handler) {
        throw new UnsupportedOperatorError(operator);
      }
      condition = handler(rawValue, selector, operator);
    }
  }

  if (table) {
    return { [table]: { [outputKey]: condition } };
  }
  return { [outputKey]: condition };
}

function processLogic(node: LogicNode, options: ToQueryFiltersOptions): DrizzleQueryFilter {
  const left = processExpression(node.left, options);
  const right = processExpression(node.right, options);

  switch (node.operator) {
    case ";":
    case "and":
      return { AND: [left, right] };
    case ",":
    case "or":
      return { OR: [left, right] };
    default:
      throw new Error(`Unknown logic operator: ${node.operator}`);
  }
}

function processExpression(expression: ExpressionNode, options: ToQueryFiltersOptions): DrizzleQueryFilter {
  if (isComparisonNode(expression)) {
    return processComparison(expression, options);
  } else if (isLogicNode(expression)) {
    return processLogic(expression, options);
  }

  throw new TypeError(`The "expression" has to be a valid "ExpressionNode", ${String(expression)} passed.`);
}

/**
 * Converts a parsed RSQL AST into a Drizzle RQB v2 compatible filter object.
 *
 * @param expression - A parsed RSQL expression node (from `rsql-parser` or `rsql-builder`).
 * @param options - Configuration including selector mapping, optional custom operators, and value coercion.
 * @returns A plain filter object suitable for use in Drizzle's relational query builder `where` option.
 */
function toDrizzleQueryFilters(expression: ExpressionNode, options: ToQueryFiltersOptions): DrizzleQueryFilter {
  if (!options.selectors && !options.tables) {
    throw new RsqlDrizzleError('At least one of "selectors" or "tables" must be provided.');
  }
  return processExpression(expression, options);
}

export { toDrizzleQueryFilters };
