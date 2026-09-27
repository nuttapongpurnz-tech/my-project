"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { ModuleHeader } from "@/features/operations/module-header";
import {
  eyebrow,
  eyebrowAccent,
  heading,
  headingCopy,
  headingLead,
  headingTitle,
  moduleEmpty,
  moduleError,
  moduleFootnote,
  rowDescription,
  rowStrong,
  select,
  shell,
  tableCard,
  tableHead,
  tableRow,
  toolbar,
} from "@/features/operations/module-styles";

type AuditRow = {
  id: string;
  record_id: string | null;
  action: "insert" | "update" | "delete";
  actor_role: string | null;
  created_at: string;
};

type MachineOption = { id: string; machine_id: string; machine_name: string };

const actionTone: Record<string, string> = {
  insert: "bg-success-soft text-success",
  update: "bg-brand-soft text-brand",
  delete: "bg-danger-soft text-danger",
};

const TABLE_LABEL: Record<string, string> = {
  machines: "Machine",
  alarms: "Alarm",
  maintenance_records: "Maintenance",
};

async function fetchHistory(machineId: string): Promise<{ entries: AuditRow[]; machines: MachineOption[] }> {
  const supabase = createClient();
  const machinesResult = await supabase.from("machines").select("id, machine_id, machine_name").order("machine_id");
  if (machinesResult.error) throw machinesResult.error;
  const machines = (machinesResult.data ?? []) as MachineOption[];

  if (!machineId) return { entries: [], machines };

  // The audit log stores the record id, so gather the ids of everything that
  // belongs to this machine and then filter the log down to those ids.
  const [machineRow, alarms, maintenance] = await Promise.all([
    supabase.from("machines").select("id").eq("id", machineId).maybeSingle(),
    supabase.from("alarms").select("id").eq("machine_id", machineId),
    supabase.from("maintenance_records").select("id").eq("machine_id", machineId),
  ]);
  if (machineRow.error) throw machineRow.error;
  if (alarms.error) throw alarms.error;
  if (maintenance.error) throw maintenance.error;

  const ids = [machineRow.data?.id, ...(alarms.data ?? []).map((a) => a.id), ...(maintenance.data ?? []).map((m) => m.id)].filter(Boolean) as string[];
  if (ids.length === 0) return { entries: [], machines };

  const log = await supabase
    .from("audit_log")
    .select("id, record_id, action, actor_role, created_at")
    .in("record_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  if (log.error) throw log.error;
  return { entries: (log.data ?? []) as AuditRow[], machines };
}

/** Machine history, reconstructed from the audit log. */
export function MachineHistoryPage() {
  const [machineId, setMachineId] = useState("");
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      await Promise.resolve();
      try {
        const data = await fetchHistory(machineId);
        if (active) { setMachines(data.machines); setEntries(data.entries); }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load the history.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [machineId]);
  const selected = machines.find((m) => m.id === machineId);

  return (
    <main className={shell}>
      <ModuleHeader />
      <div className={heading}>
        <div className={headingCopy}>
          <p className={`${eyebrow} ${eyebrowAccent}`}>CONTROL / HISTORY</p>
          <h1 className={headingTitle}>Machine history</h1>
          <p className={headingLead}>Every recorded change to a machine, its alarms and its maintenance work, newest first.</p>
        </div>
      </div>

      <div className={toolbar}>
        <select className={`${select} min-w-[220px] max-[760px]:h-[38px]`} value={machineId} onChange={(event) => { setLoading(true); setMachineId(event.target.value); }} aria-label="Select a machine">
          <option value="">All machines</option>
          {machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.machine_id} — {machine.machine_name}</option>)}
        </select>
      </div>

      {error && <div className={moduleError} role="alert">{error}</div>}

      {loading ? <div className={moduleEmpty}>Loading history...</div> : !machineId ? (
        <div className={moduleEmpty}><History size={20} />Select a machine to see its history.</div>
      ) : (
        <div className={tableCard}>
          <div className={tableHead}>
            <span>When</span><span>Action</span><span>By</span><span>Detail</span>
          </div>
          {entries.map((entry) => (
            <div className={tableRow} key={entry.id}>
              <strong className={rowStrong}>{new Date(entry.created_at).toLocaleString("en-GB")}</strong>
              <span>
                <span className={`inline-block w-max rounded-[4px] px-[7px] py-[5px] text-[9px] capitalize ${actionTone[entry.action] ?? ""}`}>{entry.action}</span>
              </span>
              <span>{entry.actor_role ?? "system"}</span>
              <span className={rowDescription}>{entry.record_id ? `record ${entry.record_id.slice(0, 8)}` : ""}</span>
            </div>
          ))}
          {entries.length === 0 && <div className={moduleEmpty}>No recorded changes for {selected?.machine_id ?? "this machine"} yet.</div>}
        </div>
      )}

      <p className={moduleFootnote}>
        The history is read from the audit log, so it also shows who made each change. Tables covered: {Object.values(TABLE_LABEL).join(", ")}.
      </p>
    </main>
  );
}

export default MachineHistoryPage;
