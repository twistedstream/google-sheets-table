import { cloneDeep, omit } from "lodash";
import sinon from "sinon";
import { test } from "tap";

import { GoogleSheetsTable } from "./GoogleSheetsTable";
import { Row } from "./types";

// test objects
const getValuesStub = sinon.stub();
const appendValuesStub = sinon.stub();
const updateValuesStub = sinon.stub();
const getSpreadsheetStub = sinon.stub();
const batchUpdateSpreadsheetStub = sinon.stub();

const sheetsClient = {
  spreadsheets: {
    values: {
      get: getValuesStub,
      append: appendValuesStub,
      update: updateValuesStub,
    },
    get: getSpreadsheetStub,
    batchUpdate: batchUpdateSpreadsheetStub,
  },
};
const createClientStub = sinon.fake.returns(sheetsClient);

const processUpdatedDataStub = sinon.stub();
const rowToValuesStub = sinon.stub();
const valuesToRowStub = sinon.stub();
const enforceConstraintsStub = sinon.stub();
const openTableStub = sinon.stub();

const row1: Row = { username: "jim", age: 42, _rowNumber: 2 };
const row2: Row = { username: "bob", age: 24, _rowNumber: 3 };
const row3: Row = { username: "mary", age: 32, _rowNumber: 4 };

// helpers

function importModule(test: Tap.Test) {
  return test.mock("./GoogleSheetsTable", {
    "./client": {
      createClient: createClientStub,
    },
    "./row": {
      processUpdatedData: processUpdatedDataStub,
      rowToValues: rowToValuesStub,
      valuesToRow: valuesToRowStub,
    },
    "./table": {
      enforceConstraints: enforceConstraintsStub,
      openTable: openTableStub,
    },
  });
}

// tests

