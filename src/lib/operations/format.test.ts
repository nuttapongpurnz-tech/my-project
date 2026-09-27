import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { plural } from "./format.ts";

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    assert.equal(plural(1, "machine"), "1 machine");
    assert.equal(plural(1, "open alarm"), "1 open alarm");
  });

  it("uses the plural for zero, which is the case that reads worst when missed", () => {
    assert.equal(plural(0, "machine"), "0 machines");
  });

  it("uses the plural for two or more", () => {
    assert.equal(plural(2, "machine"), "2 machines");
    assert.equal(plural(4, "machine"), "4 machines");
  });

  it("accepts an irregular plural", () => {
    assert.equal(plural(2, "entry", "entries"), "2 entries");
    assert.equal(plural(1, "entry", "entries"), "1 entry");
  });
});
