import assert from "assert";
import "dotenv/config";

// import { GoogleSheetsTable } from "google-sheets-table";
import { GoogleSheetsTable } from "./GoogleSheetsTable";

const {
  GOOGLE_AUTH_CLIENT_EMAIL: client_email,
  GOOGLE_AUTH_PRIVATE_KEY: private_key,
  GOOGLE_SPREADSHEET_ID: spreadsheetId,
} = process.env;
assert(client_email);
assert(private_key);
assert(spreadsheetId);

const table = new GoogleSheetsTable({
  // using a Google service account
  credentials: {
    client_email,
    private_key,
  },
  spreadsheetId,
  sheetName: "products",
  // enforce that 'id' and 'sku' columns are unique
  columnConstraints: { uniques: ["id", "sku"] },
});

(async () => {
  console.log("Fetching a single row:");
  const { row } = await table.findRow((r) => r.id === 1001);
  console.log(row);
  // => { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75 }

  console.log("Fetching multiple rows:");
  const { rows } = await table.findRows((r) => r.price >= 1.5);
  console.log(rows);
  // => { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75 }
  //    { _rowNumber: 2, id: 1002, sku: 'BAN1', name: 'Banana', quantity: 11, price: 1.50 }

  console.log("Count rows:");
  const count = await table.countRows();
  console.log(count);
  // => 3
})();
