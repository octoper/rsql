import { and, eq, gt, gte, inArray, lt, lte, ne, notInArray, or, type SQL } from "drizzle-orm";
import {
  type ComparisonNode,
  type ExpressionNode,
  type LogicNode,
  isComparisonNode,
  isLogicNode,
} from "@resenty/rsql-ast";
import type { ToDrizzleOptions, ScalarValue } from "./types";
import {
  InvalidValueError,
  RsqlDrizzleError,
  UnknownColumnError,
  UnknownSelectorError,
  UnknownTableError,
  UnsupportedOperatorError,
} from "./errors";

function resolveColumn(selector: string, options: ToDrizzleOptions) {
  const dotIndex = selector.indexOf(".");
  const hasDot = dotIndex !== -1;

  // Step 1: If selector has a dot and tables is provided, try table lookup
  if (hasDot && options.tables) {
    const tableAlias = selector.substring(0, dotIndex);
    const columnName = selector.substring(dotIndex + 1);

    if (Object.hasOwn(options.tables, tableAlias)) {
      const tableColumns = options.tables[tableAlias];
      if (!Object.hasOwn(tableColumns, columnName)) {
        throw new UnknownColumnError(tableAlias, columnName, selector);
      }
      return tableColumns[columnName];
    }
    // Table not found — fall through to flat columns lookup
  }

  // Step 2: Try flat columns lookup
  if (options.columns && Object.hasOwn(options.columns, selector)) {
    return options.columns[selector];
  }

  // Step 3: Nothing matched
  if (hasDot && options.tables) {
    const tableAlias = selector.substring(0, dotIndex);
    throw new UnknownTableError(tableAlias, selector);
  }
  throw new UnknownSelectorError(selector);
}

function coerceValue(value: string, selector: string, operator: string, options: ToDrizzleOptions): ScalarValue {
  if (options.coerce) {
    return options.coerce(value, selector, operator);
  }
  return value;
}

function processComparison(node: ComparisonNode, options: ToDrizzleOptions): SQL {
  const selector = node.left.selector;
  const column = resolveColumn(selector, options);
  const rawValue = node.right.value;
  const operator = node.operator;

  // Handle both canonical and verbose forms
  switch (operator) {
    case "==":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      return eq(column, coerceValue(rawValue, selector, operator, options));

    case "!=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      return ne(column, coerceValue(rawValue, selector, operator, options));

    case "<":
    case "=lt=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      return lt(column, coerceValue(rawValue, selector, operator, options));

    case "<=":
    case "=le=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      return lte(column, coerceValue(rawValue, selector, operator, options));

    case ">":
    case "=gt=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      return gt(column, coerceValue(rawValue, selector, operator, options));

    case ">=":
    case "=ge=":
      if (Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "a single value");
      }
      return gte(column, coerceValue(rawValue, selector, operator, options));

    case "=in=":
      if (!Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "an array of values");
      }
      return inArray(
        column,
        rawValue.map((v) => coerceValue(v, selector, operator, options)),
      );

    case "=out=":
      if (!Array.isArray(rawValue)) {
        throw new InvalidValueError(operator, rawValue, "an array of values");
      }
      return notInArray(
        column,
        rawValue.map((v) => coerceValue(v, selector, operator, options)),
      );

    default: {
      // Custom operator — use Object.hasOwn to avoid matching inherited properties
      const handler =
        options.customOperators && Object.hasOwn(options.customOperators, operator)
          ? options.customOperators[operator]
          : undefined;
      if (!handler) {
        throw new UnsupportedOperatorError(operator);
      }
      return handler(column, rawValue);
    }
  }
}

function processLogic(node: LogicNode, options: ToDrizzleOptions): SQL {
  const left = processExpression(node.left, options);
  const right = processExpression(node.right, options);

  switch (node.operator) {
    case ";":
    case "and":
      return and(left, right)!;
    case ",":
    case "or":
      return or(left, right)!;
    default:
      throw new Error(`Unknown logic operator: ${node.operator}`);
  }
}

function processExpression(expression: ExpressionNode, options: ToDrizzleOptions): SQL {
  if (isComparisonNode(expression)) {
    return processComparison(expression, options);
  } else if (isLogicNode(expression)) {
    return processLogic(expression, options);
  }

  throw new TypeError(`The "expression" has to be a valid "ExpressionNode", ${String(expression)} passed.`);
}

/**
 * Converts a parsed RSQL AST into a Drizzle ORM `where` condition.
 *
 * @param expression - A parsed RSQL expression node (from `rsql-parser` or `rsql-builder`).
 * @param options - Configuration including column mapping, optional custom operators, and value coercion.
 * @returns A Drizzle `SQL` condition suitable for use in `.where()`.
 */
function toDrizzle(expression: ExpressionNode, options: ToDrizzleOptions): SQL {
  if (!options.columns && !options.tables) {
    throw new RsqlDrizzleError('At least one of "columns" or "tables" must be provided.');
  }
  return processExpression(expression, options);
}

export { toDrizzle };
