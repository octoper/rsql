import { ExpressionNode, isExpressionNode, isSelectorNode, isValueNode, Node } from "@resenty/rsql-ast";
import {
  createErrorForEmptyInput,
  createErrorForInputTooLong,
  createErrorForNestingTooDeep,
  createErrorForUnclosedParenthesis,
  createErrorForUnexpectedToken,
} from "./Error";
import lex from "./lexer/lex";
import Token, {
  AnyToken,
  isCloseParenthesisToken,
  isComparisonOperatorToken,
  isEndToken,
  isAndOperatorToken,
  isOrOperatorToken,
  isOpenParenthesisToken,
  isQuotedToken,
  isUnquotedToken,
} from "./lexer/Token";
import ParserContext, {
  createParserContext,
  getParserContextHead,
  getParserContextState,
  getParserContextToken,
} from "./ParserContext";
import {
  accept,
  goto,
  GoToOperation,
  NodeOperation,
  noop,
  OperationType,
  pop,
  PopOperation,
  push,
  PushOperation,
  reduce,
  ReduceOperation,
  shift,
  ShiftOperation,
  TokenOperation,
} from "./ParserOperation";
import {
  comparisonExpressionProduction,
  groupExpressionProduction,
  logicalExpressionProduction,
  multiValueProduction,
  ParserProduction,
  selectorProduction,
  singleValueProduction,
} from "./ParserProduction";

interface ParseOptions {
  /** Maximum input string length. Default: 4096. Set to Infinity to disable. */
  maxInputLength?: number;
  /** Maximum parenthesis nesting depth. Default: 64. Set to Infinity to disable. */
  maxNestingDepth?: number;
  /** When true, error messages omit the raw input string. Default: false. */
  safeErrors?: boolean;
}

const DEFAULT_MAX_INPUT_LENGTH = 4096;
const DEFAULT_MAX_NESTING_DEPTH = 64;

const productions: ParserProduction[] = [
  /* 0 */ selectorProduction,
  /* 1 */ singleValueProduction,
  /* 2 */ multiValueProduction,
  /* 3 */ comparisonExpressionProduction,
  /* 4 */ logicalExpressionProduction,
  /* 5 */ groupExpressionProduction,
];

const tokenMatchers = [
  /* 0 */ isOpenParenthesisToken, // O_PAREN
  /* 1 */ isCloseParenthesisToken, // C_PAREN
  /* 2 */ isUnquotedToken, // UNQUOTED
  /* 3 */ isQuotedToken, // QUOTED
  /* 4 */ isComparisonOperatorToken, // C_OP
  /* 5 */ isOrOperatorToken, // OR_OP
  /* 6 */ isAndOperatorToken, // AND_OP
  /* 7 */ isEndToken, // END
];

const nodeMatchers = [
  /* 0 */ isSelectorNode, // SELECT
  /* 1 */ isValueNode, // VALUE
  /* 2 */ isExpressionNode, // EXPR
];

type ParserTable = [TokenOperation[], NodeOperation[]][];

