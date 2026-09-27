export const MACHINE_STATUSES = ["running", "stop", "alarm", "maintenance"] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const ALARM_STATUSES = ["open", "in_progress", "closed"] as const;
export type AlarmStatus = (typeof ALARM_STATUSES)[number];

export const MAINTENANCE_STATUSES = ["in_progress", "waiting_part", "completed"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  in_progress: "In progress",
  waiting_part: "Waiting part",
  completed: "Completed",
};

/** `viewer` is a read-only role added for the bonus requirements. */
export const APP_ROLES = ["admin", "technician", "viewer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  technician: "Technician",
  viewer: "Viewer (read-only)",
};

/** Roles that may change data. A viewer can only read. */
export const WRITE_ROLES: readonly AppRole[] = ["admin", "technician"];


export type Machine = {
  id: string;
  machine_id: string;
  machine_name: string;
  machine_type: string;
  location: string;
  status: MachineStatus | string;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Alarm = {
  id: string;
  machine_id: string;
  alarm_code: string;
  description: string;
  occurred_at: string;
  cause: string | null;
  action_taken: string | null;
  status: AlarmStatus | string;
  created_by?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MaintenanceRecord = {
  id: string;
  machine_id: string;
  technician_id: string;
  problem: string;
  action_taken: string;
  started_at: string;
  completed_at?: string | null;
  status: MaintenanceStatus | string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};
