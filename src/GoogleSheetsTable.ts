import { sheets_v4 } from "@googleapis/sheets";
import { Mutex } from "async-mutex";

import { createClient } from "./client";
import { assertValue } from "./error";
import { processUpdatedData, rowToValues, valuesToRow } from "./row";
import { enforceConstraints, openTable } from "./table";
import {
  ColumnConstraints,
  GoogleSheetsTableOptions,
  KeyColumnSelector,
  Row,
  RowData,
  SearchPredicate,
} from "./types";

const mutex = new Mutex();

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

  async countRows(sheetName: string): Promise<number> {
    const { spreadsheetId } = this.options;
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

  async findRows(
    sheetName: string,
    predicate: SearchPredicate,
  ): Promise<{ rows: Row[] }> {
    const { rows } = await openTable(
      this.sheets,
      this.options.spreadsheetId,
      sheetName,
    );
    const foundRows = rows.filter(predicate);

    return { rows: foundRows };
  }

  async findRow(
    sheetName: string,
    predicate: SearchPredicate,
  ): Promise<{ row?: Row }> {
    const { rows } = await openTable(
      this.sheets,
      this.options.spreadsheetId,
      sheetName,
    );
    const row = rows.find(predicate);

    return { row };
  }

  async findKeyRows<T extends keyof any>(
    sheetName: string,
    selector: KeyColumnSelector<T>,
    keys: T[],
  ): Promise<{ rowsByKey: Record<T, Row> }> {
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

  async insertRow(
    sheetName: string,
    newRow: RowData,
    constraints: ColumnConstraints = {},
  ): Promise<{ insertedRow: Row }> {
    return mutex.runExclusive(async () => {
      const { columns, rows } = await openTable(
        this.sheets,
        this.options.spreadsheetId,
        sheetName,
      );

      // enforce constraint before insert
      enforceConstraints(rows, newRow, constraints);

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

  async updateRow(
    sheetName: string,
    predicate: SearchPredicate,
    rowUpdates: RowData,
    constraints: ColumnConstraints = {},
  ): Promise<{ updatedRow: Row }> {
    return mutex.runExclusive(async () => {
      const { columns, rows } = await openTable(
        this.sheets,
        this.options.spreadsheetId,
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
      enforceConstraints(rows, existingRow, constraints);

      // update row
      const rowValues = rowToValues(existingRow, columns);
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

  async deleteRow(
    sheetName: string,
    predicate: SearchPredicate,
  ): Promise<void> {
    return mutex.runExclusive(async () => {
      const { spreadsheetId } = this.options;

      const { rows } = await openTable(
        this.sheets,
        this.options.spreadsheetId,
        sheetName,
      );

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
      const sheetId = assertValue(sheet.properties).index;

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
