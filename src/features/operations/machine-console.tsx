"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Archive, LoaderCircle, Pencil, Plus, RotateCcw, Search, ShieldAlert, Target, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { describeWriteError, isOneOf, machineId, requiredText, MACHINE_ID_PATTERN_SOURCE } from "@/lib/operations/validation";
import { MACHINE_STATUSES, type Machine, type MachineStatus } from "@/lib/operations/types";
import { ModuleHeader } from "@/features/operations/module-header";
import {
  button,
  buttonPrimary,
  buttonSecondary,
  eyebrow,
  eyebrowAccent,
  formGrid,
  formGridFull,
  heading,
  headingCopy,
  headingLead,
  headingTitle,
  iconButton,
  machineColumns,
  modalActions,
  modalBackdrop,
  modalCard,
  modalControlRow,
  modalError,
  modalHeader,
  modalLabel,
  modalTitle,
  moduleEmpty,
  moduleError,
  moduleNotice,
  permissionNote,
  recordStatus,
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
import { setMachineArchived } from "@/lib/operations/machines";

const emptyMachine: Machine = { id: "", machine_id: "", machine_name: "", machine_type: "", location: "", status: "running" };

const STATUS_LABELS: Record<MachineStatus, string> = {
  running: "Running",
  stop: "Stop",
  alarm: "Alarm",
  maintenance: "Maintenance",
};

function sortMachines(list: Machine[]): Machine[] {
  return [...list].sort((a, b) => a.machine_id.localeCompare(b.machine_id));
}

function messageFromError(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Unable to save machine data.";
}

// Postgres errors are turned into actionable sentences by the shared mapper in
// @/lib/operations/validation, so every module words its failures the same way.

export function MachineConsole() {
  const router = useRouter();
  // Deep links from the dashboard, where each machine in the health list is a
  // link rather than a label: ?q= seeds the search box and ?status= the status
  // picker, so a click on a machine lands on that machine.
  const searchParams = useSearchParams();
  const queryFromLink = searchParams.get("q");
  const statusFromLink = searchParams.get("status");
  const { role } = useCurrentUser();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Machine | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [scope, setScope] = useState<"active" | "archived" | "all">("active");
  // Machines are Admin-only for writes. Technicians get read access, which is
  // what the spec asks for, so this must not widen to canWrite(): a Technician
  // would then be offered Create / Edit / Delete buttons that Row Level Security
  // rejects anyway.
  const canManage = role === "admin";

  // Applied during render rather than in an effect, which is the only form the
  // compiler lint accepts for reacting to a changed input, and it runs at most
  // once per real change to the query string. Values that are not real are
  // ignored rather than written, so a hand-edited link cannot wedge the picker.
  const [lastQueryFromLink, setLastQueryFromLink] = useState(queryFromLink);
  if (queryFromLink !== lastQueryFromLink) {
    setLastQueryFromLink(queryFromLink);
    if (queryFromLink) setQuery(queryFromLink);
  }
  const [lastStatusFromLink, setLastStatusFromLink] = useState(statusFromLink);
  if (statusFromLink !== lastStatusFromLink) {
    setLastStatusFromLink(statusFromLink);
    if (statusFromLink && isOneOf(statusFromLink, MACHINE_STATUSES)) {
      setFilter(statusFromLink);
    }
  }

  const clearLink = useCallback(() => {
    if (queryFromLink || statusFromLink) router.replace("/machines", { scroll: false });
  }, [queryFromLink, statusFromLink, router]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
        const result = await supabase.from("machines").select("*").order("machine_id");
        if (result.error) throw result.error;
        if (active) setMachines(sortMachines((result.data ?? []) as Machine[]));
      } catch (loadError) {
        if (active) setError(messageFromError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const activeCount = machines.filter((item) => !item.is_archived).length;
  const archivedCount = machines.length - activeCount;

  /** The machine a link named, so the banner can name it rather than an id. */
  const linkedQuery = queryFromLink ?? "";
  const linked = linkedQuery
    ? machines.find((item) => `${item.machine_id} ${item.machine_name}`.toLowerCase().includes(linkedQuery.toLowerCase()))
    : undefined;

  const filtered = machines.filter((item) => {
    const text = `${item.machine_id} ${item.machine_name} ${item.machine_type} ${item.location}`.toLowerCase();
    // A machine named in the link is pulled out of the archive scope, so a link
    // to a retired machine does not land on an empty list.
    const namedInLink = Boolean(linkedQuery) && text.includes(linkedQuery.toLowerCase());
    const inScope = namedInLink || scope === "all" || (scope === "archived" ? Boolean(item.is_archived) : !item.is_archived);
    return text.includes(query.toLowerCase()) && inScope && (filter === "all" || item.status === filter);
  });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!canManage) {
      setError("Only Admin can create, edit or delete machines.");
      return;
    }
    if (saving) return;
    if (editing?.is_archived) {
      setError(`${editing.machine_id} is archived. Restore it before editing.`);
      return;
    }

    try {
      const values = new FormData(event.currentTarget);
      const record = {
        machine_id: machineId(values.get("machine_id")),
        machine_name: requiredText(values.get("machine_name"), "Machine name", 120),
        machine_type: requiredText(values.get("machine_type"), "Machine type", 80),
        location: requiredText(values.get("location"), "Location", 160),
        status: String(values.get("status")),
      };
      if (!isOneOf(record.status, MACHINE_STATUSES)) throw new Error("Invalid machine status.");

      const normalizedId = record.machine_id.toLowerCase();
      if (machines.some((item) => item.machine_id.toLowerCase() === normalizedId && item.id !== editing?.id)) {
        throw new Error("Machine ID already exists.");
      }

      setSaving(true);
      const supabase = createClient();
      const result = editing?.id
        ? await supabase.from("machines").update(record).eq("id", editing.id).select().single()
        : await supabase.from("machines").insert(record).select().single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("The machine was not returned by Supabase.");

      const saved = result.data as Machine;
      setMachines((current) => sortMachines(
        editing?.id ? current.map((item) => (item.id === editing.id ? saved : item)) : [...current, saved],
      ));
      setEditing(null);
    } catch (submitError) {
      setError(describeWriteError(submitError, "machine", "save"));
    } finally {
      setSaving(false);
    }
  }

  async function archive(machine: Machine) {
    if (!canManage) {
      setError("Only Admin can archive or restore machines.");
      return;
    }
    if (archivingId) return;
    const message = machine.is_archived
      ? `Restore ${machine.machine_id}? It will return to the active machine list.`
      : `Archive ${machine.machine_id}? The machine is kept for its alarm and maintenance history, and can be restored later.`;
    if (!window.confirm(message)) return;
    try {
      setError("");
      setArchivingId(machine.id);
      const result = await setMachineArchived(createClient(), machine.id, !machine.is_archived);
      if (result.error) throw result.error;
      if (!result.data) throw new Error("The machine was not updated. Check Admin permission.");
      setMachines((current) => sortMachines(current.map((item) => (item.id === machine.id ? (result.data as Machine) : item))));
    } catch (archiveError) {
      setError(describeWriteError(archiveError, "machine", "delete"));
    } finally {
      setArchivingId(null);
    }
  }

  /**
   * Permanent removal, as required by the Machine Master CRUD requirement.
   *
   * A machine that still has alarm or maintenance history cannot be removed
   * because those rows reference it. The database rejects that with an FK
   * violation and `describeWriteError` points the admin at Archive instead.
   */
  async function destroy(machine: Machine) {
    if (!canManage) {
      setError("Only Admin can delete machines.");
      return;
    }
    if (archivingId) return;
    if (!window.confirm(`Permanently delete ${machine.machine_id}? This cannot be undone. If the machine still has alarm or maintenance history the database will refuse, and you will need to Archive it instead.`)) return;
    try {
      setError("");
      setArchivingId(machine.id);
      const result = await createClient().from("machines").delete().eq("id", machine.id).select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("The machine was not deleted. Check Admin permission and database references.");
      setMachines((current) => current.filter((item) => item.id !== machine.id));
    } catch (removeError) {
      setError(describeWriteError(removeError, "machine", "delete"));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <main className={shell}>
      <ModuleHeader role={role} />
      <div className={heading}>
        <div className={headingCopy}><p className={`${eyebrow} ${eyebrowAccent}`}>WORKSPACE / MACHINES</p><h1 className={headingTitle}>Machine master</h1><p className={headingLead}>Manage production assets, locations and current machine status.</p></div>
        {canManage
          ? <button className={`${button} ${buttonPrimary}`} onClick={() => { setError(""); setEditing({ ...emptyMachine }); }}><Plus size={15} />Add machine</button>
          : <span className={permissionNote}><ShieldAlert size={15} />Add, edit and archive require the Admin role</span>}
      </div>
      <div className={toolbar}><div className={searchBox}><Search size={16} /><input className={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search machine ID, name or location..." aria-label="Search machines" /></div><select className={`${select} min-w-[150px] max-[760px]:h-[38px]`} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter machine status"><option value="all">All statuses</option>{MACHINE_STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select><select className={`${select} min-w-[150px] max-[760px]:h-[38px]`} value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} aria-label="Filter archived machines"><option value="active">Active ({activeCount})</option><option value="archived">Archived ({archivedCount})</option><option value="all">All ({machines.length})</option></select></div>
      {error && <div className={moduleError} role="alert">{error}</div>}
      {(queryFromLink || statusFromLink) && (
        <div className={`${moduleNotice} max-w-[1180px]`} role="status">
          <Target size={14} className="shrink-0 text-brand" />
          <span className="flex-1">
            {queryFromLink
              ? linked
                ? `Filtered to ${linked.machine_id} from a link. It is listed even if the scope below would hide it.`
                : `Looking for "${queryFromLink}" from a link. No machine matches, which usually means it was deleted or the code is wrong.`
              : `Showing only ${STATUS_LABELS[isOneOf(statusFromLink ?? "", MACHINE_STATUSES) ? statusFromLink as MachineStatus : "running"]} machines, from a link.`}
          </span>
          <button className={iconButton} onClick={clearLink} aria-label="Clear the link and show every machine"><X size={14} /></button>
        </div>
      )}
      {loading ? <div className={moduleEmpty}>Loading machines...</div> : <div className={tableCard}><div className={`${tableHead} ${machineColumns}`}><span>Machine</span><span>Type</span><span>Location</span><span>Status</span><span>{canManage ? "Actions" : "Access"}</span></div>{filtered.map((machine) => {
        const busy = archivingId === machine.id;
        return (
          <div className={`${tableRow} ${machineColumns}${machine.is_archived ? " opacity-60 [&>strong]:line-through" : ""}`} key={machine.id}>
            <strong className={rowStrong}>{machine.machine_id}<small className={rowSub}>{machine.machine_name}</small></strong>
            <span>{machine.machine_type}</span>
            <span>{machine.location}</span>
            <span className={`${recordStatus} ${machine.is_archived ? statusToneMuted : statusTone[machine.status] ?? ""}`}>{machine.is_archived ? "Archived" : STATUS_LABELS[machine.status as MachineStatus] ?? machine.status}</span>
            {canManage ? (
              <span className="flex items-center gap-1">
                {!machine.is_archived && <button className={iconButton} onClick={() => { setError(""); setEditing(machine); }} aria-label={`Edit ${machine.machine_id}`}><Pencil size={15} /></button>}
                <button className={iconButton} onClick={() => void archive(machine)} disabled={busy} aria-label={machine.is_archived ? `Restore ${machine.machine_id}` : `Archive ${machine.machine_id}`} aria-busy={busy} title={machine.is_archived ? "Restore" : "Archive"}>
                  {busy ? <LoaderCircle className="animate-spin" size={15} /> : machine.is_archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                </button>
                <button className={`${iconButton} hover:!text-danger`} onClick={() => void destroy(machine)} disabled={busy} aria-label={`Delete ${machine.machine_id} permanently`} title="Delete permanently"><Trash2 size={15} /></button>
              </span>
            ) : <span className="text-[10px] text-[color:var(--color-faint)]">View only</span>}
          </div>
        );
      })}{filtered.length === 0 && <div className={moduleEmpty}>No machines match your search.</div>}</div>}

      {editing && <div className={modalBackdrop}><form className={modalCard} onSubmit={save} noValidate><div className={modalHeader}><div><p className={eyebrow}>MACHINE MASTER</p><h2 className={modalTitle}>{editing.id ? "Edit machine" : "Add machine"}</h2></div><button type="button" className={iconButton} onClick={() => setEditing(null)} aria-label="Close"><X size={17} /></button></div>
            {error && <div className={modalError} role="alert">{error}</div>}<div className={formGrid}><label className={`${modalLabel} ${formGridFull}`}>Machine ID<input className={modalControlRow} name="machine_id" defaultValue={editing.machine_id} placeholder="e.g. CNC-04" pattern={MACHINE_ID_PATTERN_SOURCE} maxLength={32} required /></label><label className={modalLabel}>Machine Name<input className={modalControlRow} name="machine_name" defaultValue={editing.machine_name} maxLength={120} required /></label><label className={modalLabel}>Machine Type<input className={modalControlRow} name="machine_type" defaultValue={editing.machine_type} maxLength={80} required /></label><label className={`${modalLabel} ${formGridFull}`}>Location<input className={modalControlRow} name="location" defaultValue={editing.location} maxLength={160} required /></label><label className={modalLabel}>Status<select className={modalControlRow} name="status" defaultValue={editing.status}>{MACHINE_STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select></label></div><div className={modalActions}><button type="button" className={`${button} ${buttonSecondary}`} onClick={() => setEditing(null)} disabled={saving}>Cancel</button><button className={`${button} ${buttonPrimary}`} type="submit" disabled={saving}>{saving ? "Saving..." : "Save machine"}</button></div></form></div>}
    </main>
  );
}
