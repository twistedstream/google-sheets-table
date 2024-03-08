import { sheets_v4 } from "@googleapis/sheets";
import { omit } from "lodash";

import { track } from "./async-tracker";
import { createClient } from "./client";
import { lock } from "./concurrency";
import { ConstraintViolationsError, assertValue } from "./error";
import { processUpdatedData, rowToValues, valuesToRow } from "./row";
import { enforceConstraints, openTable } from "./table";
import {
  ColumnSortSpec,
  GoogleSheetsTableOptions,
  KeyColumnSelector,
  Row,
  RowData,
  SearchPredicate,
} from "./types";

/**
 * Enables row-level interactions with a single sheet within a Google Sheets spreadsheet.
 *
 * @export
 * @class GoogleSheetsTable
 * @typedef {GoogleSheetsTable}
 */
export class GoogleSheetsTable {
  private options: GoogleSheetsTableOptions;
  private sheets: sheets_v4.Sheets;
  private commonGoogleSheetsParams: {
    spreadsheetId: string;
    valueInputOption: string;
    includeValuesInResponse: boolean;
    responseValueRenderOption: string;
    responseDateTimeRenderOption: string;
  };

  /**
   * Creates an instance of GoogleSheetsTable.
   *
   * @constructor
   * @param {GoogleSheetsTableOptions} options
   */
  constructor(options: GoogleSheetsTableOptions) {
    this.options = options;
    const { credentials, spreadsheetId } = this.options;
    this.sheets = createClient(credentials);
    this.commonGoogleSheetsParams = {
      spreadsheetId,
      valueInputOption: "RAW",
      includeValuesInResponse: true,
      responseValueRenderOption: "UNFORMATTED_VALUE",
      responseDateTimeRenderOption: "SERIAL_NUMBER",
    };

    // bind method "this"'s to instance "this"
    this.countRows = this.countRows.bind(this);
    this.findRow = this.findRow.bind(this);
    this.findKeyRows = this.findKeyRows.bind(this);
    this.insertRow = this.insertRow.bind(this);
    this.updateRow = this.updateRow.bind(this);
    this.deleteRow = this.deleteRow.bind(this);
  }

  /**
   * Counts the total number of rows in the table.
   *
   * @async
   * @returns {Promise<number>} The row count.
   */
  async countRows(): Promise<number> {
    await track();

    const { spreadsheetId, sheetName } = this.options;
    const range = `${sheetName}!A:A`;

    const getResult = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const { values } = getResult.data;

    return values
      ? // don't include header row
        values.length - 1
      : // zero rows when no data
        0;
  }

  /**
   * Finds all rows within the table.
   *
   * @async
   * @returns {Promise<{ rows: Row[] }>} All of the rows.
   */
  async findRows(): Promise<{ rows: Row[] }>;
  /**
   * Finds all rows within the table and sorts them.
   *
   * @async
   * @param {ColumnSortSpec[]} sorting The columns to sort by.
   * @returns {Promise<{ rows: Row[] }>} All of the rows, sorted.
   */
  async findRows(sorting: ColumnSortSpec[]): Promise<{ rows: Row[] }>;
  /**
   * Finds zero or more rows within the table.
   *
   * @async
   * @param {SearchPredicate} predicate The search function.
   * @returns {Promise<{ rows: Row[] }>} The found rows.
   */
  async findRows(predicate: SearchPredicate): Promise<{ rows: Row[] }>;
  /**
   * Finds zero or more rows within the table and sorts them.
   *
   * @async
   * @param {SearchPredicate} predicate The search function.
   * @param {ColumnSortSpec[]} sorting The columns to sort by.
   * @returns {Promise<{ rows: Row[] }>} The found rows, sorted.
   */
  async findRows(
    predicate: SearchPredicate,
    sorting: ColumnSortSpec[],
  ): Promise<{ rows: Row[] }>;
  // implementation
  async findRows(
    arg1?: SearchPredicate | ColumnSortSpec[],
    arg2?: ColumnSortSpec[],
  ): Promise<{ rows: Row[] }> {
    await track();

    const predicate =
      arg1 === undefined || Array.isArray(arg1) ? () => true : arg1;
    const sorting = Array.isArray(arg1) ? arg1 : arg2 ?? [];

    const { sheetName } = this.options;
    const { rows, columns } = await openTable(
      this.sheets,
      this.options.spreadsheetId,
      sheetName,
    );
    const foundRows = rows.filter(predicate);

    if (sorting.length > 0) {
      for (const sort of sorting.toReversed()) {
        const column = sort.asc ?? sort.desc;
        if (!columns.includes(column)) {
          throw new Error(`Sort column does not exist: ${column}`);
        }

        foundRows.sort((rowA, rowB) => {
          const valueA = rowA[column];
          const valueB = rowB[column];

          if (valueA > valueB) {
            return sort.asc ? 1 : -1;
          } else if (valueA < valueB) {
            return sort.asc ? -1 : 1;
          } else {
            return 0;
          }
        });
      }
    }

    return { rows: foundRows };
  }

  /**
   * Finds the first row within the table.
   *
   * @async
   * @param {SearchPredicate} predicate The search function.
   * @returns {Promise<{ row?: Row }>} The found row.
   */
  async findRow(predicate: SearchPredicate): Promise<{ row?: Row }> {
    await track();

    const { sheetName } = this.options;
    const { rows } = await openTable(
      this.sheets,
      this.options.spreadsheetId,
      sheetName,
    );
    const row = rows.find(predicate);

    return { row };
  }

