const ReservedChars: readonly string[] = ['"', "'", "(", ")", ";", ",", "=", "!", "~", "<", ">", " ", "\n", "\t", "\r"];
type ReservedChar = '"' | "'" | "(" | ")" | ";" | "," | "=" | "!" | "~" | "<" | ">" | " " | "\n" | "\t" | "\r";

export { ReservedChars, ReservedChar };
