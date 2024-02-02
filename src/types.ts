import { JWTInput } from "google-auth-library";

export type GoogleSheetsTableOptions = {
  spreadsheetId: string;
  credentials: JWTInput;
  sheetName: string;
  columnConstraints: ColumnConstraints;
};

export type RowData = { [name: string]: any };

export type Row = { _rowNumber: number } & RowData;

export type SearchPredicate = (
  row: Row,
  index: number,
  array: Row[]
) => boolean;

export type KeyColumnSelector<T extends keyof any> = (row: Row) => T;

export type ColumnConstraints = { uniques?: string[] };

export type Range = {
  sheet: string;
  startColumn: string;
  startRow: number;
  endColumn: string;
  endRow: number;
};
