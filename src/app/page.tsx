"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  FileBarChart,
  GitPullRequest,
  History as HistoryIcon,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatRelativeTime } from "@/lib/operations/validation";
import { eyebrow, eyebrowAccent, statusTone } from "@/features/operations/module-styles";
import { plural } from "@/lib/operations/format";
import { activeMachines, machineNameLookup } from "@/lib/operations/machines";
import { AlarmChart } from "@/features/operations/alarm-chart";
import { NotificationBell } from "@/features/operations/notification-bell";
import { onAlarmsChanged } from "@/lib/operations/alarm-events";
import { ThemeToggle } from "@/features/operations/theme-toggle";
import {
  alarmCopy,
  alarmCopyHead,
  alarmDescription,
  alarmList,
  alarmRow,
  alarmSeverity,
  alarmSeverityTones,
  alarmStatusBadge,
  alarmTime,
  appShell,
  attentionDot,
  avatar,
  bottomStrip,
  breadcrumb,
  brandCaption,
  brandName,
  brandRow,
  button,
  buttonPrimary,
  buttonSecondary,
  contentArea,
  countBadge,
  donut,
  donutCenter,
  emptyState,
  filterButton,
  filterButtonSelected,
  filterStrip,
  filterStripClear,
  filterStripCount,
  healthBar,
  healthBarFill,
  healthBarFillLow,
  healthSummary,
  healthValue,
  headingActions,
  headingSubtitle,
  iconButton,
  legend,
  legendDot,
  legendRow,
  liveIndicator,
  machineIcon,
  machineInfo,
  machineList,
  machineMeta,
  machineNameRow,
  machineRow,
  machineStatusTag,
  machineStatusTone,
  machineTag,
  metricCard,
  metricDelta,
  metricGrid,
  metricIcon,
  metricLabel,
  metricNote,
  metricTop,
  metricTones,
  metricValue,
  metricValueRow,
  mutedIcon,
  navCount,
  navItem,
  navItemActive,
  navLabel,
  navLabelSpaced,
  pageContent,
  pageHeading,
  pageHeadingTitle,
  panel,
  panelHeader,
  panelSubtitle,
  panelTitle,
  panelTitleRow,
  progressFill,
  progressTrack,
  pulseDot,
  searchBox,
  searchInput,
  sectionGrid,
  sidebar,
  sidebarFooter,
  sidebarOpen,
  siteDot,
  siteName,
  siteSelector,
  stripBody,
  stripIcon,
  stripLink,
  stripMeta,
  stripProgress,
  stripProgressLabels,
  stripTitle,
  systemMeta,
  systemStatus,
  systemTitle,
  tableToolbar,
  textButton,
  topAvatar,
  topbar,
  topbarActions,
  userCard,
  userCopyMeta,
  userCopyName,
} from "@/features/operations/dashboard-styles";
import type { Alarm, Machine, MaintenanceRecord } from "@/lib/operations/types";

type Summary = {
  totalMachines: number;
  activeAlarms: number;
  maintenanceRecords: number;
  running: number;
  stop: number;
  alarm: number;
  maintenance: number;
  completedMaintenance?: number;
};

type DashboardResponse = Summary & { machines: Machine[]; alarms: Alarm[]; maintenanceRows: MaintenanceRecord[] };

const emptySummary: Summary = {
  totalMachines: 0,
  activeAlarms: 0,
  maintenanceRecords: 0,
  running: 0,
  stop: 0,
  alarm: 0,
  maintenance: 0,
  completedMaintenance: 0,
};

function labelStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function alarmTone(status: string) {
  if (status === "closed") return "resolved";
  if (status === "in_progress") return "warning";
  return "critical";
}

