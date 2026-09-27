import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  MACHINE_ID_PATTERN,
  MACHINE_ID_PATTERN_SOURCE,
  describeWriteError,
  isOneOf,
  machineId,
  optionalText,
  requiredDate,
  requiredText,
  toDateTimeLocal,
} from "./validation.ts";

describe("requiredText", () => {
  it("trims and returns the value", () => {
    assert.equal(requiredText("  CNC-04  ", "Machine ID"), "CNC-04");
  });

  it("rejects an empty or whitespace-only value", () => {
    assert.throws(() => requiredText("", "Machine ID"), /required/);
    assert.throws(() => requiredText("   ", "Machine ID"), /required/);
    assert.throws(() => requiredText(null, "Machine ID"), /required/);
  });

  it("rejects a value over the length limit", () => {
    assert.throws(() => requiredText("x".repeat(300), "Description", 255), /255 characters or fewer/);
  });
});

describe("optionalText", () => {
  it("turns blank input into null rather than an empty string", () => {
    assert.equal(optionalText(""), null);
    assert.equal(optionalText("   ", 2000), null);
    assert.equal(optionalText(null), null);
  });

  it("keeps real text", () => {
    assert.equal(optionalText("  overheating  "), "overheating");
  });
});

describe("requiredDate", () => {
  it("returns a normalised ISO string", () => {
    const parsed = new Date(requiredDate("2026-03-04T10:30", "Started at"));
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 2);
    assert.equal(parsed.getDate(), 4);
    assert.equal(parsed.getHours(), 10);
    assert.equal(parsed.getMinutes(), 30);
  });

  it("reads a datetime-local value in the browser's own timezone", () => {
    // The form control produces a wall-clock time with no offset, so it has to
    // be interpreted as local time or a job logged at 10:30 would be saved as
    // 03:30. Comparing the local fields is what proves that.
    const result = requiredDate("2026-03-04T10:30", "Started at");
    assert.equal(new Date(result).getHours(), 10);
  });

  it("preserves an explicit offset when one is supplied", () => {
    assert.equal(requiredDate("2026-03-04T10:30:00.000Z", "Started at"), "2026-03-04T10:30:00.000Z");
  });

  it("rejects an empty or unparseable value", () => {
    assert.throws(() => requiredDate("", "Started at"), /required/);
    assert.throws(() => requiredDate("not-a-date", "Started at"), /valid date/);
  });
});

describe("machineId", () => {
  it("upper-cases so casing cannot create a duplicate", () => {
    assert.equal(machineId("cnc-04"), "CNC-04");
  });

  it("accepts the shapes the spec allows", () => {
    for (const id of ["AB", "A1", "CNC-04", "Robot_12", "press.9"]) {
      assert.equal(machineId(id), id.toUpperCase());
    }
  });

  it("rejects a single character, which the pattern requires to be at least two", () => {
    assert.throws(() => machineId("A"), /2.32 characters/);
  });

  it("rejects special characters, which is an explicit spec requirement", () => {
    for (const id of ["CNC 04", "CNC#04", "CNC/04", "เครื่อง-01", "CNC%04"]) {
      assert.throws(() => machineId(id), /only letters, numbers/, `expected ${id} to be rejected`);
    }
  });

  it("rejects a leading dot or hyphen, which the pattern forbids", () => {
    assert.throws(() => machineId(".hidden"), /only letters/);
    assert.throws(() => machineId("-lead"), /only letters/);
  });

  it("exposes the pattern it enforces", () => {
    assert.ok(MACHINE_ID_PATTERN.test("CNC-04"));
    assert.ok(!MACHINE_ID_PATTERN.test("CNC 04"));
  });

  it("survives the browser's pattern compiler", () => {
    // Browsers compile an HTML pattern attribute with the RegExp `v` flag. An
    // unescaped hyphen inside a character class is a syntax error there, and
    // Chrome responds by dropping the constraint instead of reporting it, which
    // leaves the field accepting anything. Compiling the shared source under the
    // same flag keeps that failure from coming back unnoticed.
    assert.doesNotThrow(() => new RegExp(`^(?:${MACHINE_ID_PATTERN_SOURCE})$`, "v"));
  });

  it("accepts the same values the browser attribute and the database do", () => {
    const asAttribute = new RegExp(`^(?:${MACHINE_ID_PATTERN_SOURCE})$`, "v");
    // The rule the machines table enforces, as Postgres spells it.
    const asConstraint = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;
    const cases = ["CNC-04", "E2E123", "a.b_c-d", "A-1", "ab", "has space", "-lead", "a", "toolongmachineidentifierbeyondthirtytwocharacters"];
    for (const value of cases) {
      assert.equal(asAttribute.test(value), asConstraint.test(value), `"${value}"`);
    }
  });
});

