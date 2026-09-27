"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Download, FileText, LoaderCircle, Search } from "lucide-react";
import { ModuleHeader } from "@/features/operations/module-header";
import {
  button,
  buttonPrimary,
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
  recordStatus,
  reportCard,
  reportGrid,
  rowDescription,
  rowStrong,
  rowSub,
  searchBox,
  searchInput,
  select,
  shell,
  statusTone,
  statusToneMuted,
  tableCard,
  tableHead,
  tableRow,
  toolbar,
} from "@/features/operations/module-styles";
import type { Alarm, Machine, MaintenanceRecord } from "@/lib/operations/types";
import { activeMachines, machineNameLookup } from "@/lib/operations/machines";
import { plural } from "@/lib/operations/format";

type ReportData = { machines: Machine[]; alarms: Alarm[]; maintenanceRows: MaintenanceRecord[] };

/** The three record types collapsed into one shape, so one table and one export can serve all of them. */
type ReportRow = {
  key: string;
  kind: "Machine" | "Alarm" | "Maintenance";
  id: string;
  machine: string;
  detail: string;
  extra: string;
  status: string;
  at: string;
};

const KINDS = ["all", "Machine", "Alarm", "Maintenance"] as const;
const RANGES = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const STATUS_TONE: Record<string, string> = {
  running: statusTone.running,
  stop: statusTone.stop,
  alarm: statusTone.alarm,
  maintenance: statusTone.maintenance,
  open: statusTone.open,
  in_progress: statusTone.in_progress,
  waiting_part: statusTone.waiting_part,
  completed: statusTone.completed,
  closed: statusTone.closed,
};