export function DashboardView() {
  const router = useRouter();
  const { user, role } = useCurrentUser();
  const metadataName = user?.user_metadata?.display_name;
  const displayName: string = typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : user?.email?.split("@")[0] ?? "User";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  // Kept as a list, not just a count, so the maintenance figures can be scoped to
  // the selected range instead of always reporting every job ever logged.
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceRecord[]>([]);
  const [dataState, setDataState] = useState<"loading" | "ready" | "fallback">("loading");
  const [activeNav, setActiveNav] = useState("Overview");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const [referenceTime, setReferenceTime] = useState(0);
  /** Identifies the newest dashboard request, so a slow earlier one is ignored. */
  const requestId = useRef(0);

  /**
   * Fetches the dashboard payload, or null when the endpoint is unavailable.
   *
   * Fetching and applying are separate on purpose. It keeps the request id
   * guard in one readable place, and it means the callers below are the only
   * code that touches state, rather than a fetch helper that has to be trusted
   * to be non-blocking.
   */
  const fetchDashboard = useCallback(async (): Promise<DashboardResponse | null> => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) return null;
      return (await response.json()) as DashboardResponse;
    } catch {
      return null;
    }
  }, []);

  /** Writes a payload into state, or blanks the page when there is none. */
  const applyDashboard = useCallback((data: DashboardResponse | null) => {
    setReferenceTime(Date.now());
    if (!data) {
      // Shown as "Data unavailable" rather than as zeroes, so an outage is not
      // mistaken for a plant with nothing wrong with it.
      setSummary(emptySummary);
      setMachines([]);
      setAlarms([]);
      setMaintenanceRows([]);
      setDataState("fallback");
      return;
    }
    setSummary({
      totalMachines: Number(data.totalMachines ?? 0),
      activeAlarms: Number(data.activeAlarms ?? 0),
      maintenanceRecords: Number(data.maintenanceRecords ?? 0),
      running: Number(data.running ?? 0),
      stop: Number(data.stop ?? 0),
      alarm: Number(data.alarm ?? 0),
      maintenance: Number(data.maintenance ?? 0),
      completedMaintenance: Number(data.completedMaintenance ?? 0),
    });
    setMachines(Array.isArray(data.machines) ? data.machines : []);
    setAlarms(Array.isArray(data.alarms) ? data.alarms : []);
    setMaintenanceRows(Array.isArray(data.maintenanceRows) ? data.maintenanceRows : []);
    setDataState("ready");
  }, []);

  /**
   * Reloads, discarding a response that a newer request has already beaten.
   *
   * The request id is needed because a reload can be triggered three ways
   * (first paint, an alarm write, the window regaining focus) and they can
   * overlap. Without it, a slow first request landing after a fresh refetch
   * would put the old numbers back on screen.
   */
  const reload = useCallback(() => {
    const id = ++requestId.current;
    void fetchDashboard().then((data) => {
      if (id === requestId.current) applyDashboard(data);
    });
  }, [applyDashboard, fetchDashboard]);

  useEffect(() => { reload(); }, [reload]);

  // The alarm queue and the notification bell both read from `alarms`, so
  // closing an alarm has to be reflected here too. Without this, navigating back
  // to the dashboard could still show an alarm that no longer exists, because
  // the router keeps this component's state alive.
  useEffect(() => onAlarmsChanged(reload), [reload]);

  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  // Built from every machine the API returns, archived included, so an alarm on a
  // retired machine still shows its code instead of "Unknown machine".
  const machineName = useMemo(() => machineNameLookup(machines), [machines]);
  // A retired machine is kept for its history but is no longer part of the
  // plant, so it is left out of the machine list while staying available for
  // name lookups above.
  const inServiceMachines = useMemo(() => activeMachines(machines), [machines]);

  const rangeMs = range === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const rangeStart = referenceTime ? referenceTime - rangeMs : 0;
  const inRange = (value: string) => {
    const at = new Date(value).getTime();
    return Number.isNaN(at) || at >= rangeStart;
  };

  /**
   * What the range and the search box actually scope.
   *
   * A machine's status is a fact about right now, so filtering it by time would
   * be misleading, and the totals for the plant stay as they are. Everything
   * that is a matter of record: the alarm queue, the alarm chart, and the
   * maintenance figures, are scoped to the window. Closed alarms leave the
   * active count, so the card tracks what needs attention in that window rather
   * than everything ever recorded.
   */
  const matchesQuery = (text: string) => text.toLowerCase().includes(query.toLowerCase().trim());

  const scopedAlarms = alarms.filter((alarm) => {
    const text = `${alarm.alarm_code} ${alarm.description} ${machineName(alarm.machine_id)}`;
    return matchesQuery(text) && inRange(alarm.occurred_at);
  });

  const activeScopedAlarms = scopedAlarms.filter((alarm) => alarm.status !== "closed");
  const machinesInAlarm = new Set(scopedAlarms.map((alarm) => alarm.machine_id));
  const alarmServicingMachines = inServiceMachines.filter((machine) => machine.status === "maintenance");

  const scopedMaintenance = maintenanceRows.filter((record) => {
    const text = `${record.problem} ${record.action_taken} ${machineName(record.machine_id)}`;
    return matchesQuery(text) && inRange(record.started_at);
  });
  const completedScoped = scopedMaintenance.filter((record) => record.status === "completed");

  const alarmCriticalMachines = inServiceMachines.filter((machine) => machine.status === "alarm" && machinesInAlarm.has(machine.id));
  // A machine under maintenance counts when it has a job inside the window, not
  // merely because its status says so, so the figure matches the filter above.
  const servicingInWindow = alarmServicingMachines.filter((machine) =>
    scopedMaintenance.some((record) => record.machine_id === machine.id && record.status !== "completed"));

  const uptime = summary.totalMachines ? ((summary.running / summary.totalMachines) * 100).toFixed(1) : "0.0";
  const scopedCompliance = scopedMaintenance.length
    ? Math.round((completedScoped.length / scopedMaintenance.length) * 100)
    : 0;
  const stillOpen = activeScopedAlarms.length;
  const runningPercent = summary.totalMachines ? (summary.running / summary.totalMachines) * 100 : 0;
  const maintenancePercent = summary.totalMachines ? (summary.maintenance / summary.totalMachines) * 100 : 0;
  const alarmPercent = summary.totalMachines ? (summary.alarm / summary.totalMachines) * 100 : 0;

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  /**
   * Sidebar targets. Every entry listed here has a matching route and a branch
   * below; a label with neither would render a button that silently does
   * nothing, which is worse than not offering it.
   */
  const NAV_ROUTES: Record<string, string> = {
    Overview: "/dashboard",
    Machines: "/machines",
    Alarms: "/alarms",
    Maintenance: "/maintenance",
    History: "/history",
    Audit: "/audit",
    Requests: "/requests",
    Reports: "/reports",
    Users: "/users",
    Settings: "/settings",
  };

  function navigate(label: string) {
    setActiveNav(label);
    setMenuOpen(false);
    const target = NAV_ROUTES[label];
    if (target) router.push(target);
  }

  return (
    <main className={appShell}>
      <aside className={`${sidebar} ${menuOpen ? sidebarOpen : ""}`}>
        <div className={brandRow}>
          <div className="grid h-[31px] w-[31px] place-items-center rounded-[9px] bg-brand text-white shadow-[0_5px_12px_#3478f633]"><Activity size={19} strokeWidth={2.5} /></div>
          <div><p className={brandName}>FORGE<span>OPS</span></p><p className={brandCaption}>Factory command center</p></div>
          <button className={`${iconButton} ml-auto max-[680px]:grid`} onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X size={19} /></button>
        </div>

        <div className={siteSelector}><div className={siteDot} /><div><p className={eyebrow}>ACTIVE SITE</p><p className={siteName}>Plant 01 · Bangkok</p></div><ChevronDown size={15} className={mutedIcon} /></div>

        <nav aria-label="เมนูหลัก">
          <p className={navLabel}>WORKSPACE</p>
          {[
            { label: "Overview", Icon: LayoutDashboard }, { label: "Machines", Icon: Bot }, { label: "Alarms", Icon: Bell }, { label: "Maintenance", Icon: Wrench },
          ].map(({ label, Icon }) => (
            <button key={label} className={`${navItem} ${activeNav === label ? navItemActive : ""}`} onClick={() => navigate(label)}><Icon size={17} /><span>{label}</span>{label === "Alarms" && <span className={navCount}>{summary.activeAlarms}</span>}</button>
          ))}
          <p className={`${navLabel} ${navLabelSpaced}`}>CONTROL</p>
          {[
            { label: "History", Icon: HistoryIcon },
            { label: "Audit", Icon: ClipboardCheck },
            { label: "Requests", Icon: GitPullRequest },
            { label: "Reports", Icon: FileBarChart },
            { label: "Users", Icon: UsersRound },
            { label: "Settings", Icon: Settings2 },
          ].filter(({ label }) => label !== "Users" || role === "admin").map(({ label, Icon }) => (
            <button key={label} className={`${navItem} ${activeNav === label ? navItemActive : ""}`} onClick={() => navigate(label)}><Icon size={17} /><span>{label}</span></button>
          ))}
        </nav>

        <div className={sidebarFooter}>
          <div className={systemStatus}><span className={pulseDot} /><div><p className={systemTitle}>{dataState === "ready" ? "Live data connected" : dataState === "fallback" ? "Data unavailable · check Supabase" : "Connecting to Supabase"}</p><p className={systemMeta}>Last sync · just now</p></div></div>
          <button className={userCard} onClick={() => void signOut()}><div className={avatar}>{initials}</div><div className="min-w-0"><p className={userCopyName}>{displayName}</p><span className={userCopyMeta}>{role ? labelStatus(role) : "Signed in"} · Sign out</span></div><MoreHorizontal size={17} className={mutedIcon} /></button>
        </div>
      </aside>

      <section className={contentArea}>
        <header className={topbar}>
          <button className={`${iconButton} max-[680px]:grid`} onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Menu size={20} /></button>
          <div className={breadcrumb}><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div>
          {/* One bell only. There used to be a second decorative button here
              with no click handler and a permanently lit red dot, which read as
              a broken notification. NotificationBell is the real one. */}
          <div className={topbarActions}><span className={liveIndicator}><span />{dataState === "ready" ? "Live data" : "Data unavailable"}</span><NotificationBell alarms={alarms} machineName={machineName} /><ThemeToggle /><div className={topAvatar}>{initials}</div></div>
        </header>

        <div className={pageContent}>
          <div className={pageHeading}>
            <div><p className={`${eyebrow} ${eyebrowAccent}`}>LIVE OPERATIONS · PLANT 01</p><h1 className={pageHeadingTitle}>Good morning, {displayName}.</h1><p className={headingSubtitle}>Here&apos;s what&apos;s happening across Plant 01 today.</p></div>
            <div className={headingActions}><select className={`${button} ${buttonSecondary}`} value={range} onChange={(event) => { const next = event.target.value as "24h" | "7d"; setRange(next); setReferenceTime(Date.now()); }} aria-label="Dashboard time range"><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select><button className={`${button} ${buttonPrimary}`} onClick={() => router.push("/maintenance")}><Wrench size={15} />Log maintenance</button></div>
          </div>

          <section className={metricGrid} aria-label="ภาพรวมโรงงาน">
            <MetricCard label="Total machines" value={String(summary.totalMachines)} delta={`${summary.running} running`} note={dataState === "fallback" ? "data unavailable · check Supabase" : "live from Supabase"} icon={<Bot size={18} />} tone="blue" />
            <MetricCard label="Active alarms" value={String(activeScopedAlarms.length)} delta={`${plural(alarmCriticalMachines.length, "machine", "machines")} critical`} note={`need attention · ${range === "24h" ? "last 24 hours" : "last 7 days"}`} icon={<AlertTriangle size={18} />} tone="orange" alert />
            <MetricCard label="Maintenance records" value={String(scopedMaintenance.length).padStart(2, "0")} delta={`${plural(completedScoped.length, "job")} completed`} note={`${range === "24h" ? "last 24 hours" : "last 7 days"}`} icon={<Wrench size={18} />} tone="green" />
            <MetricCard label="Running rate" value={`${uptime}%`} delta={plural(summary.totalMachines, "machine")} note="current machine state" icon={<CircleGauge size={18} />} tone="violet" />
          </section>

          <div className={sectionGrid}>
            <section className={panel}>
              <div className={panelHeader}><div><div className={panelTitleRow}><h2 className={panelTitle}>Alarm queue</h2><span className={countBadge}>{activeScopedAlarms.length} active</span></div><p className={panelSubtitle}>Real-time alerts requiring attention</p></div><button className={textButton} onClick={() => router.push("/alarms?status=open")}>View all <span className="ml-[5px] text-[15px]">→</span></button></div>
              <div className={tableToolbar}><div className={searchBox}><Search size={16} /><input className={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alarms..." aria-label="ค้นหา alarms" /></div><button className={`${filterButton} ${showFilters ? filterButtonSelected : ""}`} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={15} />Filter</button></div>
              {showFilters && <div className={filterStrip}><span>Showing</span><strong>{range === "24h" ? "Last 24 hours" : "Last 7 days"}</strong><span className={filterStripCount}>{stillOpen} active · {plural(servicingInWindow.length, "machine")} being serviced</span><button className={filterStripClear} onClick={() => { setQuery(""); setRange("24h"); }}>Clear</button></div>}
              <div className={alarmList}>{activeScopedAlarms.slice(0, 6).map((alarm) => <AlarmRow key={alarm.id} alarm={alarm} machine={machineName(alarm.machine_id)} />)}</div>
              {activeScopedAlarms.length === 0 && <div className={emptyState}>No active alarms in this range.</div>}
              {/* The chart is a 7-day trend, so it is always a week, and it plots
                  every alarm inside the window rather than only the open ones. */}
              <AlarmChart alarms={scopedAlarms} days={7} />
            </section>

            <section className={`${panel} max-[1100px]:min-h-0`}>
              <div className={panelHeader}><div><h2 className={panelTitle}>Machine health</h2><p className={panelSubtitle}>Status across production lines</p></div><button className={iconButton} onClick={() => router.push("/machines")} aria-label="Open machines"><MoreHorizontal size={18} /></button></div>
              <div className={healthSummary}><div className={donut} style={{ background: `conic-gradient(var(--color-success) 0 ${runningPercent}%, var(--color-warn) ${runningPercent}% ${runningPercent + maintenancePercent}%, var(--color-danger) ${runningPercent + maintenancePercent}% ${runningPercent + maintenancePercent + alarmPercent}%, var(--color-steel) ${runningPercent + maintenancePercent + alarmPercent}% 100%)` }}><div className={donutCenter}><strong>{summary.totalMachines}</strong><span>machines</span></div></div><div className={legend}><Legend color="var(--color-success)" label="Running" value={summary.running} /><Legend color="var(--color-warn)" label="Maintenance" value={summary.maintenance} /><Legend color="var(--color-danger)" label="Alarm" value={summary.alarm} /><Legend color="var(--color-steel)" label="Stopped" value={summary.stop} /></div></div>
              <div className={machineList}>{inServiceMachines.slice(0, 5).map((machine) => <MachineRow key={machine.id} machine={machine} openAlarms={alarms.filter((alarm) => alarm.machine_id === machine.id && alarm.status !== "closed").length} />)}{inServiceMachines.length === 0 && <div className={emptyState}>No machines found.</div>}</div>
            </section>
          </div>

          <section className={bottomStrip}><div className={stripIcon}><ShieldCheck size={18} /></div><div className={stripBody}><strong className={stripTitle}>Maintenance completion</strong><span className={stripMeta}>{completedScoped.length} of {scopedMaintenance.length} work orders completed</span></div><div className={stripProgress}><div className={stripProgressLabels}><span>{scopedCompliance}%</span><span>Target 90%</span></div><div className={progressTrack}><div className={progressFill} style={{ width: `${Math.min(100, scopedCompliance)}%` }} /></div></div><button className={`${textButton} ${stripLink}`} onClick={() => router.push("/maintenance")}>View records <span className="ml-[5px] text-[15px]">→</span></button></section>
        </div>
      </section>
    </main>
  );
}

