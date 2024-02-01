import { test } from "tap";

import { parseRange } from "./range";

test("range", async (t) => {
  t.test("#parseRange", async (t) => {
    t.test(
      "if range is not the correct format, throws expected error",
      async (t) => {
        t.throws(() => parseRange("not a range"), {
          message: "Missing or bad range",
        });
      },
    );

    t.test("returns expected parsed range data", async (t) => {
      const result = parseRange("bananas!A5:C42");

      t.match(result, {
        sheet: "bananas",
        startColumn: "A",
        startRow: 5,
        endColumn: "C",
        endRow: 42,
      });
    });
  });
});
