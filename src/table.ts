import { sheets_v4 } from "@googleapis/sheets";

import { ConstraintViolationsError } from "./error";
import { valuesToRow } from "./row";
import { ColumnConstraints, ConstraintViolation, Row, RowData } from "./types";

export async function openTable(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
): Promise<{ columns: string[]; rows: Row[] }> {
  const range = sheetName;

  const getResult = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = getResult.data.values || [];

  // get column names from first row
  const columns = values[0] || [];
  // remove header row from row values
  values.splice(0, 1);

  // convert values to rows
  const rows = values.map((rowValues, index) =>
    valuesToRow(rowValues, columns, index + 2),
  );

  return { columns, rows };
}

export function enforceConstraints(
  rows: Row[],
  testRow: RowData,
  constraints: ColumnConstraints,
) {
  const violations: ConstraintViolation[] = [];
  // uniques
  if (constraints.uniques) {
    for (const column of constraints.uniques) {
      const value = testRow[column];
      if (
        rows.some(
          (row) =>
            // don't compare test row against itself
            row !== testRow &&
            // check if test row has same value as another row (ignore case)
            row[column].toString().toUpperCase() ===
              value.toString().toUpperCase(),
        )
      ) {
        violations.push({
          type: "unique",
          description: `A row already exists with ${column} = ${value}`,
        });
      }
    }
  }

  // throw if violations
  if (violations.length > 0) {
    throw new ConstraintViolationsError(violations);
  }
}
