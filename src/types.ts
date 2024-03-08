import { JWTInput } from "google-auth-library";

/**
 * Options for creating a new GoogleSheetsTable object
 *
 * @export
 * @typedef {GoogleSheetsTableOptions}
 */
export type GoogleSheetsTableOptions = {
  /**
   * The [spreadsheet ID]{@link https://developers.google.com/sheets/api/guides/concepts}
   * or Google Drive file ID of the Google Spreadsheet containing the table.
   *
   * @type {string}
   */
  spreadsheetId: string;

  /**
   * The credentials used to call the Google Sheets API.
   * @example
   * // using a Google service account
   * {
   *   client_email: "service-account@your-project-123456.iam.gserviceaccount.com",
   *   private_key: "your-service-account-private-key"
   * }
   *
   * @type {JWTInput}
   */
  credentials: JWTInput;

  /**
   * The name of the sheet within the Google Sheets spreadsheet that contains the table
   *
   * @type {string}
   */
  sheetName: string;

  /**
   * Column constraints used when inserting or updating data in the table.
   *
   * @type {ColumnConstraints}
   */
  columnConstraints: ColumnConstraints;
};

/**
 * The data that physically exists in a table row.
 *
 * @export
 * @typedef {RowData}
 */
export type RowData = { [name: string]: any & { _rowNumber?: never } };

/**
 * Row data plus meta data
 *
 * @export
 * @typedef {Row}
 */
export type Row = {
  /**
   * The row number as it existed in the table at the time of being fetched.
   *
   * @type {number}
   */
  _rowNumber: number;
} & RowData;

/**
 * A function that will examine a row and determine if it meets a specific search criteria
 *
 * @export
 * @typedef {SearchPredicate}
 */
export type SearchPredicate = (
  /**
   * A row to examine.
   *
   * @type {Row}
   */
  row: Row,
  /**
   * The index of the row in all of the rows.
   *
   * @type {Row}
   */
  index: number,
  /**
   * The full set of rows.
   *
   * @type {Row}
   */
  array: Row[],
) => boolean;

/**
 * A function that returns the value of a specific column that represents a key.
 *
 * @export
 * @typedef {KeyColumnSelector}
 * @template {keyof any} T The type of key.
 */
export type KeyColumnSelector<T extends keyof any> = (row: Row) => T;

/**
 * Contains column constraint expressions.
 *
 * @export
 * @typedef {ColumnConstraints}
 */
export type ColumnConstraints = {
  /**
   * An array of columns whose values must remain unique within the table.
   *
   * @type {?string[]}
   */
  uniques?: string[];
};

/**
 * Specifies a single column sort.
 *
 * @export
 * @typedef {ColumnSortSpec}
 */
export type ColumnSortSpec =
  | {
      /**
       * The name of the column to sort ascending.
       *
       * @type {string}
       */
      asc: string;
      desc?: never;
    }
  | {
      /**
       * The name of the column to sort descending.
       *
       * @type {string}
       */
      desc: string;
      asc?: never;
    };

export type Range = {
  sheet: string;
  startColumn: string;
  startRow: number;
  endColumn: string;
  endRow: number;
};

/**
 * Represents an instance of a table constraint violation.
 *
 * @export
 * @typedef {ConstraintViolation}
 */
export type ConstraintViolation = {
  /**
   * The type of constraint violation.
   *
   * @type {"unique"}
   */
  type: "unique";

  /**
   * The name of the column where the constraint violation occurred.
   *
   * @type {string}
   */
  column: string;

  /**
   * A description of what the violation is and why it was violated.
   *
   * @type {string}
   */
  description: string;
};
