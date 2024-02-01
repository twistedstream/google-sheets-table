import { test } from "tap";

import { ErrorWithData, assertValue } from "./error";

test("error", async (t) => {
  t.test("ErrorWithData", async (t) => {
    t.test("#constructor", async (t) => {
      t.test("creates expected error", async (t) => {
        const data = { foo: "bar" };
        const error = new ErrorWithData("Some message", data);

        t.equal(error.message, `Some message {"foo":"bar"}`);
        t.equal(error.data, data);
      });
    });
  });

  t.test("#assertValue", async (t) => {
    t.test("throws if value is undefined", async (t) => {
      t.throws(() => assertValue(undefined), {
        message: "Unexpected undefined value",
      });
    });

    t.test("throws if value is null", async (t) => {
      t.throws(() => assertValue(null), { message: "Unexpected null value" });
    });

    t.test("throws optional custom error message", async (t) => {
      t.throws(() => assertValue(null, "BOOM!"), { message: "BOOM!" });
    });

    t.test("returns real value", async (t) => {
      const value = {};

      const result = assertValue(value);

      t.equal(result, value);
    });
  });
});