/** Quotes one CSV field, doubling any quote inside it. */
function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatStamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData>({ machines: [], alarms: [], maintenanceRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [machineId, setMachineId] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<string>("all");
  // A fixed reference point for the relative ranges, taken once when the page
  // opens. It is deliberately not refreshed on every render, so the window does
  // not shift under the user while they are reading a row.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load report data.");
        return response.json() as Promise<ReportData>;
      })
      .then((result) => {
        if (active) setData({ machines: result.machines ?? [], alarms: result.alarms ?? [], maintenanceRows: result.maintenanceRows ?? [] });
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load report data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // A machine retired from service still has to be nameable in a report, so the
  // lookup is built from every machine and only the picker lists the active ones.
  const machineName = useMemo(() => machineNameLookup(data.machines), [data.machines]);
  const selectable = useMemo(() => activeMachines(data.machines), [data.machines]);

  const rows = useMemo<ReportRow[]>(() => {
    const out: ReportRow[] = [];
    for (const machine of data.machines) {
      out.push({
        key: `m-${machine.id}`,
        kind: "Machine",
        id: machine.machine_id,
        machine: machine.machine_id,
        detail: machine.machine_name,
        extra: machine.location,
        status: machine.is_archived ? "archived" : machine.status,
        at: machine.updated_at ?? "",
      });
    }
    for (const alarm of data.alarms) {
      out.push({
        key: `a-${alarm.id}`,
        kind: "Alarm",
        id: alarm.alarm_code,
        machine: machineName(alarm.machine_id),
        detail: alarm.description,
        extra: alarm.cause ?? alarm.action_taken ?? "",
        status: alarm.status,
        at: alarm.occurred_at,
      });
    }
    for (const record of data.maintenanceRows) {
      out.push({
        key: `r-${record.id}`,
        kind: "Maintenance",
        id: record.problem.slice(0, 40),
        machine: machineName(record.machine_id),
        detail: record.action_taken,
        extra: "",
        status: record.status,
        at: record.started_at,
      });
    }
    return out;
  }, [data, machineName]);

  const statuses = useMemo(() => [...new Set(rows.map((row) => row.status))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const window = RANGE_MS[range];
    const start = window && now ? now - window : 0;
    return rows.filter((row) => {
      if (kind !== "all" && row.kind !== kind) return false;
      if (machineId !== "all" && !row.machine.includes(machineId) && row.machine !== machineId) {
        // rows carry the machine code, the filter carries the uuid
        const target = data.machines.find((m) => m.id === machineId);
        if (!target || row.machine !== target.machine_id) return false;
      }
      if (status !== "all" && row.status !== status) return false;
      if (start) {
        const at = new Date(row.at).getTime();
        if (!Number.isNaN(at) && at < start) return false;
      }
      if (needle) {
        const text = `${row.kind} ${row.id} ${row.machine} ${row.detail} ${row.extra} ${row.status}`.toLowerCase();
        if (!text.includes(needle)) return false;
      }
      return true;
    });
  }, [data.machines, kind, machineId, now, query, range, rows, status]);

  const counts = useMemo(() => ({
    Machine: filtered.filter((row) => row.kind === "Machine").length,
    Alarm: filtered.filter((row) => row.kind === "Alarm").length,
    Maintenance: filtered.filter((row) => row.kind === "Maintenance").length,
  }), [filtered]);

  const isFiltered = kind !== "all" || machineId !== "all" || status !== "all" || range !== "all" || query.trim() !== "";
  const scopeLabel = [
    kind !== "all" ? kind : null,
    machineId !== "all" ? machineName(machineId) : null,
    status !== "all" ? status : null,
    range !== "all" ? RANGES.find((r) => r.value === range)?.label : null,
    query.trim() ? `"${query.trim()}"` : null,
  ].filter(Boolean).join(" · ");

  function clearFilters() {
    setQuery("");
    setKind("all");
    setMachineId("all");
    setStatus("all");
    setRange("all");
  }

  /**
   * Exports exactly the rows on screen, so a report and the file a reviewer
   * receives cannot disagree. The machine column carries the human readable
   * machine code rather than the uuid the tables are keyed by.
   */
  function downloadCsv() {
    const lines = [
      ["Record type", "Reference", "Machine", "Detail", "Status", "Date/time", "Extra"],
      ...filtered.map((row) => [row.kind, row.id, row.machine, row.detail, row.status, formatStamp(row.at), row.extra]),
    ];
    const csv = `\ufeff${lines.map((line) => line.map(csvCell).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `forgeops-${kind === "all" ? "report" : kind.toLowerCase()}-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={shell}>
      <ModuleHeader />
      <div className={heading}>
        <div className={headingCopy}>
          <p className={`${eyebrow} ${eyebrowAccent}`}>CONTROL / REPORTS</p>
          <h1 className={headingTitle}>Operations reports</h1>
          <p className={headingLead}>Filter the live records, then export exactly what is on screen.</p>
        </div>
        <button className={`${button} ${buttonPrimary} ${buttonSmall}`} type="button" onClick={downloadCsv} disabled={loading || filtered.length === 0}>
          {loading ? <LoaderCircle className="animate-spin" size={14} /> : <Download size={14} />}Export CSV
        </button>
      </div>

      {error && <div className={moduleError} role="alert">{error}</div>}

      <div className={toolbar}>
        <div className={searchBox}>
          <Search size={15} />
          <input className={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, machine, detail or status..." aria-label="Search records" />
        </div>
        <select className={`${select} min-w-[130px] max-[760px]:h-[38px]`} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} aria-label="Filter by record type">
          {KINDS.map((value) => <option key={value} value={value}>{value === "all" ? "All record types" : value}</option>)}
        </select>
        <select className={`${select} min-w-[130px] max-[760px]:h-[38px]`} value={machineId} onChange={(event) => setMachineId(event.target.value)} aria-label="Filter by machine">
          <option value="all">All machines</option>
          {selectable.map((machine) => <option key={machine.id} value={machine.id}>{machine.machine_id}</option>)}
        </select>
        <select className={`${select} min-w-[130px] max-[760px]:h-[38px]`} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
        <select className={`${select} min-w-[130px] max-[760px]:h-[38px]`} value={range} onChange={(event) => setRange(event.target.value)} aria-label="Filter by date range">
          {RANGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {isFiltered && <button className={`${button} ${buttonSecondary} ${buttonSmall}`} type="button" onClick={clearFilters}>Clear</button>}
      </div>

      <div className={reportGrid}>
        <section className={reportCard}>
          <BarChart3 size={20} />
          <h2 className="mb-2 mt-[15px] text-[17px]">What is in this report</h2>
          <p className="mb-[18px] text-xs leading-[1.7] text-muted">
            {loading
              ? "Loading live data..."
              : `${plural(counts.Machine, "machine")} · ${plural(counts.Alarm, "alarm")} · ${plural(counts.Maintenance, "maintenance record")}${isFiltered ? `, filtered by ${scopeLabel}` : ", unfiltered"}`}
          </p>
          <Link className="text-[11px] font-bold text-brand" href="/dashboard">Open dashboard <span className="ml-[5px] text-[15px]">→</span></Link>
        </section>
        <section className={reportCard}>
          <FileText size={20} />
          <h2 className="mb-2 mt-[15px] text-[17px]">CSV export</h2>
          <p className="mb-[18px] text-xs leading-[1.7] text-muted">
            {isFiltered
              ? `Downloads the ${plural(filtered.length, "row")} currently shown, filtered by ${scopeLabel}.`
              : `Downloads all ${plural(filtered.length, "row")} across every record type.`}
          </p>
          <p className="text-[10px] text-[color:var(--color-faint)]">The machine column holds the machine code, not the internal id.</p>
        </section>
      </div>

      <div className={`${tableCard} mt-4`}>
        <div className={tableHead}><span>Reference</span><span>Machine</span><span>Detail</span><span>Status</span></div>
        {filtered.slice(0, 200).map((row) => (
          <div className={tableRow} key={row.key}>
            <strong className={rowStrong}>{row.id}<small className={rowSub}>{row.kind}{row.at ? ` · ${formatStamp(row.at)}` : ""}</small></strong>
            <span>{row.machine}</span>
            <span>{row.detail}{row.extra && <small className={rowDescription}>{row.extra}</small>}</span>
            <span className={`${recordStatus} ${STATUS_TONE[row.status] ?? statusToneMuted}`}>{row.status.replaceAll("_", " ")}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className={moduleEmpty}>No records match these filters.</div>}
        {filtered.length > 200 && <div className={moduleEmpty}>Showing the first 200 of {filtered.length} rows. Narrow the filters, or export the CSV for the full set.</div>}
      </div>

      <p className={moduleFootnote}>
        The table above and the CSV are built from the same rows, so a downloaded report always matches what was on screen. Records are read through Row Level Security, so an export contains only what the signed-in role is allowed to see.
      </p>
    </main>
  );
}
