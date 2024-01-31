import { sheets_v4 } from "@googleapis/sheets";
import { mutex } from "./GoogleSheetsTable";
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
      const { columns, rows } = await openTable(sheetName);

      // enforce constraint before insert
      enforceConstraints(rows, newRow, constraints);

      // append row
      const rowValues = rowToValues(newRow, columns);
      const appendResult = await sheets.spreadsheets.values.append({
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
    // TODO
    return { updatedRow: { _rowNumber: 42 } };
  }

  async deleteRow(
    sheetName: string,
    predicate: SearchPredicate,
  ): Promise<void> {
    // TODO
  }
}
