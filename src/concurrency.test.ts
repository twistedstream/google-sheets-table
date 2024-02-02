import sinon from "sinon";
import { test } from "tap";

// test objects

const mockMutexConstructorFake = sinon.fake();
const runExclusiveStub = sinon.stub();

class MockMutex {
  constructor() {
    mockMutexConstructorFake();
  }

  async runExclusive<T>(worker: () => T): Promise<T> {
    return runExclusiveStub(worker);
  }
}

// helpers

function importModule(test: Tap.Test) {
  return test.mock("./concurrency", {
    "async-mutex": { Mutex: MockMutex },
  });
}

// tests

test("concurrency", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  t.test("#lock", async (t) => {
    t.test("creates a new mutex", async (t) => {
      const { lock } = importModule(t);

      await lock("spreadsheet-id", () => 42);

      t.ok(mockMutexConstructorFake.called);
    });

    t.test("runs the worker concurrently with the mutex", async (t) => {
      const { lock } = importModule(t);
      const worker = () => 42;

      await lock("spreadsheet-id", worker);

      t.ok(runExclusiveStub.called);
      t.equal(runExclusiveStub.firstCall.firstArg, worker);
    });

    t.test("returns the concurrent worker result", async (t) => {
      const { lock } = importModule(t);
      const workerResult = {};
      runExclusiveStub.resolves(workerResult);

      const result = await lock("spreadsheet-id", () => 42);

      t.equal(result, workerResult);
    });

    t.test("reuses the same mutex with the same spreadsheet", async (t) => {
      const { lock } = importModule(t);

      await lock("spreadsheet1", () => 42);
      await lock("spreadsheet1", () => 42);

      const calls = mockMutexConstructorFake.getCalls();
      t.equal(calls.length, 1);
    });

    t.test("creates a unique mutex with each spreadsheet", async (t) => {
      const { lock } = importModule(t);

      await lock("spreadsheet1", () => 42);
      await lock("spreadsheet2", () => 42);
      await lock("spreadsheet3", () => 42);

      const calls = mockMutexConstructorFake.getCalls();
      t.equal(calls.length, 3);
    });
  });
});