export default DashboardView;

function MetricCard({ label, value, delta, note, icon, tone, alert = false }: { label: string; value: string; delta: string; note: string; icon: React.ReactNode; tone: string; alert?: boolean }) {
  const palette = metricTones[tone] ?? metricTones.blue;
  return <div className={`${metricCard} ${palette.card}`}><div className={metricTop}><span className={`${metricIcon} ${palette.icon}`}>{icon}</span>{alert && <span className={attentionDot}>● attention</span>}</div><p className={metricLabel}>{label}</p><div className={metricValueRow}><strong className={metricValue}>{value}</strong><span className={`${metricDelta} ${palette.delta}`}>{delta}</span></div><p className={metricNote}>{note}</p></div>;
}

function AlarmRow({ alarm, machine }: { alarm: Alarm; machine: string }) {
  const tone = alarmTone(alarm.status);
  // A queue you have to re-find by eye is a queue that has failed at its job, so
  // the row is the link and lands on that alarm via ?id=, which the console
  // highlights.
  return <Link href={`/alarms?id=${alarm.id}`} className={`${alarmRow} no-underline`} aria-label={`Open alarm ${alarm.alarm_code} on ${machine}`}><div className={`${alarmSeverity} ${alarmSeverityTones[tone] ?? ""}`}><AlertTriangle size={15} /></div><div className={alarmCopy}><div className={alarmCopyHead}><strong>{alarm.alarm_code}</strong><span className={machineTag}>{machine}</span></div><p className={alarmDescription}>{alarm.description}</p></div><div className={alarmTime}>{formatRelativeTime(alarm.occurred_at)}</div><span className={`${alarmStatusBadge} ${statusTone[tone] ?? ""}`}>{labelStatus(alarm.status)}</span></Link>;
}

