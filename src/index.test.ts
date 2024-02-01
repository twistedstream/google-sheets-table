import sinon from "sinon";
import { test } from "tap";

class MockGoogleSheetsTable {}

function importModule(test: Tap.Test) {
  return test.mock("./index", {
    "./GoogleSheetsTable": {
      GoogleSheetsTable: MockGoogleSheetsTable,
    },
  });
}

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
  });
});
