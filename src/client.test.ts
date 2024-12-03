import sinon from "sinon";
import { t, Test } from "tap";

// test objects

const mockGoogleAuthConstructorFake = sinon.fake();
class MockGoogleAuth {
  constructor(options: any) {
    mockGoogleAuthConstructorFake(options);

    this.isMock = true;
  }

  isMock: boolean;
}

const sheetsClientMock = {};
const sheetsFake = sinon.fake.returns(sheetsClientMock);

// helpers

function importModule(t: Test) {
  return t.mockRequire("./client", {
    "google-auth-library": {
      GoogleAuth: MockGoogleAuth,
    },
    "@googleapis/sheets": {
      sheets: sheetsFake,
    },
  });
}

t.test("client", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  t.test("#createClient", async (t) => {
    const { createClient } = importModule(t);

    t.test("creates a new GoogleAuth object", async (t) => {
      const credentials = {};

      try {
        createClient(credentials);
      } catch {}

      t.ok(mockGoogleAuthConstructorFake.called);
      t.equal(
        mockGoogleAuthConstructorFake.firstCall.firstArg.credentials,
        credentials,
      );
      t.same(mockGoogleAuthConstructorFake.firstCall.firstArg.scopes, [
        "https://www.googleapis.com/auth/spreadsheets",
      ]);
    });

    t.test("calls the Google sheets factory function", async (t) => {
      try {
        createClient({});
      } catch {}

      t.ok(sheetsFake.called);
      t.ok(sheetsFake.firstCall.firstArg.auth.isMock);
      t.equal(sheetsFake.firstCall.firstArg.version, "v4");
    });

    t.test("returns the Google sheets client object", async (t) => {
      const result = createClient({});

      t.equal(result, sheetsClientMock);
    });
  });
});