/**
 * One machine in the health list.
 *
 * The bar is driven by how many alarms are still open on this machine, counted
 * from the alarms already loaded for the dashboard. It is a real figure taken
 * from the database rather than a made-up health score, so a machine with no
 * open alarms correctly shows an empty bar.
 */
function MachineRow({ machine, openAlarms }: { machine: Machine; openAlarms: number }) {
  return (
    // Linked to the machine filtered on its own code, which is the same reason
    // the bar is drawn from a real count: if the figure is worth showing, it is
    // worth being able to go and look at.
    <Link href={`/machines?q=${encodeURIComponent(machine.machine_id)}`} className={`${machineRow} no-underline`} aria-label={`Open machine ${machine.machine_id}, ${plural(openAlarms, "open alarm")}`}>
      <div className={machineIcon}><Bot size={17} /></div>
      <div className={machineInfo}>
        <div className={machineNameRow}>
          <strong>{machine.machine_id}</strong>
          <span className={`${machineStatusTag} ${machineStatusTone[machine.status] ?? statusTone.stop}`}>{labelStatus(machine.status)}</span>
        </div>
        <span className={machineMeta}>{machine.machine_type} · {machine.location}</span>
      </div>
      {machine.status === "maintenance" && <span className={`${machineStatusTag} bg-warn-soft text-[color:var(--color-on-warn-soft)]`}><Wrench size={11} />servicing</span>}
      <div className={healthBar} title={`${plural(openAlarms, "open alarm")}`}>
        <div className={openAlarms > 0 ? healthBarFillLow : healthBarFill} style={{ width: `${Math.min(100, openAlarms * 34)}%` }} />
      </div>
      <span className={healthValue}>{openAlarms}</span>
    </Link>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className={legendRow}><span className={legendDot} style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}
