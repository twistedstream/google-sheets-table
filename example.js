// Steps to run:
// 1. Create a .env file with the config values shown below
// 2. Run continuously with `npm run example`

require("dotenv").config();

// const { GoogleSheetsTable } = require("google-sheets-table")
const { GoogleSheetsTable } = require("./dist");

const {
  GOOGLE_AUTH_CLIENT_EMAIL: client_email,
  GOOGLE_AUTH_PRIVATE_KEY: private_key,
  GOOGLE_SPREADSHEET_ID: spreadsheetId,
} = process.env;

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
  console.log("Find a single row:");
  const { row } = await table.findRow((r) => r.id === 1001);
  console.log(row);
  // => { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: "produce" }

  console.log("Finding rows by multiple keys:");
  const { rows } = await table.findRows((r) => r.price < 2);
  console.log(rows);
  // => [
  //      { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: "produce" } },
  //      { _rowNumber: 2, id: 1002, sku: 'BAN1', name: 'Banana', quantity: 11, price: 1.50, department: "produce" } }
  //    ]

  console.log("Finding rows by one or more keys:");
  const { rowsByKey } = await table.findKeyRows((r) => r.sku, ["APL1", "EGG1"]);
  console.log(rowsByKey);
  // => {
  //      APL1: { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: "produce" } },
  //      EGG1: { _rowNumber: 5, id: 1002, sku: 'BAN1', name: 'Banana', quantity: 11, price: 1.50, department: "produce" } }
  //    }

  console.log("Counting rows:");
  const count = await table.countRows();
  console.log(count);
  // => 4

  console.log("Inserting a new row:");
  const { insertedRow } = await table.insertRow({
    id: 1005,
    sku: "BUT1",
    name: "Buttr", // notice the typo
    quantity: 15,
    price: 3.5,
    department: "dairy",
  });
  console.log(insertedRow);
  // => { _rowNumber: 6, id: 1005, sku: 'BUT1', name: 'Buttr', quantity: 15, price: 3.5, department: "dairy" }

  console.log("Updating an existing row:");
  const { updatedRow } = await table.updateRow((r) => r.sku === "BUT1", {
    name: "Butter",
  });
  console.log(updatedRow);
  // => { _rowNumber: 6, id: 1005, sku: 'BUT1', name: 'Butter', quantity: 15, price: 3.5, department: "dairy" }

  console.log("Deleting an existing row:");
  await table.deleteRow((r) => r.sku === "BUT1");
  // NOTE: throws if row not found
})();
