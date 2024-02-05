import sinon from "sinon";
import { test } from "tap";

// test objects

const parseRangeStub = sinon.stub();

// helpers

function importModule(test: Tap.Test) {
  return test.mock("./row", {
    "./range": {
      parseRange: parseRangeStub,
    },
  });
}

test("row", async (t) => {
  t.beforeEach(async () => {
    sinon.resetBehavior();
    sinon.resetHistory();
  });

  t.test("#valuesToRow", async (t) => {
    const { valuesToRow } = importModule(t);

    t.test(
      "builds expected row object from Google sheets values",
      async (t) => {
        const result = valuesToRow(
          ["bob", "smith", 42],
          ["first_name", "last_name", "age"],
          7
        );

        t.match(result, {
          first_name: "bob",
          last_name: "smith",
          age: 42,
          _rowNumber: 7,
        });
      }
    );
  });

  t.test("#rowToValues", async (t) => {
    const { rowToValues } = importModule(t);

    t.test(
      "if row properties exist without equivalent columns, throws expected error",
      async (t) => {
        t.throws(
          () =>
            rowToValues(
              {
                first_name: "bob",
                last_name: "smith",
                age: 42,
              },
              ["last_name", "favorite_color"],
              7
            ),
          {
            message:
              "Table columns missing that exist as row properties: first_name, age",
          }
        );
      }
    );

    t.test(
      "builds expected Google sheets values from row object",
      async (t) => {
        const result = rowToValues(
          {
            first_name: "bob",
            last_name: "smith",
            age: 42,
          },
          ["first_name", "last_name", "age"],
          7
        );

        t.match(result, ["bob", "smith", 42]);
      }
    );
  });

  t.test("#processUpdatedData", async (t) => {
    const submittedRowValues = ["bob", "smith", 42];

    const { processUpdatedData } = importModule(t);

    t.test("if no range, throw expected error", async (t) => {
      t.throws(
        () =>
          processUpdatedData(
            { range: undefined, values: [] },
            "bananas",
            submittedRowValues
          ),
        {
          message: "Updated value range has empty range",
        }
      );
    });

    t.test("if no values, throw expected error", async (t) => {
      t.throws(
        () =>
          processUpdatedData(
            { range: "range-value-ignored", values: undefined },
            "bananas",
            submittedRowValues
          ),
        {
          message: "Updated value range has empty values",
        }
      );
    });

    t.test("if not a single row of values, throw expected error", async (t) => {
      t.throws(
        () =>
          processUpdatedData(
            { range: "range-value-ignored", values: [[], [], []] },
            "bananas",
            submittedRowValues
          ),
        {
          message: "Expected one row of values, but instead got 3",
        }
      );
    });

    t.test(
      "when comparing submitted values with updated row values",
      async (t) => {
        t.test(
          "if a pair of values aren't equal, throw expected error",
          async (t) => {
            t.throws(
              () =>
                processUpdatedData(
                  {
                    range: "range-value-ignored",
                    values: [["Bob", "smith", 43]],
                  },
                  "bananas",
                  submittedRowValues
                ),
              {
                message:
                  "One or more updated row values don't match corresponding submitted values",
                data: [
                  { submitted: "bob", updated: "Bob" },
                  true,
                  { submitted: 42, updated: 43 },
                ],
              }
            );
          }
        );

        t.test(
          "a pair of values are considered equal if the submitted value is undefined and the updated value is an empty string",
          async (t) => {
            let error: any;
            try {
              processUpdatedData(
                {
                  range: "range-value-ignored",
                  values: [[...submittedRowValues, undefined]],
                },
                "bananas",
                [...submittedRowValues, ""]
              );
            } catch (err) {
              error = err;
            }

            t.not(
              error.message,
              "One or more updated row values don't match corresponding submitted values"
            );
          }
        );

        t.test(
          "a pair of values are considered equal if the submitted value is empty string and the updated value is undefined",
          async (t) => {
            let error: any;
            try {
              processUpdatedData(
                {
                  range: "range-value-ignored",
                  values: [[...submittedRowValues, ""]],
                },
                "bananas",
                [...submittedRowValues, undefined]
              );
            } catch (err) {
              error = err;
            }

            t.not(
              error.message,
              "One or more updated row values don't match corresponding submitted values"
            );
          }
        );
      }
    );

    t.test("when examining the updated range", async (t) => {
      t.test(
        "if the updated range sheet doesn't match submitted sheet, throw expected error",
        async (t) => {
          parseRangeStub.returns({ sheet: "apples", startRow: 7, endRow: 7 });

          t.throws(
            () =>
              processUpdatedData(
                {
                  range: "range-value-ignored",
                  values: [[...submittedRowValues]],
                },
                "bananas",
                [...submittedRowValues]
              ),

            {
              message:
                "Updated range sheet name 'apples' doesn't match submitted sheet name 'bananas'",
            }
          );
        }
      );

      t.test(
        "if the start row doesn't match the end row, throw expected error",
        async (t) => {
          parseRangeStub.returns({ sheet: "bananas", startRow: 6, endRow: 7 });

          t.throws(
            () =>
              processUpdatedData(
                {
                  range: "range-value-ignored",
                  values: [[...submittedRowValues]],
                },
                "bananas",
                [...submittedRowValues]
              ),

            {
              message: "Updated range start row (6) doesn't match end row (7)",
            }
          );
        }
      );
    });

    t.test("returns expected updated row values and row number", async (t) => {
      parseRangeStub.returns({ sheet: "bananas", startRow: 7, endRow: 7 });

      const result = processUpdatedData(
        {
          range: "range-value-ignored",
          values: [[...submittedRowValues]],
        },
        "bananas",
        [...submittedRowValues]
      );

      t.match(result, {
        updatedRowValues: submittedRowValues,
        updatedRowNumber: 7,
      });
    });
  });
});