  /**
   * Finds all of the rows in the table that are identified by a set of keys.
   *
   * @async
   * @template {keyof any} T The type of the key
   * @param {KeyColumnSelector<T>} selector A function that selects the key column within each row.
   * @param {T[]} keys An array of keys to search for.
   * @returns {Promise<{ rowsByKey: Record<T, Row> }>} A dictionary of keys to matching rows.
   */
  async findKeyRows<T extends keyof any>(
    selector: KeyColumnSelector<T>,
    keys: T[],
  ): Promise<{ rowsByKey: Record<T, Row> }> {
    await track();

    const { sheetName } = this.options;

    // get distinct list of keys
    const distinctKeys = Array.from(new Set(keys));

    // find all rows with those keys
    const rows = (
      await openTable(this.sheets, this.options.spreadsheetId, sheetName)
    ).rows.filter((r) => distinctKeys.includes(selector(r)));

    // return dictionary, mapping keys to Rows
    const rowsByValue = rows.reduce(
      (p, c) => {
        p[selector(c)] = c;
        return p;
      },
      <Record<T, Row>>{},
    );

    return { rowsByKey: rowsByValue };
  }

  /**
   * Inserts a new row into the table.
   *
   * @async
   * @param {RowData} newRow An object containing the row data to insert.
   * @returns {Promise<{ insertedRow: Row }>} The inserted row.
   * @throws {ConstraintViolationsError} Inserted row violates column constraints
   */
  async insertRow(newRow: RowData): Promise<{ insertedRow: Row }> {
    const { spreadsheetId, sheetName, columnConstraints } = this.options;

    return lock(spreadsheetId, async () => {
      await track();

      const { columns, rows } = await openTable(
        this.sheets,
        spreadsheetId,
        sheetName,
      );

      // enforce constraint before insert
      enforceConstraints(rows, newRow, columnConstraints);

      // append row
      const rowValues = rowToValues(newRow, columns);
      const appendResult = await this.sheets.spreadsheets.values.append({
        ...this.commonGoogleSheetsParams,
        insertDataOption: "INSERT_ROWS",
        range: sheetName,
        requestBody: {
          values: [rowValues],
        },
      });

      // process and return inserted row
      const { updatedRowValues, updatedRowNumber } = processUpdatedData(
        assertValue(assertValue(appendResult.data.updates).updatedData),
        sheetName,
        rowValues,
      );
      const insertedRow = valuesToRow(
        updatedRowValues,
        columns,
        updatedRowNumber,
      );
      return { insertedRow };
    });
  }

  /**
   * Updates the data of an existing row in the table.
   *
   * @async
   * @param {SearchPredicate} predicate The search function used to find the existing row to update.
   * @param {RowData} rowUpdates An object containing the data to update.
   * @returns {Promise<{ updatedRow: Row }>} The updated row.
   * @throws {Error} Row is not found
   * @throws {ConstraintViolationsError} Row change violates column constraints
   */
  async updateRow(
    predicate: SearchPredicate,
    rowUpdates: RowData,
  ): Promise<{ updatedRow: Row }> {
    const { spreadsheetId, sheetName, columnConstraints } = this.options;

    return lock(spreadsheetId, async () => {
      await track();

      const { columns, rows } = await openTable(
        this.sheets,
        spreadsheetId,
        sheetName,
      );

      // find existing row
      const existingRow = rows.find(predicate);
      if (!existingRow) {
        throw new Error("Row not found");
      }

      // update row values
      for (const key in rowUpdates) {
        existingRow[key] = rowUpdates[key];
      }

      // enforce constraints before update
      enforceConstraints(rows, existingRow, columnConstraints);

      // clone existing row, removing metadata properties
      const rowDataToUpdate: RowData = omit(existingRow, "_rowNumber");

      // update row
      const rowValues = rowToValues(rowDataToUpdate, columns);
      const updateResult = await this.sheets.spreadsheets.values.update({
        ...this.commonGoogleSheetsParams,
        range: `${sheetName}!${existingRow._rowNumber}:${existingRow._rowNumber}`,
        requestBody: {
          values: [rowValues],
        },
      });

      // process and return updated row
      const { updatedRowValues, updatedRowNumber } = processUpdatedData(
        assertValue(updateResult.data.updatedData),
        sheetName,
        rowValues,
      );
      const updatedRow = valuesToRow(
        updatedRowValues,
        columns,
        updatedRowNumber,
      );
      return { updatedRow };
    });
  }

  /**
   * Deletes an existing row in the table.
   *
   * @async
   * @param {SearchPredicate} predicate The search function used to find the existing row to delete.
   * @returns {Promise<void>}
   * @throws {Error} Row is not found
   */
  async deleteRow(predicate: SearchPredicate): Promise<void> {
    const { spreadsheetId, sheetName } = this.options;

    return lock(spreadsheetId, async () => {
      await track();

      const { rows } = await openTable(this.sheets, spreadsheetId, sheetName);

      // find existing row
      const existingRow = rows.find(predicate);
      if (!existingRow) {
        throw new Error("Row not found");
      }

      // get sheet ID
      const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
      const sheet = assertValue(spreadsheet.data.sheets).find(
        (sheet) => assertValue(sheet.properties).title === sheetName,
      );
      if (!sheet) {
        throw new Error(`Sheet with name '${sheetName}' not found`);
      }
      const { sheetId } = assertValue(sheet.properties);

      // delete the row
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: existingRow._rowNumber - 1,
                  endIndex: existingRow._rowNumber,
                },
              },
            },
          ],
        },
      });
    });
  }
}
