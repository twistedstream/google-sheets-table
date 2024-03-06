import { test } from "tap";

import { ConstraintViolationsError, ErrorWithData, assertValue } from "./error";
import { ConstraintViolation } from "./types";

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

  t.test("ConstraintViolationsError", async (t) => {
    t.test("#constructor", async (t) => {
      t.test("creates expected error", async (t) => {
        const violations: ConstraintViolation[] = [
          { type: "unique", description: "A row already exists with id = 42" },
          { type: "unique", description: "A row already exists with foo = 24" },
        ];
        const error = new ConstraintViolationsError(violations);

        t.equal(
          error.message,
          `There are constraint violations:
A row already exists with id = 42
A row already exists with foo = 24`,
        );
        t.equal(error.violations, violations);
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
