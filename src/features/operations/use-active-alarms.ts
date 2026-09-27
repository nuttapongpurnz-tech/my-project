"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { onAlarmsChanged } from "@/lib/operations/alarm-events";

/**
 * An alarm that still needs attention, with the machine code joined on.
 *
 * Only the fields the bell draws, so the header query stays small. The machine
 * code comes from the foreign key rather than a second request, which is why
 * this type is not the full `Alarm`.
 */
export type ActiveAlarm = {
  id: string;
  machine_id: string;
  alarm_code: string;
  description: string;
  status: string;
  occurred_at: string;
  /** The embedded machine, absent when the machine row is not visible. */
  machine_code: string | null;
};

export type ActiveAlarms = {
  alarms: ActiveAlarm[];
  machineName: (id: string) => string;
  loading: boolean;
};

const SELECT = "id, machine_id, alarm_code, description, status, occurred_at, machines(machine_id)";

/**
 * The alarms that still need attention, for the header notification bell.
 *
 * The machine code is joined in the same request so the bell can name a machine
 * without a second round trip, and only non-closed rows are fetched because
 * nothing else is ever shown there.
 *
 * It refetches whenever an alarm is written anywhere in the app, and when the
 * window regains focus. Fetching once on mount was the bug: closing an alarm
 * left it in the bell for the rest of the session, so the bell reported an alarm
 * as open when it was not. A closed alarm has to disappear the moment it is
 * closed, otherwise the badge is worse than no badge.
 *
 * The dashboard passes its own already-loaded list instead of using this, so the
 * alarm queue and the bell there cannot disagree.
 */
export function useActiveAlarms(): ActiveAlarms {
  const [rows, setRows] = useState<ActiveAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refetch = () => setNonce((n) => n + 1);

  useEffect(() => onAlarmsChanged(refetch), []);

  // A write in another tab, or one made while this tab was in the background,
  // reaches this window through focus rather than through the bus.
  useEffect(() => {
    function onFocus() { refetch(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await createClient()
          .from("alarms")
          .select(SELECT)
          .neq("status", "closed")
          .order("occurred_at", { ascending: false })
          .limit(50);
        if (!active || result.error) return;
        // PostgREST returns an embedded to-one relation as a single-row array.
        setRows(
          (result.data ?? []).map((row) => {
            const embedded = row.machines as unknown as { machine_id: string }[] | { machine_id: string } | null;
            const code = Array.isArray(embedded) ? embedded[0]?.machine_id : embedded?.machine_id;
            return {
              id: row.id as string,
              machine_id: row.machine_id as string,
              alarm_code: row.alarm_code as string,
              description: row.description as string,
              status: row.status as string,
              occurred_at: row.occurred_at as string,
              machine_code: code ?? null,
            };
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [nonce]);

  // Rebuilt only when the rows change, not on every render, because the bell
  // calls this once per row it draws.
  const machineName = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of rows) {
      if (row.machine_code) names.set(row.machine_id, row.machine_code);
    }
    return (id: string) => names.get(id) ?? "Unknown machine";
  }, [rows]);

  return { alarms: rows, machineName, loading };
}
