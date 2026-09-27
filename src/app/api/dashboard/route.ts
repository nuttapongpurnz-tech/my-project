import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Alarm, Machine, MaintenanceRecord } from "@/lib/operations/types";
import { MACHINE_REFERENCE_COLUMNS, listMachines } from "@/lib/operations/machines";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [machineResult, alarmResult, maintenanceResult] = await Promise.all([
      // Every machine, so an alarm on a retired machine can still be named.
      // Archived rows are filtered out of the counts below instead of the query.
      listMachines<Machine & { is_archived?: boolean }>(supabase, MACHINE_REFERENCE_COLUMNS),
      supabase.from("alarms").select("id, machine_id, alarm_code, description, occurred_at, cause, action_taken, status, closed_at, updated_at").order("occurred_at", { ascending: false }),
      supabase.from("maintenance_records").select("id, machine_id, technician_id, problem, action_taken, started_at, completed_at, status, updated_at").order("started_at", { ascending: false }),
    ]);

    if (machineResult.error || alarmResult.error || maintenanceResult.error) {
      return NextResponse.json({ error: "Unable to load dashboard data." }, { status: 503 });
    }

    const everyMachine = machineResult.data ?? [];
    // A retired machine is no longer producing, so it must not appear in the
    // status breakdown or the total, but its id is still needed to name records.
    const machineRows = everyMachine.filter((row) => !row.is_archived);
    const alarmRows = (alarmResult.data ?? []) as Alarm[];
    const maintenanceRows = (maintenanceResult.data ?? []) as MaintenanceRecord[];

    return NextResponse.json({
      totalMachines: machineRows.length,
      running: machineRows.filter((row) => row.status === "running").length,
      stop: machineRows.filter((row) => row.status === "stop").length,
      alarm: machineRows.filter((row) => row.status === "alarm").length,
      maintenance: machineRows.filter((row) => row.status === "maintenance").length,
      activeAlarms: alarmRows.filter((row) => row.status !== "closed").length,
      maintenanceRecords: maintenanceRows.length,
      completedMaintenance: maintenanceRows.filter((row) => row.status === "completed").length,
      machines: everyMachine,
      alarms: alarmRows,
      maintenanceRows,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Dashboard is unavailable." }, { status: 503 });
  }
}
