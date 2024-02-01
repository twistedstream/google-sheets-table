import sinon from "sinon";
import { test } from "tap";

// test objects

class MockGoogleSheetsTable {}

// helpers

function importModule(test: Tap.Test) {
  return test.mock("./index", {
    "./GoogleSheetsTable": {
      GoogleSheetsTable: MockGoogleSheetsTable,
    },
  });
}

// tests

test("index", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  t.test("exports", async (t) => {
    const { GoogleSheetsTable } = importModule(t);

    t.test("GoogleSheetsTable", async (t) => {
      t.equal(GoogleSheetsTable, MockGoogleSheetsTable);
    });

    // NOTE: you cannot test exported types in this way because
    //       they don't exist at runtime
  });
});
