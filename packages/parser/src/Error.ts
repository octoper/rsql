import { AnyToken, isEndToken } from "./lexer/Token";

function formatSource(source: string, safeErrors?: boolean): string {
  return safeErrors ? "<redacted>" : source;
}

function createErrorForUnexpectedCharacter(position: number, source: string, safeErrors?: boolean): SyntaxError {
  const character = source[position];

  return new SyntaxError(
    `Unexpected character '${character}' at position ${position + 1} in "${formatSource(source, safeErrors)}".`,
  );
}

function createErrorForUnclosedQuote(position: number, source: string, safeErrors?: boolean): SyntaxError {
  const character = source[position];

  return new SyntaxError(
    `Unclosed quote '${character}' at position ${position + 1} in "${formatSource(source, safeErrors)}".`,
  );
}

function createErrorForUnexpectedToken(token: AnyToken, source: string, safeErrors?: boolean): SyntaxError {
  return new SyntaxError(
    isEndToken(token)
      ? `Unexpected end in "${formatSource(source, safeErrors)}".`
      : `Unexpected ${token.value.length > 1 ? "string" : "character"} '${token.value}' at position ${
          token.position + 1
        } in "${formatSource(source, safeErrors)}".`,
  );
}

function createErrorForUnclosedParenthesis(
  token: AnyToken,
  source: string,
  parentPosition: number,
  safeErrors?: boolean,
): SyntaxError {
  return new SyntaxError(
    `Unexpected end in "${formatSource(source, safeErrors)}". Did you forget to close parenthesis at position ${parentPosition + 1}?`,
  );
}

function createErrorForEmptyInput(token: AnyToken, source: string, safeErrors?: boolean): SyntaxError {
  return new SyntaxError(`Unexpected end in "${formatSource(source, safeErrors)}". Cannot parse empty string.`);
}

function createErrorForInputTooLong(length: number, maxLength: number): SyntaxError {
  return new SyntaxError(`Input length ${length} exceeds maximum allowed length of ${maxLength}.`);
}

function createErrorForNestingTooDeep(depth: number, maxDepth: number): SyntaxError {
  return new SyntaxError(`Nesting depth ${depth} exceeds maximum allowed depth of ${maxDepth}.`);
}

export {
  createErrorForUnexpectedCharacter,
  createErrorForUnclosedQuote,
  createErrorForUnexpectedToken,
  createErrorForUnclosedParenthesis,
  createErrorForEmptyInput,
  createErrorForInputTooLong,
  createErrorForNestingTooDeep,
};
