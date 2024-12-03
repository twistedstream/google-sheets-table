import sinon from "sinon";
import { t, Test } from "tap";

// test objects

class MockGoogleSheetsTable {}
class MockConstraintViolationsError {}

// helpers

function importModule(t: Test) {
  return t.mockRequire("./index", {
    "./GoogleSheetsTable": {
      GoogleSheetsTable: MockGoogleSheetsTable,
    },
    "./error": {
      ConstraintViolationsError: MockConstraintViolationsError,
    },
  });
}

// tests

t.test("index", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  t.test("exports", async (t) => {
    const { GoogleSheetsTable, ConstraintViolationsError } = importModule(t);

    t.test("GoogleSheetsTable", async (t) => {
      t.equal(GoogleSheetsTable, MockGoogleSheetsTable);
    });

    t.test("ConstraintViolationsError", async (t) => {
      t.equal(ConstraintViolationsError, MockConstraintViolationsError);
    });

    // NOTE: you cannot test exported types in this way because
    //       they don't exist at runtime
  });
});
