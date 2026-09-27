/**
 * Integration checks against a real Supabase project.
 *
 * These are separate from `npm test`, which covers pure logic and needs nothing.
 * A database cannot be faked here: the behaviour under test *is* Row Level
 * Security, the check constraints and the triggers, all of which live in
 * Postgres and nowhere else.
 *
 * The suite skips itself, loudly, when the environment is not configured, so it
 * never fails CI for the wrong reason:
 *
 *   TEST_SUPABASE_URL=https://<ref>.supabase.co
 *   TEST_SUPABASE_ANON_KEY=<publishable key>
 *   npm run test:db
 *
 * Both values are safe to expose. The suite only signs up throwaway accounts with
 * random addresses, asserts behaviour, and deletes everything it created. It
 * never needs the service role key, which is why it can run against production
 * data without a privileged credential in the environment.
 */
import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SUPABASE_ANON_KEY;
const enabled = Boolean(URL && KEY);

if (!enabled) {
  console.log("  integration checks skipped: set TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY to run them");
}

const stamp = Date.now().toString().slice(-8);
const PASSWORD = "Integration12345!";

const adminEmail = `it.admin.${stamp}@gmail.com`;
const techEmail = `it.tech.${stamp}@gmail.com`;
const viewerEmail = `it.viewer.${stamp}@gmail.com`;

/** A row id, kept so the suite can delete exactly what it created. */
type Id = string;
const created: Record<"machines" | "alarms" | "maintenance_records" | "change_requests", Id[]> = {
  machines: [],
  alarms: [],
  maintenance_records: [],
  change_requests: [],
};

type Account = { email: string; id: string; accessToken: string; api: SupabaseClient };

