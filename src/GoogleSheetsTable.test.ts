import { cloneDeep, omit } from "lodash";
import sinon from "sinon";
import { t, Test } from "tap";

import { GoogleSheetsTable } from "./GoogleSheetsTable";
import { Row } from "./types";

// test objects
const trackStub = sinon.stub();
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
const row4: Row = { username: "spencer", age: 24, _rowNumber: 5 };
const allRows = [row1, row2, row3, row4];
const columns = ["username", "age"];

// helpers

function importModule(t: Test) {
  return t.mockRequire("./GoogleSheetsTable", {
    "./async-tracker": { track: trackStub },
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

t.test("GoogleSheetsTable", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  const { GoogleSheetsTable } = importModule(t);

  function createInstance({
    spreadsheetId = "spreadsheet-id",
    columnConstraints = {},
  } = {}): GoogleSheetsTable {
    const options = {
      credentials: {},
      spreadsheetId,
      sheetName: "bananas",
      columnConstraints,
    };

    return new GoogleSheetsTable(options);
  }

  t.test("constructor", async (t) => {
    t.test("sets the options", async (t) => {
      const options = {
        credentials: {},
        spreadsheetId: "spreadsheet-id",
        sheetName: "bananas",
      };

      const result = new GoogleSheetsTable(options);

      t.equal(result.options, options);
    });

    t.test("creates a Google Sheets client", async (t) => {
      const credentials = {};
      const options = {
        credentials,
        spreadsheetId: "spreadsheet-id",
        sheetName: "bananas",
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
        sheetName: "bananas",
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

  t.test("instance members", async (t) => {
    t.test("#countRows", async (t) => {
      const values = [
        ["first_name", "last_name", "age"],
        ["Bob", "Smith", 42],
        ["Jim", "Johnson", 24],
      ];

      t.test("when no data exists, returns zero", async (t) => {
        getValuesStub.resolves({ data: { values: undefined } });

        const target = createInstance();
        const result = await target.countRows();

        t.equal(result, 0);
      });

      t.test("when data exists, returns expected count", async (t) => {
        getValuesStub.resolves({ data: { values: cloneDeep(values) } });

        const target = createInstance();
        const result = await target.countRows();

        t.equal(result, 2);
      });
    });

    t.test("#findRows", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.findRows(() => true);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test(
        "if a search predicate is provided, returns expected subset of table rows",
        async (t) => {
          openTableStub.resolves({ rows: allRows });

          const target = createInstance();
          const result = await target.findRows((r: any) => r.age > 30);

          t.ok(result.rows);
          t.equal(result.rows.length, 2);
          t.equal(result.rows[0], row1);
          t.equal(result.rows[1], row3);
        },
      );

      t.test(
        "if no search predicate is provided, returns all table rows",
        async (t) => {
          openTableStub.resolves({ rows: allRows });

          const target = createInstance();
          const result = await target.findRows();

          t.ok(result.rows);
          t.equal(result.rows.length, 4);
          t.equal(result.rows[0], row1);
          t.equal(result.rows[1], row2);
          t.equal(result.rows[2], row3);
          t.equal(result.rows[3], row4);
        },
      );

      t.test(
        "if ascending search is specified with an unknown column, throws expected error",
        async (t) => {
          openTableStub.resolves({
            rows: allRows,
            columns,
          });

          const target = createInstance();
          t.rejects(async () => await target.findRows([{ asc: "foo" }]), {
            message: "Sort column does not exist: foo",
          });
        },
      );

      t.test(
        "if ascending search is specified, returns rows in expected order",
        async (t) => {
          openTableStub.resolves({
            rows: allRows,
            columns,
          });

          const target = createInstance();
          const result = await target.findRows([{ asc: "age" }]);

          t.ok(result.rows);
          t.equal(result.rows.length, 4);
          t.equal(result.rows[0], row2);
          t.equal(result.rows[1], row4);
          t.equal(result.rows[2], row3);
          t.equal(result.rows[3], row1);
        },
      );

      t.test(
        "if descending search is specified with an unknown column, throws expected error",
        async (t) => {
          openTableStub.resolves({
            rows: allRows,
            columns,
          });

          const target = createInstance();
          t.rejects(async () => await target.findRows([{ desc: "foo" }]), {
            message: "Sort column does not exist: foo",
          });
        },
      );

      t.test(
        "if descending search is specified, returns rows in expected order",
        async (t) => {
          openTableStub.resolves({
            rows: allRows,
            columns,
          });

          const target = createInstance();
          const result = await target.findRows([{ desc: "age" }]);

          t.ok(result.rows);
          t.equal(result.rows.length, 4);
          t.equal(result.rows[0], row1);
          t.equal(result.rows[1], row3);
          t.equal(result.rows[2], row2);
          t.equal(result.rows[3], row4);
        },
      );

      t.test(
        "if multiple search columns are specified, returns rows in expected order",
        async (t) => {
          openTableStub.resolves({
            rows: allRows,
            columns,
          });

          const target = createInstance();
          const result = await target.findRows([
            { asc: "age" },
            { desc: "username" },
          ]);

          t.ok(result.rows);
          t.equal(result.rows.length, 4);
          t.equal(result.rows[0], row4);
          t.equal(result.rows[1], row2);
          t.equal(result.rows[2], row3);
          t.equal(result.rows[3], row1);
        },
      );
    });

    t.test("#findRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.findRow(() => true);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("returns expected table row", async (t) => {
        openTableStub.resolves({ rows: allRows });

        const target = createInstance();
        const result = await target.findRow((r: any) => r.age > 30);

        t.ok(result.row);
        t.equal(result.row, row1);
      });
    });

    t.test("#findKeyRows", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.findKeyRows((r: any) => r.username, []);
        } catch {}

        t.ok(openTableStub.called);
        t.equal(openTableStub.firstCall.args[0], (target as any).sheets);
        t.equal(openTableStub.firstCall.args[1], "spreadsheet-id");
        t.equal(openTableStub.firstCall.args[2], "bananas");
      });

      t.test("returns expected rows by key", async (t) => {
        openTableStub.returns({ rows: allRows });

        const target = createInstance();
        const result = await target.findKeyRows(
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
          await target.insertRow({});
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
        const columnConstraints = {};

        const target = createInstance({ columnConstraints });
        try {
          await target.insertRow(newRow);
        } catch {}

        t.ok(enforceConstraintsStub.called);
        t.equal(enforceConstraintsStub.firstCall.args[0], rows);
        t.equal(enforceConstraintsStub.firstCall.args[1], newRow);
        t.equal(enforceConstraintsStub.firstCall.args[2], columnConstraints);
      });

      t.test(
        "converts the new row object to Google Sheets values",
        async (t) => {
          const columns: any = [];
          openTableStub.resolves({ columns });
          const newRow = {};

          const target = createInstance();
          try {
            await target.insertRow(newRow);
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
          await target.insertRow({});
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
            await target.insertRow({});
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
            await target.insertRow({});
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
        const result = await target.insertRow({});

        t.ok(result);
        t.equal(result.insertedRow, insertedRow);
      });
    });

    t.test("#updateRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.updateRow(() => true, {});
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
          await target.updateRow(predicate, {});
        } catch {}

        t.ok(rows.find.called);
        t.equal(rows.find.firstCall.firstArg, predicate);
      });

      t.test("if row isn't found, throws expected error", async (t) => {
        const rows = { find: sinon.fake.returns(undefined) };
        openTableStub.resolves({ rows });

        const target = createInstance();
        t.rejects(() => target.updateRow(() => true, {}), {
          message: "Row not found",
        });
      });

      t.test("when row exists", async (t) => {
        let existingRow: any;
        let rows: any;
        const columns: any = [];

        t.beforeEach(async () => {
          existingRow = {
            first_name: "Bob",
            last_name: "S",
            age: 42,
            _rowNumber: 7,
          };
          rows = { find: sinon.fake.returns(existingRow) };
          openTableStub.resolves({ columns, rows });
        });

        t.test(
          "enforces column constraints against the updated row",
          async (t) => {
            const columnConstraints = {};

            const target = createInstance({ columnConstraints });
            try {
              await target.updateRow(() => true, {});
            } catch {}

            t.ok(enforceConstraintsStub.called);
            t.equal(enforceConstraintsStub.firstCall.args[0], rows);
            t.equal(enforceConstraintsStub.firstCall.args[1], existingRow);
            t.equal(
              enforceConstraintsStub.firstCall.args[2],
              columnConstraints,
            );
          },
        );

        t.test(
          "removes metadata properties from the updated row and converts it to Google Sheets values",
          async (t) => {
            const rowUpdates = { last_name: "Smith" };

            const target = createInstance();
            try {
              await target.updateRow(() => true, rowUpdates);
            } catch {}

            t.ok(rowToValuesStub.called);
            t.same(rowToValuesStub.firstCall.args[0], {
              first_name: "Bob",
              last_name: "Smith",
              age: 42,
            });
            t.equal(rowToValuesStub.firstCall.args[1], columns);
          },
        );

        t.test("updates the row in Google Sheets", async (t) => {
          const rowValues: any = [];
          rowToValuesStub.returns(rowValues);

          const target = createInstance();
          try {
            await target.updateRow(() => true, {});
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
              await target.updateRow(() => true, {});
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
              await target.updateRow(() => true, {});
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
          const result = await target.updateRow(() => true, {});

          t.ok(result);
          t.equal(result.updatedRow, updatedRow);
        });
      });
    });

    t.test("#deleteRow", async (t) => {
      t.test("opens a table", async (t) => {
        const target = createInstance();
        try {
          await target.deleteRow(() => true);
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
          await target.deleteRow(predicate);
        } catch {}

        t.ok(rows.find.called);
        t.equal(rows.find.firstCall.firstArg, predicate);
      });

      t.test("if row isn't found, throws expected error", async (t) => {
        const rows = { find: sinon.fake.returns(undefined) };
        openTableStub.resolves({ rows });

        const target = createInstance();
        t.rejects(() => target.deleteRow(() => true), {
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
            await target.deleteRow(() => true);
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
            t.rejects(() => target.deleteRow(() => true), {
              message: "Sheet with name 'bananas' not found",
            });
          },
        );

        t.test(
          "when the sheet exists, deletes the row in Google Sheets",
          async (t) => {
            const sheet = {
              properties: { title: "bananas", sheetId: "sheet-id" },
            };
            getSpreadsheetStub.resolves({ data: { sheets: [sheet] } });

            const target = createInstance();
            await target.deleteRow(() => true);

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
  });

  t.test("concurrency behavior", async (t) => {
    async function sleep(duration: number) {
      return new Promise((resolve) => setTimeout(resolve, duration));
    }

    const doNothing = () => undefined;

    function createFakes(labels: string[], calls: string[]) {
      labels.forEach((label, index) => {
        // early fakes have longer sleep durations
        const sleepDuration = (labels.length - index) * 10; //ms

        trackStub.onCall(index).callsFake(async () => {
          await sleep(sleepDuration);
          calls.push(label);
        });
      });
    }

    t.test(
      "read-only methods DO NOT serialize (across methods of the same instance, multiple instances, or multiple spreadsheets)",
      async (t) => {
        // test across multiple instances and spreadsheets
        const target1 = createInstance({ spreadsheetId: "spreadsheet1" });
        const target2 = createInstance({ spreadsheetId: "spreadsheet1" });
        const target3 = createInstance({ spreadsheetId: "spreadsheet2" });

        // force early calls take longer than later calls
        const labels = "abcdefghijkl".split("");
        const calls: any = [];
        createFakes(labels, calls);

        await Promise.all([
          target1.countRows().catch(doNothing),
          target2.countRows().catch(doNothing),
          target3.countRows().catch(doNothing),
          target1.findRows(() => true).catch(doNothing),
          target2.findRows(() => true).catch(doNothing),
          target3.findRows(() => true).catch(doNothing),
          target1.findRow(() => true).catch(doNothing),
          target2.findRow(() => true).catch(doNothing),
          target3.findRow(() => true).catch(doNothing),
          target1.findKeyRows((r: any) => r.username, []).catch(doNothing),
          target2.findKeyRows((r: any) => r.username, []).catch(doNothing),
          target3.findKeyRows((r: any) => r.username, []).catch(doNothing),
        ]);

        // calls should complete in reverse order (no serialization)
        const expected = [...labels].reverse();
        t.same(calls, expected, `expected call order: ${expected}`);
      },
    );

    t.test(
      "write methods DO serialize within methods of the same instance or same spreadsheet",
      async (t) => {
        // test across multiple instances, but same spreadsheet
        const target1 = createInstance({ spreadsheetId: "spreadsheet1" });
        const target2 = createInstance({ spreadsheetId: "spreadsheet1" });

        // force early calls take longer than later calls
        const labels = "abcdef".split("");
        const calls: any = [];
        createFakes(labels, calls);

        await Promise.all([
          target1.insertRow({}).catch(doNothing),
          target2.insertRow({}).catch(doNothing),
          target1.updateRow(() => true, {}).catch(doNothing),
          target2.updateRow(() => true, {}).catch(doNothing),
          target1.deleteRow(() => true).catch(doNothing),
          target2.deleteRow(() => true).catch(doNothing),
        ]);

        // calls should complete in same order they were made (serialization)
        const expected = [...labels];
        t.same(calls, expected, `expected call order: ${expected}`);
      },
    );

    t.test("write methods DO NOT serialize across spreadsheets", async (t) => {
      // test across multiple instances, each with its own spreadsheet
      const target1 = createInstance({ spreadsheetId: "spreadsheet1" });
      const target2 = createInstance({ spreadsheetId: "spreadsheet2" });
      const target3 = createInstance({ spreadsheetId: "spreadsheet3" });

      // force early calls take longer than later calls
      const labels = "abc".split("");
      const calls: any = [];
      createFakes(labels, calls);

      await Promise.all([
        target1.insertRow({}).catch(doNothing),
        target2.insertRow({}).catch(doNothing),
        target3.insertRow({}).catch(doNothing),
      ]);

      // calls should complete in reverse order (no serialization)
      const expected = [...labels].reverse();
      t.same(calls, expected, `expected call order: ${expected}`);
    });
  });
});
