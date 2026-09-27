"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { ModuleHeader } from "@/features/operations/module-header";
import {
  button,
  buttonSecondary,
  buttonSmall,
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
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete";
  actor_id: string | null;
  actor_role: string | null;
  summary: string | null;
  created_at: string;
};

const TABLE_FILTERS = ["all", "machines", "alarms", "maintenance_records", "change_requests"];
const ACTION_FILTERS = ["all", "insert", "update", "delete"];

const actionTone: Record<string, string> = {
  insert: "bg-success-soft text-success",
  update: "bg-brand-soft text-brand",
  delete: "bg-danger-soft text-danger",
};

function formatStamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchAuditRows(table: string, action: string): Promise<AuditRow[]> {
  let query = createClient()
    .from("audit_log")
    .select("id, table_name, record_id, action, actor_id, actor_role, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (table !== "all") query = query.eq("table_name", table);
  if (action !== "all") query = query.eq("action", action);
  const result = await query;
  if (result.error) throw result.error;
  return (result.data ?? []) as AuditRow[];
}

/** Read-only audit trail. The rows are written by the database, not the app. */
export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [table, setTable] = useState("all");
  const [action, setAction] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchAuditRows(table, action);
        if (active) setRows(data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load the audit log.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [action, table]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchAuditRows(table, action));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load the audit log.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={shell}>
      <ModuleHeader />
      <div className={heading}>
        <div className={headingCopy}>
          <p className={`${eyebrow} ${eyebrowAccent}`}>CONTROL / AUDIT</p>
          <h1 className={headingTitle}>Audit log</h1>
          <p className={headingLead}>Every insert, update and delete is recorded in the database by a trigger, with the user who caused it.</p>
        </div>
        <button className={`${button} ${buttonSecondary} ${buttonSmall}`} type="button" onClick={() => void refresh()}>
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      <div className={toolbar}>
        <select className={`${select} min-w-[150px] max-[760px]:h-[38px]`} value={table} onChange={(event) => setTable(event.target.value)} aria-label="Filter by table">
          {TABLE_FILTERS.map((value) => <option key={value} value={value}>{value === "all" ? "All tables" : value}</option>)}
        </select>
        <select className={`${select} min-w-[150px] max-[760px]:h-[38px]`} value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filter by action">
          {ACTION_FILTERS.map((value) => <option key={value} value={value}>{value === "all" ? "All actions" : value}</option>)}
        </select>
      </div>

      {error && <div className={moduleError} role="alert">{error}</div>}

      {loading ? <div className={moduleEmpty}>Loading audit log...</div> : (
        <div className={tableCard}>
          <div className={tableHead}>
            <span>When</span><span>Table</span><span>Action</span><span>Detail</span>
          </div>
          {rows.map((row) => (
            <div className={tableRow} key={row.id}>
              <strong className={rowStrong}>{formatStamp(row.created_at)}</strong>
              <span>{row.table_name}</span>
              <span>
                <span className={`inline-block w-max rounded-[4px] px-[7px] py-[5px] text-[9px] capitalize ${actionTone[row.action] ?? ""}`}>
                  {row.action}
                </span>
              </span>
              <span>
                <span className={rowDescription}>{row.summary ?? ""}</span>
                <span className={rowDescription}>
                  {row.actor_role ? `by ${row.actor_role}` : "by system"}{row.record_id ? ` · ${row.record_id.slice(0, 8)}` : ""}
                </span>
              </span>
            </div>
          ))}
          {rows.length === 0 && <div className={moduleEmpty}><History size={20} />No audit entries match these filters.</div>}
        </div>
      )}

      <p className={moduleFootnote}>Entries are written by the public.write_audit_log() trigger. The table has an INSERT policy for nobody, so a log entry cannot be created or edited from the client.</p>
    </main>
  );
}

export default AuditLogPage;
