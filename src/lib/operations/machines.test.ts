import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MACHINE_REFERENCE_COLUMNS, activeMachines, isActive, listMachines, machineNameLookup, setMachineArchived, type MachineReference } from "./machines.ts";

/** A stand-in for the Supabase client that records what was asked for. */
function fakeClient(result: { rows: MachineReference[]; error: unknown }) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(`from(${table})`);
      const builder = {
        select(columns: string) {
          calls.push(`select(${columns})`);
          return builder;
        },
        update(values: unknown) {
          calls.push(`update(${JSON.stringify(values)})`);
          return builder;
        },
        eq(column: string, value: unknown) {
          calls.push(`eq(${column}=${String(value)})`);
          return builder;
        },
        order() {
          return builder;
        },
        single() {
          calls.push("single");
          return builder;
        },
        then(resolve: (value: { data: MachineReference[] | null; error: unknown }) => unknown) {
          calls.push("await");
          return resolve({ data: result.error ? null : result.rows, error: result.error });
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const running: MachineReference = { id: "1", machine_id: "ASM-02", machine_name: "Assembly Press", status: "running", is_archived: false };
const retired: MachineReference = { id: "2", machine_id: "OLD-01", machine_name: "Retired press", status: "stop", is_archived: true };
const flagUnknown: MachineReference = { id: "3", machine_id: "LEG-01", machine_name: "Legacy row", status: "running", is_archived: null };

describe("listMachines", () => {
  it("selects is_archived, without which a record cannot be named", () => {
    assert.match(MACHINE_REFERENCE_COLUMNS, /is_archived/);
  });

  it("returns archived machines too, so records that point at them stay readable", async () => {
    const { client, calls } = fakeClient({ rows: [running, retired], error: null });
    const result = await listMachines<MachineReference>(client);
    assert.equal(result.error, null);
    assert.equal(result.data?.length, 2, "an archived machine must not be filtered out at the query");
    assert.ok(!calls.some((call) => call.startsWith("eq(")), "no filter may be pushed into the query");
  });

  it("reports the error instead of returning an empty list", async () => {
    const { client } = fakeClient({ rows: [], error: { code: "42501", message: "permission denied" } });
    const result = await listMachines<MachineReference>(client);
    assert.equal(result.data, null);
    assert.equal(result.error?.code, "42501");
  });

  it("returns an empty list rather than null when there is simply no data", async () => {
    const { client } = fakeClient({ rows: [], error: null });
    const result = await listMachines<MachineReference>(client);
    assert.deepEqual(result.data, []);
  });
});

describe("isActive", () => {
  it("is true for a machine in service", () => {
    assert.equal(isActive(running), true);
  });

  it("is false for a retired machine", () => {
    assert.equal(isActive(retired), false);
  });

  it("treats a missing flag as active, so a row is never silently dropped", () => {
    assert.equal(isActive(flagUnknown), true);
    assert.equal(isActive({}), true);
  });
});

describe("activeMachines", () => {
  it("keeps only the machines still in service", () => {
    assert.deepEqual(activeMachines([running, retired, flagUnknown]).map((m) => m.machine_id), ["ASM-02", "LEG-01"]);
  });

  it("leaves an empty list alone", () => {
    assert.deepEqual(activeMachines([]), []);
  });
});

describe("machineNameLookup", () => {
  it("resolves a known id, archived or not", () => {
    const lookup = machineNameLookup([running, retired]);
    assert.equal(lookup("1"), "ASM-02");
    assert.equal(lookup("2"), "OLD-01", "a retired machine still has to be nameable");
  });

  it("says Unknown machine rather than leaking a uuid", () => {
    const lookup = machineNameLookup([running]);
    assert.equal(lookup("does-not-exist"), "Unknown machine");
  });

  it("handles having no machines at all", () => {
    assert.equal(machineNameLookup([])("anything"), "Unknown machine");
  });
});

describe("setMachineArchived", () => {
  it("writes the flag against the row it was given", async () => {
    const { client, calls } = fakeClient({ rows: [retired], error: null });
    await setMachineArchived(client, "2", true);
    assert.ok(calls.includes('update({"is_archived":true})'), `expected an update of the flag, got ${JSON.stringify(calls)}`);
    assert.ok(calls.includes("eq(id=2)"), "the write must be scoped to one machine");
  });

  it("can clear the flag again", async () => {
    const { client, calls } = fakeClient({ rows: [running], error: null });
    await setMachineArchived(client, "2", false);
    assert.ok(calls.includes('update({"is_archived":false})'));
  });
});