describe("isOneOf", () => {
  const values = ["in_progress", "waiting_part", "completed"] as const;

  it("narrows a known member", () => {
    const value: unknown = "waiting_part";
    assert.ok(isOneOf(value as string, values));
  });

  it("rejects anything else", () => {
    assert.ok(!isOneOf("archived", values));
    assert.ok(!isOneOf("", values));
  });
});

describe("message language", () => {
  // The forms set noValidate, so these strings are the whole of what a user sees
  // when a field is empty. A Thai-only or English-only message would leave half
  // the audience unable to act on it.
  const thai = /[\u0E00-\u0E7F]/;
  const latinWords = /[a-z]{4,}/i;

  it("writes every required-field message in both languages", () => {
    const message = requiredTextError();
    assert.match(message, thai, "needs Thai");
    assert.match(message, latinWords, "needs English");
  });

  it("does the same for the machine id format rule", () => {
    const message = errorFrom(() => machineId("bad id"));
    assert.match(message, thai);
    assert.match(message, /only letters/i);
  });

  it("does the same for the database error mapper", () => {
    for (const [code, context] of [["23505", "machine"], ["42501", "machine"], ["23514", "alarm"], ["23514", "maintenance"], ["23503", "machine"]]) {
      const message = describeWriteError({ code }, context as "machine" | "alarm" | "maintenance", "delete");
      assert.match(message, thai, `${code}/${context} needs Thai`);
      assert.match(message, latinWords, `${code}/${context} needs English`);
    }
  });

  it("still says which field is missing, in English", () => {
    assert.match(requiredTextError(), /Machine name is required/);
  });
});

function requiredTextError(): string {
  try {
    requiredText("", "Machine name");
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

function errorFrom(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

describe("toDateTimeLocal", () => {
  it("returns an empty string for missing or invalid input", () => {
    assert.equal(toDateTimeLocal(null), "");
    assert.equal(toDateTimeLocal(undefined), "");
    assert.equal(toDateTimeLocal("nonsense"), "");
  });

  it("produces the yyyy-mm-ddThh:mm shape a datetime-local input needs", () => {
    assert.match(toDateTimeLocal("2026-03-04T10:30:00.000Z"), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("describeWriteError", () => {
  it("names the duplicate field for a machine", () => {
    const message = describeWriteError({ code: "23505" }, "machine");
    assert.match(message, /Machine ID already exists/);
    assert.doesNotMatch(message, /duplicate key/i, "must not leak the raw driver text");
  });

  it("explains what a closed alarm is missing instead of quoting the constraint", () => {
    const message = describeWriteError({ code: "23514" }, "alarm");
    assert.match(message, /cause and the action taken/);
    assert.doesNotMatch(message, /violates check constraint/i);
  });

  it("mentions the waiting-part rule for maintenance", () => {
    assert.match(describeWriteError({ code: "23514" }, "maintenance"), /waiting for a part/);
  });

  it("points a Technician at the Admin role on a permission failure", () => {
    assert.match(describeWriteError({ code: "42501" }, "machine"), /Only Admin can manage machines/);
    assert.match(describeWriteError({ code: "42501" }, "alarm"), /role does not allow/);
  });

  it("offers Archive instead of Delete when a machine is still referenced", () => {
    const message = describeWriteError({ code: "23503" }, "machine", "delete");
    assert.match(message, /Use Archive instead/);
  });

  it("tells the admin to run the migrations when a column is missing", () => {
    assert.match(describeWriteError({ code: "42703", message: "column is_archived does not exist" }, "machine"), /supabase\/migrations/);
  });

  it("translates the trigger message that limits technicians to workflow fields", () => {
    const message = describeWriteError({ message: "technicians can only update alarm workflow fields" }, "alarm");
    assert.match(message, /cause, the action taken and the status/);
  });

  it("translates a not-null violation into advice about the form", () => {
    const message = describeWriteError({ message: 'null value in column "cause" violates not-null constraint' }, "alarm");
    assert.match(message, /required field was empty/i);
  });

  it("still returns something readable for an unrecognised failure", () => {
    const message = describeWriteError(new Error("connection reset"), "alarm");
    assert.equal(message, "connection reset");
    assert.notEqual(describeWriteError(undefined, "alarm"), "");
  });
});
