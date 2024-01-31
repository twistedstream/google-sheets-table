import { Range } from "./types";

export function parseRange(range: string): Range {
  const match = range.match(
    /^(?<sheet>\S+)!(?<startColumn>[A-Z]+)(?<startRow>[0-9]+):(?<endColumn>[A-Z]+)(?<endRow>[0-9]+)$/,
  );
  if (!match?.groups) {
    throw new Error("Missing or bad range");
  }
  const {
    groups: { sheet, startColumn, startRow, endColumn, endRow },
  } = match;

  return {
    sheet,
    startColumn,
    startRow: parseInt(startRow),
    endColumn,
    endRow: parseInt(endRow),
  };
}