// prettier-ignore
const table: ParserTable = [
  /* st   | token (terminal)                                                                         | node (non-terminal)              */
  /*        O_PAREN,    C_PAREN,   UNQUOTED,  QUOTED,    C_OP,      OR_OP,     AND_OP,    END          SELECT,    VALUE,    EXPR        */
  /* 0  */ [[push(0),   noop,      shift(8),  noop,      noop,      noop,      noop,      noop     ] , [goto(3),  noop,     goto(7)   ]], // INITIAL STATE
  /* 1  */ [[push(0),   noop,      shift(8),  noop,      noop,      noop,      noop,      noop     ] , [goto(3),  noop,     goto(12), ]], // INITIAL STATE [AFTER OR EXPRESSION]
  /* 2  */ [[push(0),   noop,      shift(8),  noop,      noop,      noop,      noop,      noop     ] , [goto(3),  noop,     goto(13), ]], // INITIAL STATE [AFTER AND EXPRESSION]
  /* 3  */ [[noop,      noop,      noop,      noop,      shift(4),  noop,      noop,      noop     ] , [noop,     noop,     noop,     ]], // COMPARISON OPERATOR STATE
  /* 4  */ [[shift(5),  noop,      shift(9),  shift(9),  noop,      noop,      noop,      noop     ] , [noop,     goto(11), noop,     ]], // SINGLE/MULTI-VALUE STATE
  /* 5  */ [[noop,      noop,      shift(6),  shift(6),  noop,      noop,      noop,      noop     ] , [noop,     noop,     noop,     ]], // MULTI-VALUE STATE
  /* 6  */ [[noop,      shift(10), noop,      noop,      noop,      shift(5),  noop,      noop     ] , [noop,     noop,     noop,     ]], // MULTI-VALUE STATE
  /* 7  */ [[noop,      shift(14), noop,      noop,      noop,      shift(1),  shift(2),  accept() ] , [noop,     noop,     noop,     ]], // LOGIC / END STATE
  /* 8  */ [[noop,      noop,      noop,      noop,      reduce(0), noop,      noop,      noop     ] , [noop,     noop,     noop,     ]], // REDUCE SELECTOR
  /* 9  */ [[noop,      reduce(1), noop,      noop,      noop,      reduce(1), reduce(1), reduce(1)] , [noop,     noop,     noop,     ]], // REDUCE SINGLE-VALUE
  /* 10 */ [[noop,      reduce(2), noop,      noop,      noop,      reduce(2), reduce(2), reduce(2)] , [noop,     noop,     noop,     ]], // REDUCE MULTI-VALUE
  /* 11 */ [[noop,      reduce(3), noop,      noop,      noop,      reduce(3), reduce(3), reduce(3)] , [noop,     noop,     noop,     ]], // REDUCE COMPARISON EXPRESSION
  /* 12 */ [[noop,      reduce(4), noop,      noop,      noop,      reduce(4), shift(2),  reduce(4)] , [noop,     noop,     noop,     ]], // REDUCE LOGIC EXPRESSION [AFTER OR EXPRESSION]
  /* 13 */ [[noop,      reduce(4), noop,      noop,      noop,      reduce(4), reduce(4), reduce(4)] , [noop,     noop,     noop,     ]], // REDUCE LOGIC EXPRESSION [AFTER AND EXPRESSION]
  /* 14 */ [[noop,      pop(5),    noop,      noop,      noop,      pop(5),    pop(5),    pop(5)   ] , [noop,     noop,     noop,     ]], // REDUCE GROUP EXPRESSION
];

function getParserTokenOperation(state: number, token: Token): TokenOperation {
  return table[state][0][tokenMatchers.findIndex((matcher) => matcher(token))];
}

function getParserNodeOperation(state: number, node: Node): NodeOperation {
  return table[state][1][nodeMatchers.findIndex((matcher) => matcher(node))];
}

function getMostMeaningfulInvalidToken(context: ParserContext): AnyToken {
  if (
    context.position > 0 &&
    isCloseParenthesisToken(context.tokens[context.position - 1]) &&
    context.parent === null
  ) {
    // in this case we were not able to pop CLOSE_PARENTHESIS token, which was invalid in the first place
    return context.tokens[context.position - 1];
  }

  return context.tokens[context.position];
}

function handleShift(context: ParserContext, shiftOperation: ShiftOperation): ParserContext {
  // we can perform side-effects on shift operation to reduce memory usage
  context.stack.push(context.tokens[context.position]);
  context.state.push(shiftOperation.state);
  context.position = context.position + 1;

  return context;
}

function handlePush(context: ParserContext, pushOperation: PushOperation): ParserContext {
  return {
    position: context.position + 1,
    tokens: context.tokens,
    stack: [context.tokens[context.position]],
    state: [pushOperation.state],
    parent: context,
  };
}

function handleGoTo(context: ParserContext, gotoOperation: GoToOperation): ParserContext {
  // we can perform side-effects on goto operation to reduce memory usage
  context.state.push(gotoOperation.state);
  return context;
}

