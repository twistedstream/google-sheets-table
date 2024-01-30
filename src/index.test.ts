import sinon from "sinon";
import { test } from "tap";

function importModule(test: Tap.Test) {
  return test.mock("./index", {
    // FUTURE: dependencies
  });
}

test("index", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  t.test("#hello", async (t) => {
    const { hello } = importModule(t);

    t.test("returns expected message", async (t) => {
      const result = hello();

      t.match(result, "Greetings");
    });
  });
});
