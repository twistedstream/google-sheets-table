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

  console.log("Get all rows:");
  const { rows: allRows } = await table.findRows();
  console.log(allRows);
  // => [
  //      { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: "produce" },
  //      { _rowNumber: 3, id: 1002, sku: 'BAN1', name: 'Banana', quantity: 11, price: 1.50, department: "produce" },
  //      { _rowNumber: 3, id: 1003, sku: 'TP1', name: 'Toilet paper', quantity: 99, price: 5.50, department: "home" },
  //      { _rowNumber: 5, id: 1004, sku: 'EGG1', name: 'Banana', quantity: 25, price: 2.50, department: "dairy" }
  //    ]

  console.log("Finding specific rows:");
  const { rows } = await table.findRows((r) => r.quantity < 50);
  console.log(rows);
  // => [
  //      { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: 'produce' },
  //      { _rowNumber: 3, id: 1002, sku: 'BAN1', name: 'Banana', quantity: 11, price: 1.5, department: 'produce' },
  //      { _rowNumber: 5, id: 1004, sku: 'EGG1', name: 'Eggs', quantity: 25, price: 2.5, department: 'dairy' }
  //    ]

  console.log("Finding rows and sorting them:");
  const { rows: sortedRows } = await table.findRows(
    (r) => r.quantity < 50,
    [{ asc: "department" }, { desc: "name" }]
  );
  console.log(sortedRows);
  // => [
  //      { _rowNumber: 5, id: 1004, sku: 'EGG1', name: 'Eggs', quantity: 25, price: 2.5, department: 'dairy' },
  //      { _rowNumber: 3, id: 1002, sku: 'BAN1', name: 'Banana', quantity: 11, price: 1.5, department: 'produce' },
  //      { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: 'produce' }
  //    ]

  console.log("Finding rows by one or more keys:");
  const { rowsByKey } = await table.findKeyRows((r) => r.sku, ["APL1", "EGG1"]);
  console.log(rowsByKey);
  // => {
  //      APL1: { _rowNumber: 2, id: 1001, sku: 'APL1', name: 'Apple', quantity: 10, price: 1.75, department: "produce" } },
  //      EGG1: { _rowNumber: 5, id: 1004, sku: 'EGG1', name: 'Banana', quantity: 25, price: 2.50, department: "dairy" } }
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

  console.log("Deleting an existing row");
  await table.deleteRow((r) => r.sku === "BUT1");
  // NOTE: throws if row not found
})();