function handleReduce(
  context: ParserContext,
  reduceOperation: ReduceOperation,
  input: string,
  safeErrors?: boolean,
): ParserContext {
  const { consumed, produced } = productions[reduceOperation.production](context.stack);

  // we can perform side-effects on reduce operation to reduce memory usage
  for (let i = 0; i < consumed; ++i) {
    context.stack.pop();
    context.state.pop();
  }
  context.stack.push(produced);

  const stateAfterReduce = getParserContextState(context);
  const nodeAfterReduce = getParserContextHead(context) as Node;
  const gotoOperation = getParserNodeOperation(stateAfterReduce, nodeAfterReduce);

  if (gotoOperation) {
    context = handleGoTo(context, gotoOperation);
  } else {
    throw createErrorForUnexpectedToken(getMostMeaningfulInvalidToken(context), input, safeErrors);
  }

  return context;
}

function handlePop(
  context: ParserContext,
  popOperation: PopOperation,
  input: string,
  safeErrors?: boolean,
): ParserContext {
  if (!context.parent) {
    throw createErrorForUnexpectedToken(getMostMeaningfulInvalidToken(context), input, safeErrors);
  }

  const { produced } = productions[popOperation.production](context.stack);

  // we can perform side-effects on pop operation to reduce memory usage (as child context will not be used anymore)
  context.parent.position = context.position;
  context.parent.stack.push(produced);

  context = context.parent;

  const stateAfterPop = getParserContextState(context);
  const nodeAfterPop = getParserContextHead(context) as Node;

  const gotoOperation = getParserNodeOperation(stateAfterPop, nodeAfterPop);

  if (gotoOperation) {
    context = handleGoTo(context, gotoOperation);
  } else {
    throw createErrorForUnexpectedToken(getMostMeaningfulInvalidToken(context), input, safeErrors);
  }

  return context;
}

function handleAccept(context: ParserContext, input: string, safeErrors?: boolean): ExpressionNode {
  if (context.parent !== null) {
    throw createErrorForUnclosedParenthesis(
      getMostMeaningfulInvalidToken(context),
      input,
      context.parent.position,
      safeErrors,
    );
  }

  return getParserContextHead(context) as ExpressionNode;
}

function parse(source: string, options?: ParseOptions): ExpressionNode {
  if (typeof source !== "string") {
    throw new TypeError(`The argument passed to the "parse" function has to be a string, "${source}" passed.`);
  }

  const maxInputLength = options?.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const maxNestingDepth = options?.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH;
  const safeErrors = options?.safeErrors ?? false;

  if (source.length > maxInputLength) {
    throw createErrorForInputTooLong(source.length, maxInputLength);
  }

  let tokens: AnyToken[];
  try {
    tokens = lex(source);
  } catch (error) {
    if (safeErrors && error instanceof SyntaxError) {
      throw new SyntaxError(error.message.replace(` in "${source}"`, ' in "<redacted>"'));
    }
    throw error;
  }

  if (tokens.length === 1 && tokens[0].type === "END") {
    throw createErrorForEmptyInput(tokens[0], source, safeErrors);
  }

  let context = createParserContext(tokens);
  let nestingDepth = 0;

  while (context.position < context.tokens.length) {
    const state = getParserContextState(context);
    const token = getParserContextToken(context);
    const operation = getParserTokenOperation(state, token);

    if (!operation) {
      throw createErrorForUnexpectedToken(getMostMeaningfulInvalidToken(context), source, safeErrors);
    }

    switch (operation.type) {
      case OperationType.SHIFT:
        context = handleShift(context, operation);
        break;

      case OperationType.PUSH:
        nestingDepth++;
        if (nestingDepth > maxNestingDepth) {
          throw createErrorForNestingTooDeep(nestingDepth, maxNestingDepth);
        }
        context = handlePush(context, operation);
        break;

      case OperationType.REDUCE:
        context = handleReduce(context, operation, source, safeErrors);
        break;

      case OperationType.POP:
        nestingDepth--;
        context = handlePop(context, operation, source, safeErrors);
        break;

      case OperationType.ACCEPT:
        return handleAccept(context, source, safeErrors);
    }
  }

  throw createErrorForUnexpectedToken(getMostMeaningfulInvalidToken(context), source, safeErrors);
}

export { parse };
export type { ParseOptions };