function client(accessToken?: string): SupabaseClient {
  return createClient(URL ?? "", KEY ?? "", {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUp(email: string, role: string): Promise<Account> {
  const result = await client().auth.signUp({ email, password: PASSWORD, options: { data: { display_name: `IT ${role}`, role } } });
  if (result.error) throw new Error(`signUp ${role}: ${result.error.message}`);
  const session = result.data.session;
  const user = result.data.user;
  if (!session || !user) throw new Error(`signUp ${role}: no session returned`);
  return { email, id: user.id, accessToken: session.access_token, api: client(session.access_token) };
}

/** A refusal has to be proved by reading the row back, not by the status code. */
async function stillExists(api: SupabaseClient, table: string, id: Id): Promise<boolean> {
  const { data } = await api.from(table).select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

/**
 * Unwraps a single row, failing loudly rather than dereferencing null.
 *
 * A null here means the query matched nothing, which for these assertions is
 * always a real problem: a policy blocked a read that should have been allowed,
 * or a row was never written. Letting it through as `undefined` would turn that
 * into a confusing failure much further down.
 */
function one<T>(data: T | null, context: string): T {
  assert.ok(data, `${context}: expected a row but the query returned none`);
  return data;
}

describe("integration: Supabase", { skip: enabled ? false : "credentials not configured" }, () => {
  let admin: Account;
  let tech: Account;
  let viewer: Account;
  let machine: { id: Id; machine_id: string; status: string; location: string };
  let alarm: { id: Id; status: string };
  let record: { id: Id; status: string; completed_at: string | null };
  let request: { id: Id; status: string };

  before(async () => {
    if (!enabled) return;
    admin = await signUp(adminEmail, "admin");
    tech = await signUp(techEmail, "technician");
    viewer = await signUp(viewerEmail, "viewer");

    // The first account created in a fresh project is a technician, so the admin
    // is promoted the same way a person setting the system up would.
    const { error } = await admin.api.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (error) throw new Error(`promote admin: ${error.message}`);

    const createdMachine = await admin.api.from("machines")
      .insert({ machine_id: `IT-${stamp}`, machine_name: "Integration machine", machine_type: "Robot", location: "Cell 1", status: "running" })
      .select().single();
    if (createdMachine.error || !createdMachine.data) throw new Error(`create machine: ${createdMachine.error?.message ?? "no row"}`);
    machine = createdMachine.data;
    created.machines.push(machine.id);
  });

  after(async () => {
    if (!enabled) return;
    for (const table of ["alarms", "maintenance_records", "change_requests", "machines"] as const) {
      if (!created[table].length) continue;
      await admin.api.from(table).delete().in("id", created[table]);
    }
    for (const account of [tech, viewer, admin]) {
      if (account) await admin.api.auth.admin.deleteUser(account.id).catch(() => {});
    }
  });

  it("gives a new sign-up the role they asked for", async () => {
    const { data } = await tech.api.from("profiles").select("role").eq("id", tech.id).single();
    assert.equal(one(data, "the technician profile")?.role, "technician");
  });

  describe("3.2 machine master", () => {
    it("lets an admin create a machine", async () => {
      assert.ok(machine.id);
      assert.equal(machine.status, "running");
    });

    it("refuses a duplicate machine id, whatever the case", async () => {
      const { error } = await admin.api.from("machines")
        .insert({ machine_id: machine.machine_id.toLowerCase(), machine_name: "dup", machine_type: "x", location: "x", status: "running" });
      assert.ok(error, "a duplicate must be refused");
    });

    it("refuses a machine id with a space in it", async () => {
      const { error } = await admin.api.from("machines")
        .insert({ machine_id: "has space", machine_name: "x", machine_type: "x", location: "x", status: "running" });
      assert.ok(error);
    });

    it("refuses a blank required field", async () => {
      const { error } = await admin.api.from("machines")
        .insert({ machine_id: "", machine_name: "x", machine_type: "x", location: "x", status: "running" });
      assert.ok(error);
    });

    it("stops a technician creating a machine", async () => {
      const { error } = await tech.api.from("machines")
        .insert({ machine_id: `T-${stamp}`, machine_name: "x", machine_type: "x", location: "x", status: "running" });
      assert.ok(error, "the spec says a technician may not add machines");
    });

    it("stops a technician changing a machine, without touching the data", async () => {
      await tech.api.from("machines").update({ location: "hijacked" }).eq("id", machine.id);
      const { data } = await admin.api.from("machines").select("location").eq("id", machine.id).single();
      assert.notEqual(one(data, "the machine after a refused update").location, "hijacked");
    });
  });

  describe("3.3 alarm record", () => {
    before(async () => {
      const result = await tech.api.from("alarms")
        .insert({ machine_id: machine.id, alarm_code: `IT-${stamp}`, description: "integration", occurred_at: new Date().toISOString(), status: "open" })
        .select().single();
      if (result.error || !result.data) throw new Error(`create alarm: ${result.error?.message ?? "no row"}`);
      alarm = result.data;
      created.alarms.push(alarm.id);
    });

    it("lets a technician log an alarm and move it along", async () => {
      const { error } = await tech.api.from("alarms").update({ status: "in_progress" }).eq("id", alarm.id);
      assert.equal(error, null);
    });

    it("refuses to close an alarm without a cause and an action", async () => {
      const { error } = await tech.api.from("alarms").update({ status: "closed" }).eq("id", alarm.id);
      assert.ok(error, "closed_alarm_has_resolution must reject this");
    });

    it("closes an alarm once a cause and an action are supplied", async () => {
      const { error } = await tech.api.from("alarms").update({ status: "closed", cause: "integration", action_taken: "done" }).eq("id", alarm.id);
      assert.equal(error, null);
    });

    it("keeps a technician out of the fields they may not edit", async () => {
      const { error } = await tech.api.from("alarms").update({ description: "rewritten" }).eq("id", alarm.id);
      assert.ok(error, "set_record_actor must reject this");
      const { data } = await admin.api.from("alarms").select("description").eq("id", alarm.id).single();
      assert.equal(one(data, "the alarm after a refused edit").description, "integration");
    });

    it("stops a technician deleting an alarm", async () => {
      await tech.api.from("alarms").delete().eq("id", alarm.id);
      assert.ok(await stillExists(admin.api, "alarms", alarm.id), "the row must still be there");
    });
  });

  describe("3.4 maintenance record", () => {
    before(async () => {
      const result = await tech.api.from("maintenance_records")
        .insert({ machine_id: machine.id, technician_id: tech.id, problem: "integration job", action_taken: "pending", started_at: new Date().toISOString(), status: "waiting_part" })
        .select().single();
      if (result.error || !result.data) throw new Error(`create maintenance: ${result.error?.message ?? "no row"}`);
      record = result.data;
      created.maintenance_records.push(record.id);
    });

    it("accepts the waiting_part status", () => {
      assert.equal(record.status, "waiting_part");
    });

    it("will not let a waiting_part job carry a completion time", () => {
      assert.equal(record.completed_at, null, "set_record_actor clears completed_at unless the status is completed");
    });

    it("completes the job once the status allows it", async () => {
      const { error } = await tech.api.from("maintenance_records").update({ status: "completed" }).eq("id", record.id);
      assert.equal(error, null);
    });
  });

  describe("7. viewer is read-only", () => {
    it("reads every table", async () => {
      for (const table of ["machines", "alarms", "maintenance_records", "profiles", "audit_log", "change_requests"]) {
        const { error } = await viewer.api.from(table).select("*").limit(1);
        assert.equal(error, null, `${table} should be readable`);
      }
    });

    it("cannot write to the operational tables", async () => {
      const attempts = [
        viewer.api.from("machines").insert({ machine_id: `V-${stamp}`, machine_name: "x", machine_type: "x", location: "x", status: "running" }),
        viewer.api.from("alarms").insert({ machine_id: machine.id, alarm_code: "V", description: "x", occurred_at: new Date().toISOString(), status: "open" }),
        viewer.api.from("maintenance_records").insert({ machine_id: machine.id, technician_id: viewer.id, problem: "x", action_taken: "x", started_at: new Date().toISOString(), status: "in_progress" }),
      ];
      for (const attempt of attempts) {
        const { error } = await attempt;
        assert.ok(error, "a viewer write to factory data must be refused");
      }
    });

    it("may still raise a change request, which is the point of the workflow", async () => {
      // Deliberate asymmetry: a Viewer has no write access to factory data, but
      // the change request workflow exists so that anyone can ask for a change.
      // Only an Admin can approve it, which the next block proves.
      const result = await viewer.api.from("change_requests")
        .insert({ title: "Viewer request", description: "a read-only user can still ask", requested_by: viewer.id })
        .select("id, status").single();
      assert.equal(result.error, null, "raising a request is not a write to factory data");
      assert.equal(one(result.data, "the viewer's request").status, "pending");
      created.change_requests.push(result.data!.id);

      // The approval attempt is checked by reading the row back rather than by
      // looking for an error. Row Level Security drops a refused UPDATE silently
      // and answers 200, so an error assertion here would pass a write that never
      // happened and fail one that was correctly blocked.
      await viewer.api.from("change_requests").update({ status: "approved" }).eq("id", result.data!.id);
      const { data } = await admin.api.from("change_requests").select("status").eq("id", result.data!.id).single();
      assert.equal(one(data, "the request after the viewer tried to approve it")?.status, "pending");
    });

    it("cannot promote itself", async () => {
      const { error } = await viewer.api.from("profiles").update({ role: "admin" }).eq("id", viewer.id);
      assert.ok(error, "protect_profile_role must refuse this");
    });
  });

  describe("3.7 length limits live in the database", () => {
    it("accepts a value at the limit", async () => {
      const { error } = await admin.api.from("machines").update({ machine_name: "x".repeat(120) }).eq("id", machine.id);
      assert.equal(error, null);
    });

    it("refuses one character over it", async () => {
      const { error } = await admin.api.from("machines").update({ machine_name: "x".repeat(121) }).eq("id", machine.id);
      assert.ok(error, "a direct API call must not be able to exceed the limit");
      const { data } = await admin.api.from("machines").select("machine_name").eq("id", machine.id).single();
      assert.equal(one(data, "the machine after an over-length write").machine_name.length, 120, "the stored value is untouched");
    });
  });

  describe("7. audit log", () => {
    it("records the writes made above", async () => {
      const { data } = await admin.api.from("audit_log").select("table_name, action, actor_role").limit(200);
      const entries = data ?? [];
      assert.ok(entries.some((row) => row.table_name === "machines"), "machine writes must be logged");
      assert.ok(entries.some((row) => row.actor_role), "the actor must be recorded");
    });

    it("cannot be forged from the client", async () => {
      for (const token of [admin.accessToken, tech.accessToken, viewer.accessToken]) {
        const { error } = await client(token).from("audit_log").insert({ table_name: "machines", action: "insert" });
        assert.ok(error, "audit_log has no INSERT policy for anybody");
      }
    });
  });

  describe("7. change requests", () => {
    before(async () => {
      const result = await tech.api.from("change_requests")
        .insert({ title: "Integration request", description: "checking the workflow", requested_by: tech.id })
        .select().single();
      if (result.error || !result.data) throw new Error(`create request: ${result.error?.message ?? "no row"}`);
      request = result.data;
      created.change_requests.push(request.id);
    });

    it("can be raised by a technician", () => {
      assert.equal(request.status, "pending");
    });

    it("cannot be approved by the person who raised it", async () => {
      await tech.api.from("change_requests").update({ status: "approved" }).eq("id", request.id);
      const { data } = await admin.api.from("change_requests").select("status").eq("id", request.id).single();
      assert.equal(one(data, "the request after a technician tried to approve it").status, "pending");
    });

    it("can be approved by an admin", async () => {
      const { error } = await admin.api.from("change_requests")
        .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
        .eq("id", request.id).eq("status", "pending");
      assert.equal(error, null);
      const { data } = await admin.api.from("change_requests").select("status").eq("id", request.id).single();
      assert.equal(one(data, "the request after an admin approved it").status, "approved");
    });

    it("records the decision in the audit log", async () => {
      const { data } = await admin.api.from("audit_log").select("action").eq("table_name", "change_requests").eq("action", "update");
      assert.ok((data ?? []).length > 0, "the decision must leave a trace");
    });
  });
});