test("GoogleSheetsTable", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  const { GoogleSheetsTable } = importModule(t);

  t.test("constructor", async (t) => {
    t.test("sets the options", async (t) => {
      const options = {
        credentials: {},
        spreadsheetId: "spreadsheet-id",
      };

      const result = new GoogleSheetsTable(options);

      t.equal(result.options, options);
    });

    t.test("creates a Google Sheets client", async (t) => {
      const credentials = {};
      const options = {
        credentials,
        spreadsheetId: "spreadsheet-id",
      };

      const result = new GoogleSheetsTable(options);

      t.ok(createClientStub.called);
      t.equal(createClientStub.firstCall.firstArg, credentials);
      t.equal(result.sheets, sheetsClient);
    });

    t.test("sets the common Google Sheets params", async (t) => {
      const options = {
        credentials: {},
        spreadsheetId: "spreadsheet-id",
      };

      const result = new GoogleSheetsTable(options);

      t.same(result.commonGoogleSheetsParams, {
        spreadsheetId: "spreadsheet-id",
        valueInputOption: "RAW",
        includeValuesInResponse: true,
        responseValueRenderOption: "UNFORMATTED_VALUE",
        responseDateTimeRenderOption: "SERIAL_NUMBER",
      });
    });
  });

  t.test("instance methods", async (t) => {
    function createInstance(): GoogleSheetsTable {
      const { GoogleSheetsTable } = importModule(t);

      const options = {
        credentials: {},
        spreadsheetId: "spreadsheet-id",
      };

      return new GoogleSheetsTable(options);
    }

    t.test("#countRows", async (t) => {
      const values = [
        ["first_name", "last_name", "age"],
        ["Bob", "Smith", 42],
        ["Jim", "Johnson", 24],
      ];

      t.test("when no data exists, returns zero", async (t) => {
        getValuesStub.resolves({ data: { values: undefined } });

        const target = createInstance();
        const result = await target.countRows("bananas");

        t.equal(result, 0);
      });

      t.test("when data exists, returns expected count", async (t) => {
        getValuesStub.resolves({ data: { values: cloneDeep(values) } });

        const target = createInstance();
        const result = await target.countRows("bananas");

        t.equal(result, 2);
      });
    });

    t.test("#findRows", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.findRows("bananas", () => true);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("returns expected table rows", async (t) => {
        openTableStub.resolves({ rows: [row1, row2, row3] });

        const target = createInstance();
        const result = await target.findRows("bananas", (r: any) => r.age > 30);

        t.ok(result.rows);
        t.equal(result.rows.length, 2);
        t.equal(result.rows[0], row1);
        t.equal(result.rows[1], row3);
      });
    });

    t.test("#findRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.findRow("bananas", () => true);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("returns expected table row", async (t) => {
        openTableStub.resolves({ rows: [row1, row2, row3] });

        const target = createInstance();
        const result = await target.findRow("bananas", (r: any) => r.age > 30);

        t.ok(result.row);
        t.equal(result.row, row1);
      });
    });

    t.test("#findKeyRows", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.findKeyRows("bananas", (r: any) => r.username, []);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("returns expected rows by key", async (t) => {
        openTableStub.returns({ rows: [row1, row2, row3] });

        const target = createInstance();
        const result = await target.findKeyRows(
          "bananas",
          (r: any) => r.username,
          ["jim", "mary"],
        );

        t.ok(result);
        t.same(Object.keys(result.rowsByKey), ["jim", "mary"]);
        t.equal(result.rowsByKey["jim"], row1);
        t.equal(result.rowsByKey["mary"], row3);
      });
    });

    t.test("#insertRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.insertRow("bananas", {}, {});
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("enforces column constraints", async (t) => {
        const rows: any = [];
        openTableStub.resolves({ rows });
        const newRow = {};
        const constraints = {};

        const target = createInstance();
        try {
          await target.insertRow("bananas", newRow, constraints);
        } catch {}

        t.ok(enforceConstraintsStub.called);
        t.equal(enforceConstraintsStub.firstCall.args[0], rows);
        t.equal(enforceConstraintsStub.firstCall.args[1], newRow);
        t.equal(enforceConstraintsStub.firstCall.args[2], constraints);
      });

      t.test(
        "converts the new row object to Google Sheets values",
        async (t) => {
          const columns: any = [];
          openTableStub.resolves({ columns });
          const newRow = {};

          const target = createInstance();
          try {
            await target.insertRow("bananas", newRow, {});
          } catch {}

          t.ok(rowToValuesStub.called);
          t.equal(rowToValuesStub.firstCall.args[0], newRow);
          t.equal(rowToValuesStub.firstCall.args[1], columns);
        },
      );

      t.test("appends the new row in Google Sheets", async (t) => {
        const columns: any = [];
        openTableStub.resolves({ columns });
        const rowValues: any = [];
        rowToValuesStub.returns(rowValues);

        const target = createInstance();
        try {
          await target.insertRow("bananas", {}, {});
        } catch {}

        t.ok(appendValuesStub.called);
        const options = appendValuesStub.firstCall.firstArg;
        t.same(omit(options, "requestBody"), {
          spreadsheetId: "spreadsheet-id",
          range: "bananas",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          includeValuesInResponse: true,
          responseValueRenderOption: "UNFORMATTED_VALUE",
          responseDateTimeRenderOption: "SERIAL_NUMBER",
        });
        const values = options?.requestBody?.values;
        t.ok(values);
        t.equal(values.length, 1);
        t.equal(values[0], rowValues);
      });

      t.test(
        "processes the updated data returned from Google Sheets",
        async (t) => {
          const columns: any = [];
          openTableStub.resolves({ columns });
          const rowValues: any = [];
          rowToValuesStub.returns(rowValues);
          const updatedData = {};
          appendValuesStub.resolves({ data: { updates: { updatedData } } });

          const target = createInstance();
          try {
            await target.insertRow("bananas", {}, {});
          } catch {}

          t.ok(processUpdatedDataStub.called);
          t.equal(processUpdatedDataStub.firstCall.args[0], updatedData);
          t.equal(processUpdatedDataStub.firstCall.args[1], "bananas");
          t.equal(processUpdatedDataStub.firstCall.args[2], rowValues);
        },
      );

      t.test(
        "converts the returned new row data back into a row object",
        async (t) => {
          const columns: any = [];
          openTableStub.resolves({ columns });
          const rowValues: any = [];
          rowToValuesStub.returns(rowValues);
          const updatedData = {};
          appendValuesStub.resolves({ data: { updates: { updatedData } } });
          const updatedRowValues: any = [];
          const updatedRowNumber = 7;
          processUpdatedDataStub.returns({
            updatedRowValues,
            updatedRowNumber,
          });

          const target = createInstance();
          try {
            await target.insertRow("bananas", {}, {});
          } catch {}

          t.ok(valuesToRowStub.called);
          t.equal(valuesToRowStub.firstCall.args[0], updatedRowValues);
          t.equal(valuesToRowStub.firstCall.args[1], columns);
          t.equal(valuesToRowStub.firstCall.args[2], updatedRowNumber);
        },
      );

      t.test("returns the inserted row", async (t) => {
        const columns: any = [];
        openTableStub.resolves({ columns });
        const rowValues: any = [];
        rowToValuesStub.returns(rowValues);
        const updatedData = {};
        appendValuesStub.resolves({ data: { updates: { updatedData } } });
        const updatedRowValues: any = [];
        const updatedRowNumber = 7;
        processUpdatedDataStub.returns({ updatedRowValues, updatedRowNumber });
        const insertedRow = {};
        valuesToRowStub.returns(insertedRow);

        const target = createInstance();
        const result = await target.insertRow("bananas", {}, {});

        t.ok(result);
        t.equal(result.insertedRow, insertedRow);
      });
    });

    t.test("#updateRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.updateRow("bananas", () => true, {}, {});
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("finds the row to update", async (t) => {
        const rows = { find: sinon.stub() };
        openTableStub.resolves({ rows });
        const predicate = () => true;

        const target = createInstance();
        try {
          await target.updateRow("bananas", predicate, {}, {});
        } catch {}

        t.ok(rows.find.called);
        t.equal(rows.find.firstCall.firstArg, predicate);
      });

      t.test("if row isn't found, throws expected error", async (t) => {
        const rows = { find: sinon.fake.returns(undefined) };
        openTableStub.resolves({ rows });

        const target = createInstance();
        t.rejects(() => target.updateRow("bananas", () => true, {}, {}), {
          message: "Row not found",
        });
      });

      t.test("when row exists", async (t) => {
        let existingRow: any;
        let rows: any;
        const columns: any = [];

        t.beforeEach(async () => {
          existingRow = {};
          rows = { find: sinon.fake.returns(existingRow) };
          openTableStub.resolves({ columns, rows });
        });

        t.test("enforces column constraints", async (t) => {
          const constraints = {};

          const target = createInstance();
          try {
            await target.updateRow("bananas", () => true, {}, constraints);
          } catch {}

          t.ok(enforceConstraintsStub.called);
          t.equal(enforceConstraintsStub.firstCall.args[0], rows);
          t.equal(enforceConstraintsStub.firstCall.args[1], existingRow);
          t.equal(enforceConstraintsStub.firstCall.args[2], constraints);
        });

        t.test(
          "the existing row has been updated and converted to Google Sheets values",
          async (t) => {
            const rowUpdates = { foo: "bar", baz: 42 };

            const target = createInstance();
            try {
              await target.updateRow("bananas", () => true, rowUpdates, {});
            } catch {}

            t.same(existingRow, rowUpdates);
            t.ok(rowToValuesStub.called);
            t.equal(rowToValuesStub.firstCall.args[0], existingRow);
            t.equal(rowToValuesStub.firstCall.args[1], columns);
          },
        );

        t.test("updates the row in Google Sheets", async (t) => {
          const rowValues: any = [];
          rowToValuesStub.returns(rowValues);
          existingRow._rowNumber = 7;

          const target = createInstance();
          try {
            await target.updateRow("bananas", () => true, {}, {});
          } catch {}

          t.ok(updateValuesStub.called);
          const options = updateValuesStub.firstCall.firstArg;
          t.same(omit(options, "requestBody"), {
            spreadsheetId: "spreadsheet-id",
            range: "bananas!7:7",
            valueInputOption: "RAW",
            includeValuesInResponse: true,
            responseValueRenderOption: "UNFORMATTED_VALUE",
            responseDateTimeRenderOption: "SERIAL_NUMBER",
          });
          const values = options?.requestBody?.values;
          t.ok(values);
          t.equal(values.length, 1);
          t.equal(values[0], rowValues);
        });

        t.test(
          "processes the updated data returned from Google Sheets",
          async (t) => {
            const rowValues: any = [];
            rowToValuesStub.returns(rowValues);
            const updatedData = {};
            updateValuesStub.resolves({ data: { updatedData } });

            const target = createInstance();
            try {
              await target.updateRow("bananas", () => true, {}, {});
            } catch {}

            t.ok(processUpdatedDataStub.called);
            t.equal(processUpdatedDataStub.firstCall.args[0], updatedData);
            t.equal(processUpdatedDataStub.firstCall.args[1], "bananas");
            t.equal(processUpdatedDataStub.firstCall.args[2], rowValues);
          },
        );

        t.test(
          "converts the returned new row data back into a row object",
          async (t) => {
            const updatedData = {};
            updateValuesStub.resolves({ data: { updatedData } });
            const updatedRowValues: any = [];
            const updatedRowNumber = 7;
            processUpdatedDataStub.returns({
              updatedRowValues,
              updatedRowNumber,
            });

            const target = createInstance();
            try {
              await target.updateRow("bananas", () => true, {}, {});
            } catch {}

            t.ok(valuesToRowStub.called);
            t.equal(valuesToRowStub.firstCall.args[0], updatedRowValues);
            t.equal(valuesToRowStub.firstCall.args[1], columns);
            t.equal(valuesToRowStub.firstCall.args[2], updatedRowNumber);
          },
        );

        t.test("returns the updated row", async (t) => {
          const updatedData = {};
          updateValuesStub.resolves({ data: { updatedData } });
          const updatedRowValues: any = [];
          const updatedRowNumber = 7;
          processUpdatedDataStub.returns({
            updatedRowValues,
            updatedRowNumber,
          });
          const updatedRow = {};
          valuesToRowStub.returns(updatedRow);

          const target = createInstance();
          const result = await target.updateRow("bananas", () => true, {}, {});

          t.ok(result);
          t.equal(result.updatedRow, updatedRow);
        });
      });
    });

    t.test("#deleteRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.deleteRow("bananas", () => true);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("finds the row to delete", async (t) => {
        const rows = { find: sinon.stub() };
        openTableStub.resolves({ rows });
        const predicate = () => true;

        const target = createInstance();
        try {
          await target.deleteRow("bananas", predicate);
        } catch {}

        t.ok(rows.find.called);
        t.equal(rows.find.firstCall.firstArg, predicate);
      });

      t.test("if row isn't found, throws expected error", async (t) => {
        const rows = { find: sinon.fake.returns(undefined) };
        openTableStub.resolves({ rows });

        const target = createInstance();
        t.rejects(() => target.deleteRow("bananas", () => true), {
          message: "Row not found",
        });
      });

      t.test("when row exists", async (t) => {
        const existingRow = { _rowNumber: 7 };
        let rows: any;

        t.beforeEach(async () => {
          rows = { find: sinon.fake.returns(existingRow) };
          openTableStub.resolves({ rows });
        });

        t.test("gets the spreadsheet object from Google Sheets", async (t) => {
          const target = createInstance();
          try {
            await target.deleteRow("bananas", () => true);
          } catch {}

          t.ok(getSpreadsheetStub.called);
          t.same(getSpreadsheetStub.firstCall.firstArg, {
            spreadsheetId: "spreadsheet-id",
          });
        });

        t.test(
          "if the corresponding sheet isn't found within the spreadsheet, throws expected error",
          async (t) => {
            getSpreadsheetStub.resolves({ data: { sheets: [] } });

            const target = createInstance();
            t.rejects(() => target.deleteRow("bananas", () => true), {
              message: "Sheet with name 'bananas' not found",
            });
          },
        );

        t.test(
          "when the sheet exists, deletes the row in Google Sheets",
          async (t) => {
            const sheet = {
              properties: { title: "bananas", index: "sheet-id" },
            };
            getSpreadsheetStub.resolves({ data: { sheets: [sheet] } });

            const target = createInstance();
            await target.deleteRow("bananas", () => true);

            t.ok(batchUpdateSpreadsheetStub.called);
            t.same(batchUpdateSpreadsheetStub.firstCall.firstArg, {
              spreadsheetId: "spreadsheet-id",
              requestBody: {
                requests: [
                  {
                    deleteDimension: {
                      range: {
                        sheetId: "sheet-id",
                        dimension: "ROWS",
                        startIndex: 6,
                        endIndex: 7,
                      },
                    },
                  },
                ],
              },
            });
          },
        );
      });
    });

    t.test("atomic behavior", async (t) => {
      async function waitForNextLoop() {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const doNothing = () => undefined;

      t.test("read-only functions don't serialize", async (t) => {
        const target = createInstance();

        // force previous calls to happen after latter calls
        getValuesStub.onFirstCall().callsFake(async () => {
          await waitForNextLoop();
          await waitForNextLoop();
          await waitForNextLoop();
        });
        openTableStub.onCall(0).callsFake(async () => {
          await waitForNextLoop();
          await waitForNextLoop();
        });
        openTableStub.onCall(1).callsFake(async () => {
          await waitForNextLoop();
        });
        openTableStub.onCall(2).resolves();

        const calls: any = [];
        await Promise.all([
          target
            .countRows("bananas")
            .catch(doNothing)
            .then(() => calls.push("first")),
          target
            .findRows("bananas", () => true)
            .catch(doNothing)
            .then(() => calls.push("second")),
          target
            .findRow("bananas", () => true)
            .catch(doNothing)
            .then(() => calls.push("third")),
          target
            .findKeyRows("bananas", (r: any) => r.username, [])
            .catch(doNothing)
            .then(() => calls.push("fourth")),
        ]);

        t.same(calls, ["fourth", "third", "second", "first"]);
      });

      t.test("write functions do serialize", async (t) => {
        const target = createInstance();

        // force previous calls to happen after latter calls
        openTableStub.onCall(0).callsFake(async () => {
          await waitForNextLoop();
          await waitForNextLoop();
        });
        openTableStub.onCall(1).callsFake(async () => {
          await waitForNextLoop();
        });
        openTableStub.onCall(2).resolves();

        const calls: any = [];
        await Promise.all([
          target
            .insertRow("bananas", {})
            .catch(doNothing)
            .then(() => calls.push("first")),
          target
            .updateRow("bananas", () => true, {})
            .catch(doNothing)
            .then(() => calls.push("second")),
          target
            .deleteRow("bananas", () => true)
            .catch(doNothing)
            .then(() => calls.push("third")),
        ]);

        t.same(calls, ["first", "second", "third"]);
      });
    });
  });
});
