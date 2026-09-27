"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ModuleHeader } from "@/features/operations/module-header";
import {
  button,
  buttonPrimary,
  buttonSecondary,
  buttonSmall,
  eyebrow,
  eyebrowAccent,
  formGrid,
  formGridFull,
  heading,
  headingCopy,
  headingLead,
  headingTitle,
  modalActions,
  modalBackdrop,
  modalCard,
  modalControl,
  modalHeader,
  modalLabel,
  modalTextarea,
  modalTitle,
  moduleEmpty,
  moduleError,
  moduleFootnote,
  rowDescription,
  rowStrong,
  shell,
  tableCard,
  tableHead,
  tableRow,
} from "@/features/operations/module-styles";

type RequestRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  requested_by_name?: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

const statusTone: Record<string, string> = {
  pending: "bg-warn-soft text-[color:var(--color-on-warn-soft)]",
  approved: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
};

async function fetchRequests(): Promise<{ rows: RequestRow[]; names: Record<string, string> }> {
  const supabase = createClient();
  const result = await supabase
    .from("change_requests")
    .select("id, title, description, category, status, requested_by, reviewed_by, reviewed_at, review_note, created_at")
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as RequestRow[];

  const ids = Array.from(new Set(rows.flatMap((row) => [row.requested_by, row.reviewed_by].filter(Boolean) as string[])));
  let names: Record<string, string> = {};
  if (ids.length) {
    const people = await supabase.from("profiles").select("id, display_name").in("id", ids);
    if (!people.error) {
      names = Object.fromEntries((people.data ?? []).map((p) => [p.id as string, (p.display_name as string) ?? ""]));
    }
  }
  return { rows, names };
}

/**
 * Change request workflow from the bonus requirements: any signed-in user can
 * raise a request, and only an Admin can approve or reject it. The approve and
 * reject buttons are only rendered for an Admin, and the RLS policy
 * "admins review change requests" is the real boundary.
 */
export function ChangeRequestsPage() {
  const { user, role } = useCurrentUser();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchRequests();
        if (active) { setRows(data.rows); setNames(data.names); }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load change requests.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function reload() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchRequests();
      setRows(data.rows);
      setNames(data.names);
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : "Unable to load change requests.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3) { setError("The title needs at least 3 characters."); return; }
    if (description.trim().length === 0) { setError("Please describe what you are asking for."); return; }
    setSaving(true);
    setError("");
    try {
      const result = await createClient()
        .from("change_requests")
        .insert({ title: title.trim(), description: description.trim(), requested_by: user?.id })
        .select("id")
        .single();
      if (result.error) throw result.error;
      setOpen(false);
      setTitle("");
      setDescription("");
      setNotice("Change request submitted. An Admin will review it.");
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the request.");
    } finally {
      setSaving(false);
    }
  }

  async function review(row: RequestRow, next: "approved" | "rejected") {
    if (role !== "admin") { setError("Only Admin can review change requests."); return; }
    if (!window.confirm(`${next === "approved" ? "Approve" : "Reject"} "${row.title}"?`)) return;
    setError("");
    setNotice("");
    try {
      const result = await createClient()
        .from("change_requests")
        .update({ status: next, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) {
        setError("That request was already reviewed by someone else. Reload the list.");
      } else {
        setNotice(`Request ${next}.`);
      }
      await reload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review the request.");
    }
  }

  const isAdmin = role === "admin";
  const pending = rows.filter((row) => row.status === "pending").length;

  return (
    <main className={shell}>
      <ModuleHeader role={role} />
      <div className={heading}>
        <div className={headingCopy}>
          <p className={`${eyebrow} ${eyebrowAccent}`}>CONTROL / REQUESTS</p>
          <h1 className={headingTitle}>Change requests</h1>
          <p className={headingLead}>
            Anyone can raise a request. Only an Admin can approve or reject it.
            {pending > 0 && ` ${pending} waiting for review.`}
          </p>
        </div>
        <button className={`${button} ${buttonPrimary}`} onClick={() => { setError(""); setOpen(true); }}>
          <Plus size={15} />New request
        </button>
      </div>

      {error && <div className={moduleError} role="alert">{error}</div>}
      {notice && <div className="mb-3.5 max-w-[1180px] rounded-[6px] bg-success-soft px-[13px] py-[10px] text-[11px] text-[color:var(--color-on-success-soft)]" role="status">{notice}</div>}

      {loading ? <div className={moduleEmpty}>Loading change requests...</div> : (
        <div className={tableCard}>
          <div className={tableHead}>
            <span>Request</span><span>Requested by</span><span>Status</span><span>{isAdmin ? "Review" : "Detail"}</span>
          </div>
          {rows.map((row) => (
            <div className={tableRow} key={row.id}>
              <strong className={rowStrong}>{row.title}<span className={rowDescription}>{new Date(row.created_at).toLocaleDateString("en-GB")}</span></strong>
              <span>{names[row.requested_by] ?? "Unknown"}</span>
              <span>
                <span className={`inline-block w-max rounded-[4px] px-[7px] py-[5px] text-[9px] capitalize ${statusTone[row.status] ?? ""}`}>{row.status}</span>
              </span>
              {isAdmin && row.status === "pending" ? (
                <span className="flex items-center gap-1">
                  <button className={`${button} ${buttonSecondary} ${buttonSmall}`} type="button" onClick={() => void review(row, "approved")}>
                    <CheckCircle2 size={14} />Approve
                  </button>
                  <button className={`${button} ${buttonSecondary} ${buttonSmall}`} type="button" onClick={() => void review(row, "rejected")}>
                    <XCircle size={14} />Reject
                  </button>
                </span>
              ) : (
                <span className="text-[10px] text-[color:var(--color-faint)]">
                  {row.review_note ?? (row.reviewed_at ? `Reviewed ${new Date(row.reviewed_at).toLocaleDateString("en-GB")}` : "Awaiting an Admin")}
                </span>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className={moduleEmpty}>No change requests yet.</div>}
        </div>
      )}

      <p className={moduleFootnote}>
        Every request and every decision is recorded in the audit log as well, so the
        <Link className="mx-1 underline" href="/audit">audit trail</Link> shows who raised a request and who approved it.
      </p>

      {open && (
        <div className={modalBackdrop}>
          <form className={modalCard} onSubmit={submit} noValidate>
            <div className={modalHeader}><h2 className={modalTitle}>New change request</h2></div>
            <div className={formGrid}>
              <label className={`${modalLabel} ${formGridFull}`}>Title<input className={modalControl} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short summary of the change" minLength={3} maxLength={120} required /></label>
              <label className={`${modalLabel} ${formGridFull}`}>Description<textarea className={`${modalControl} ${modalTextarea}`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should change, and why?" maxLength={2000} required /></label>
            </div>
            <div className={modalActions}>
              <button type="button" className={`${button} ${buttonSecondary}`} onClick={() => setOpen(false)}>Cancel</button>
              <button className={`${button} ${buttonPrimary}`} type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit request"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default ChangeRequestsPage;
