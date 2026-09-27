import type { SupabaseClient } from "@supabase/supabase-js";

export const MACHINE_LIST_COLUMNS = "id, machine_id, machine_name, machine_type, location, status, updated_at";

/**
 * Enough of a machine to name it in a list and to know whether it is retired.
 *
 * `is_archived` has to be selected wherever a machine is looked up by id, because
 * a record such as an alarm can point at a machine that has since been archived.
 * Reading only the active machines left those records unnameable and the
 * interface fell back to "Unknown machine".
 */
export const MACHINE_REFERENCE_COLUMNS = "id, machine_id, machine_name, status, is_archived";

type QueryError = { code?: string; message?: string } | null;

export type MachineQueryResult<T> = { data: T[] | null; error: QueryError };

/** A machine as far as a record that points at it needs to know. */
export type MachineReference = {
  id: string;
  machine_id: string;
  machine_name: string;
  status: string;
  is_archived: boolean | null;
};

/**
 * Reads every machine, archived ones included.
 *
 * Callers use this to resolve a record's machine by id. An alarm or a maintenance
 * record can outlive the machine it points at, because both tables delete with
 * `on delete restrict`, so reading only the active rows left those records
 * unnameable. Filter with `isActive` where the list itself should exclude retired
 * machines, such as a form that creates a new alarm.
 */
export async function listMachines<T>(
  supabase: SupabaseClient,
  columns: string = MACHINE_REFERENCE_COLUMNS,
): Promise<MachineQueryResult<T>> {
  const result = await supabase.from("machines").select(columns).order("machine_id");
  // null on failure, not an empty array. An empty array is a truthful answer to
  // "are there any machines", and a caller that read it without checking the
  // error would render an empty plant instead of reporting a failed query.
  if (result.error) return { data: null, error: result.error };
  return { data: (result.data ?? []) as T[], error: null };
}

/**
 * True when a machine is still in service.
 *
 * A null flag is treated as active so a row selected without `is_archived` is
 * never silently dropped from a list.
 */
export function isActive(machine: { is_archived?: boolean | null }): boolean {
  return !machine.is_archived;
}

/** The machines still in service, for a form that creates a new record. */
export function activeMachines<T extends { is_archived?: boolean | null }>(machines: T[]): T[] {
  return machines.filter(isActive);
}

/**
 * Builds the lookup that turns a machine_id into a readable name.
 *
 * Returns a function rather than a map because every caller needs exactly the
 * same "what do I print for this id" question, and a miss should read
 * "Unknown machine" everywhere instead of leaking a raw uuid into the table.
 */
export function machineNameLookup(machines: { id: string; machine_id: string }[]): (id: string) => string {
  const names = new Map(machines.map((machine) => [machine.id, machine.machine_id]));
  return (id: string) => names.get(id) ?? "Unknown machine";
}

/**
 * Toggles the archive flag on a machine and returns the updated row.
 */
export async function setMachineArchived(supabase: SupabaseClient, machineId: string, isArchived: boolean) {
  return supabase
    .from("machines")
    .update({ is_archived: isArchived })
    .eq("id", machineId)
    .select()
    .single();
}
