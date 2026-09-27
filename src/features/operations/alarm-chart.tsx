"use client";

import { useMemo, useState } from "react";
import type { Alarm } from "@/lib/operations/types";
import { plural } from "@/lib/operations/format";

/**
 * Bonus requirement: an alarm-count chart.
 *
 * Groups the alarms that fall inside the selected range into one bucket per
 * day and draws simple CSS bars, so the chart needs no charting dependency and
 * inherits the light/dark palette from the theme tokens.
 */
export function AlarmChart({ alarms, days = 7 }: { alarms: Alarm[]; days?: number }) {
  const buckets = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const series = Array.from({ length: days }, (_, index) => {
      const end = new Date(today);
      end.setDate(today.getDate() - (days - 1 - index));
      const start = new Date(end);
      start.setDate(end.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: end.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), total: 0, open: 0, closed: 0 };
    });

    for (const alarm of alarms) {
      const at = new Date(alarm.occurred_at).getTime();
      const bucket = series.find((slot) => at >= slot.start.getTime() && at < slot.end.getTime());
      if (!bucket) continue;
      bucket.total += 1;
      if (alarm.status === "open" || alarm.status === "in_progress") bucket.open += 1;
      else bucket.closed += 1;
    }
    return series;
  }, [alarms, days]);

  const peak = Math.max(1, ...buckets.map((bucket) => bucket.total));
  const [hover, setHover] = useState<number | null>(null);

  // Heights are computed in pixels rather than percentages. A percentage height
  // resolves against the parent's height, and these columns are sized by flex,
  // so a percentage would collapse to zero and no bar would be visible.
  const PLOT_HEIGHT = 96;
  const scale = (value: number) => (value === 0 ? 0 : Math.max(5, Math.round((value / peak) * PLOT_HEIGHT)));

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-4 text-[9px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-danger" />Still active</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" />Closed</span>
      </div>
      <div className="flex items-end gap-1.5" role="img" aria-label={`Alarms per day over the last ${days} days`}>
        {buckets.map((bucket, index) => {
          const activeHeight = scale(bucket.open);
          const closedHeight = scale(bucket.closed);
          return (
            <div
              key={bucket.label}
              className="flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              title={`${bucket.label}: ${plural(bucket.total, "alarm")}`}
            >
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-[3px]" style={{ height: PLOT_HEIGHT }}>
                {activeHeight > 0 && <div className="w-full bg-danger" style={{ height: activeHeight }} />}
                {closedHeight > 0 && <div className={`w-full bg-success ${activeHeight > 0 ? "" : "rounded-t-[3px]"}`} style={{ height: closedHeight }} />}
                {bucket.total === 0 && <div className="w-full rounded-t-[3px] bg-line" style={{ height: 3 }} />}
              </div>
              <span className={`mt-1.5 text-center text-[8px] ${hover === index ? "font-bold text-ink" : "text-[color:var(--color-faint)]"}`}>{bucket.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-center text-[9px] text-muted">
        {plural(buckets.reduce((sum, bucket) => sum + bucket.total, 0), "alarm")} over the last {plural(days, "day")} · peak {peak}/day
      </p>
    </div>
  );
}
