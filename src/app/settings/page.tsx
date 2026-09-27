"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bell, CheckCircle2, Database, LockKeyhole, Monitor, Moon, RotateCcw, ShieldAlert, Sun, UserRound } from "lucide-react";
import { ModuleHeader } from "@/features/operations/module-header";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { createClient } from "@/lib/supabase/browser";
import { useTheme, THEME_OPTIONS } from "@/features/operations/theme-toggle";
import { restoreDesktopOffer, useDesktopOfferDismissed, useDesktopPermission } from "@/features/operations/use-desktop-offer";
import { describeWriteError } from "@/lib/operations/validation";
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
  modalControlRow,
  recordStatus,
  rolePill,
  rolePillTone,
  settingsList,
  settingsRow,
  shell,
  statusTone,
} from "@/features/operations/module-styles";

type Counters = { machines: number; alarms: number; maintenance: number };

const ROLE_NOTE: Record<string, string> = {
  admin: "Full control of machines, alarms and maintenance, and the only role that can change another account's role.",
  technician: "Read every machine, log and close alarms, and update maintenance jobs assigned to you. Machines cannot be created, edited or deleted.",
  viewer: "Read only. No write control is shown anywhere, and the database refuses a write from this role.",
};

export default function SettingsPage() {
  const { user, role, loading: userLoading } = useCurrentUser();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const [counters, setCounters] = useState<Counters | null>(null);
  const [connection, setConnection] = useState<"checking" | "ok" | "failed">("checking");

  // Both of these live in the browser rather than in React, so they are read as
  // stores. That is what makes the dismissal survive a reload and follow a
  // change made in another tab, without an effect copying a value the browser
  // will keep for us anyway.
  const desktop = useDesktopPermission();
  const offerDismissed = useDesktopOfferDismissed();

  async function enableDesktop() {
    if (!("Notification" in window)) return;
    // A click causes the re-render that re-reads the permission from the store.
    await Notification.requestPermission();
  }

  useEffect(() => {
    // Nothing to look up until the session resolves. Without this guard the
    // effect runs on first paint with no user, builds the filter "id=eq." with
    // an empty value, and PostgREST rejects it with a 400.
    const userId = user?.id;
    if (!userId) return;
    let active = true;
    // Supabase query builders are thenable rather than real promises, so the
    // result is awaited inside an async function to get normal error handling.
    async function load() {
      try {
        const result = await createClient()
          .from("profiles")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle();
        if (!active) return;
        if (result.error) { setNameError(describeWriteError(result.error, "machine")); return; }
        setName(result.data?.display_name ?? "");
      } catch {
        if (active) setNameError("Could not read your profile.");
      }
    }
    void load();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    // Three cheap counts, enough to prove the deployment is talking to a real
    // database without dumping every row into the page.
    Promise.all([
      createClient().from("machines").select("id", { count: "exact", head: true }),
      createClient().from("alarms").select("id", { count: "exact", head: true }),
      createClient().from("maintenance_records").select("id", { count: "exact", head: true }),
    ])
      .then(([machines, alarms, maintenance]) => {
        if (!active) return;
        const failed = [machines, alarms, maintenance].some((r) => r.error);
        setConnection(failed ? "failed" : "ok");
        if (!failed) {
          setCounters({ machines: machines.count ?? 0, alarms: alarms.count ?? 0, maintenance: maintenance.count ?? 0 });
        }
      })
      .catch(() => { if (active) setConnection("failed"); });
    return () => { active = false; };
  }, []);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    setNameError("");
    setNameSaved(false);

    if (!trimmed) {
      setNameError("กรอกชื่อที่ใช้แสดง / Display name is required.");
      return;
    }
    if (trimmed.length > 120) {
      setNameError("ชื่อต้องไม่เกิน 120 ตัวอักษร / Display name must be 120 characters or fewer.");
      return;
    }

    // user.id is guaranteed by the disabled submit button, and this guard stops a
    // stale click from building the filter "id=eq." with nothing after it.
    if (!user?.id) {
      setNameError("ยังไม่ทราบว่าคุณคือใคร ลองโหลดหน้าใหม่ / Your session has not loaded yet. Reload the page.");
      return;
    }

    setSavingName(true);
    try {
      const result = await createClient().from("profiles").update({ display_name: trimmed }).eq("id", user.id).select("display_name").single();
      if (result.error) throw result.error;
      setName(result.data.display_name);
      setNameSaved(true);
    } catch (error) {
      setNameError(describeWriteError(error, "machine"));
    } finally {
      setSavingName(false);
    }
  }

  return (
    <main className={shell}>
      <ModuleHeader role={role} />
      <div className={heading}>
        <div className={headingCopy}>
          <p className={`${eyebrow} ${eyebrowAccent}`}>CONTROL / SETTINGS</p>
          <h1 className={headingTitle}>Settings</h1>
          <p className={headingLead}>Your profile, how the workspace looks, and what the system can currently see.</p>
        </div>
      </div>

      {nameError && <div className={moduleError} role="alert">{nameError}</div>}
      {nameSaved && !nameError && (
        <div className="mx-auto mb-3.5 max-w-[1180px] rounded-[6px] bg-success-soft px-[13px] py-[10px] text-[11px] text-[color:var(--color-on-success-soft)]" role="status">
          บันทึกชื่อเรียบร้อย / Display name saved.
        </div>
      )}

      <section className="mb-5">
        <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink"><UserRound size={16} className="text-brand" />Your profile</h2>
        <form className={`${settingsList} block`} onSubmit={saveName} noValidate>
          <div className={settingsRow}>
            <span className="min-w-[110px] text-[11px] font-bold text-ink">Display name</span>
            <span className="flex flex-1 flex-wrap items-center gap-2">
              <input
                className={`${modalControlRow} max-w-[280px]`}
                value={name}
                onChange={(event) => { setName(event.target.value); setNameSaved(false); }}
                maxLength={120}
                placeholder="Your name"
                aria-label="Display name"
                disabled={userLoading || !user}
              />
              <button className={`${button} ${buttonPrimary} ${buttonSmall}`} type="submit" disabled={savingName || userLoading || !user}>
                {savingName ? "Saving..." : "Save"}
              </button>
            </span>
          </div>
          <div className={settingsRow}>
            <span className="min-w-[110px] text-[11px] font-bold text-ink">Signed in as</span>
            <span className="flex flex-1 flex-wrap items-center gap-2 text-[11px] text-muted">
              {user?.email ?? "—"}
              {role && <span className={`${rolePill} ${rolePillTone[role] ?? ""}`}>{role}</span>}
            </span>
          </div>
          <div className={settingsRow}>
            <span className="min-w-[110px] text-[11px] font-bold text-ink">What this role can do</span>
            <span className="flex-1 text-[11px] leading-[1.7] text-muted">{ROLE_NOTE[role ?? ""] ?? "Unknown role."}</span>
          </div>
        </form>
      </section>

      <section className="mb-5">
        <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink"><Sun size={16} className="text-brand" />Appearance</h2>
        <div className={settingsList}>
          <div className={settingsRow}>
            <span className="min-w-[110px] text-[11px] font-bold text-ink">Theme</span>
            <span className="flex flex-1 flex-wrap items-center gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={theme === option.value}
                  className={`${button} ${buttonSmall} ${theme === option.value ? buttonPrimary : buttonSecondary}`}
                >
                  {option.value === "light" ? <Sun size={13} /> : option.value === "dark" ? <Moon size={13} /> : <Monitor size={13} />}
                  {option.label}
                </button>
              ))}
            </span>
          </div>
          <div className={settingsRow}>
            <span className="min-w-[110px] text-[11px] font-bold text-ink">Stored</span>
            <span className="flex-1 text-[11px] text-muted">The choice is kept in this browser only, and applied before the first paint so the page never flashes the wrong theme.</span>
          </div>
        </div>
      </section>

      <section className="mb-5" id="desktop">
        <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink"><Bell size={16} className="text-brand" />Desktop notifications</h2>
        <div className={settingsList}>
          <div className={settingsRow}>
            {desktop === "granted" ? <CheckCircle2 size={18} className="text-success" /> : desktop === "denied" ? <ShieldAlert size={18} className="text-warn" /> : <Bell size={18} className="text-muted" />}
            <span className="flex-1">
              <strong className="block text-xs">Status</strong>
              <small className="mt-1 block text-[11px] text-muted">
                {desktop === "granted"
                  ? "On. A popup appears when a new alarm is created, and clicking it opens that alarm."
                  : desktop === "denied"
                    ? "Blocked by the browser, so no popup can appear. Click the padlock or the settings icon beside the address bar, allow notifications for this site, then reload."
                    : desktop === "unsupported"
                      ? "This browser has no notification support. The in-app bell still works."
                      : "Off. Turning them on asks the browser once, and nothing is sent anywhere."}
              </small>
            </span>
            {desktop === "granted" ? (
              <span className={`${recordStatus} ${statusTone.running}`}>on</span>
            ) : desktop === "default" ? (
              <button className={`${button} ${buttonSmall} ${buttonPrimary}`} type="button" onClick={() => void enableDesktop()}>Turn on</button>
            ) : null}
          </div>
          <div className={settingsRow}>
            <span className="min-w-[110px] text-[11px] font-bold text-ink">Stored</span>
            <span className="flex-1 text-[11px] text-muted">
              {desktop === "granted"
                ? "The browser holds this permission, not this site. There is nothing here to clear."
                : offerDismissed
                  ? "You dismissed the offer in the notification bell, so it no longer appears there."
                  : "The bell shows a one-line offer until you turn them on or dismiss it."}
            </span>
          </div>
          {offerDismissed && desktop !== "granted" && (
            <div className={settingsRow}>
              <RotateCcw size={18} className="text-muted" />
              <span className="flex-1">
                <strong className="block text-xs">Show the offer again</strong>
                <small className="mt-1 block text-[11px] text-muted">Puts the one-line offer back in the bell. It is only a prompt, nothing is sent until you allow it.</small>
              </span>
              <button className={`${button} ${buttonSmall} ${buttonSecondary}`} type="button" onClick={restoreDesktopOffer}>Restore</button>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink"><Database size={16} className="text-brand" />System</h2>
        <div className={settingsList}>
          <div className={settingsRow}>
            {connection === "ok" ? <CheckCircle2 size={18} className="text-success" /> : <LockKeyhole size={18} className="text-muted" />}
            <span className="flex-1">
              <strong className="block text-xs">Supabase connection</strong>
              <small className="mt-1 block text-[11px] text-muted">
                {connection === "checking" ? "Checking..." : connection === "ok" ? "Reachable. The figures below were read from the database just now." : "Not reachable. Check the two NEXT_PUBLIC_ variables and that the project is running."}
              </small>
            </span>
            {connection !== "checking" && (
              <span className={`${recordStatus} ${connection === "ok" ? statusTone.running : statusTone.stop}`}>{connection === "ok" ? "connected" : "unreachable"}</span>
            )}
          </div>
          <div className={settingsRow}>
            <Database size={18} className="text-muted" />
            <span className="flex-1">
              <strong className="block text-xs">Visible records</strong>
              <small className="mt-1 block text-[11px] text-muted">
                {counters
                  ? `${counters.machines} machines · ${counters.alarms} alarms · ${counters.maintenance} maintenance records, counting only what your role may read.`
                  : connection === "failed" ? "Unavailable while the connection is down." : "Counting..."}
              </small>
            </span>
          </div>
          <div className={settingsRow}>
            <LockKeyhole size={18} className="text-muted" />
            <span className="flex-1">
              <strong className="block text-xs">Where permissions are decided</strong>
              <small className="mt-1 block text-[11px] text-muted">Row Level Security in the database, not the interface. Hiding a button is a convenience; a policy is the boundary.</small>
            </span>
          </div>
          {counters === null && connection !== "failed" && <div className={moduleEmpty}>Reading the record counts...</div>}
        </div>
      </section>

      <p className={moduleFootnote}>
        Nothing on this page changes what the database will accept. A role can only be changed by an Admin from the Users page, and every write still passes through the same policies.
      </p>
    </main>
  );
}
