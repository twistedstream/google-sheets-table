import { sheets_v4 } from "@googleapis/sheets";
import { ErrorWithData, assertValue } from "./error";
import { parseRange } from "./range";
import { Row, RowData } from "./types";

export function valuesToRow(
  rowValues: any[],
  columns: string[],
  rowNumber: number,
): Row {
  return rowValues.reduce(
    (row, value, index) => {
      row[columns[index]] = value;
      return row;
    },
    { _rowNumber: rowNumber },
  );
}

export function rowToValues(row: RowData, columns: string[]): any[] {
  // ensure columns exist for each row property
  const missingColumns = Object.keys(row).filter((p) => !columns.includes(p));
  if (missingColumns.length > 0) {
    throw new Error(
      `Table columns missing that exist as row properties: ${missingColumns.join(", ")}`,
    );
  }

  return columns.map((c) => row[c]);
}

export function processUpdatedData(
  updatedValueRange: sheets_v4.Schema$ValueRange,
  sheetName: string,
  submittedRowValues: any[],
): { updatedRowValues: any[]; updatedRowNumber: number } {
  const { range: _range, values: _values } = updatedValueRange;
  const range = assertValue(_range, "Updated value range has empty range");
  const values = assertValue(_values, "Updated value range has empty values");
  if (values.length !== 1) {
    throw new Error(
      `Expected one row of values, but instead got ${values.length}`,
    );
  }
  const updatedRowValues = values[0];

  const matches = submittedRowValues.map((submitted, index) => {
    const updated = updatedRowValues[index];
    if (submitted === updated) {
      return true;
    }
    if (submitted === undefined && updated === "") {
      return true;
    }
    if (submitted === "" && updated === undefined) {
      return true;
    }
    return { submitted, updated };
  });
  if (matches.some((m) => m !== true)) {
    throw new ErrorWithData(
      "One or more updated row values don't match corresponding submitted values",
      matches,
    );
  }

  const { sheet, startRow, endRow } = parseRange(range);
  if (sheetName !== sheet) {
    throw new Error(
      `Updated range sheet name '${sheet}' doesn't match submitted sheet name '${sheetName}'`,
    );
  }
  if (startRow !== endRow) {
    throw new Error(
      `Updated range start row (${startRow}) doesn't match end row (${endRow})`,
    );
  }

  return { updatedRowValues, updatedRowNumber: startRow };
}
