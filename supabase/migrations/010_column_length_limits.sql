-- 010_column_length_limits.sql
--
-- Runs after 009_audit_change_requests.sql.
--
-- Problem: every maximum length was enforced only in the browser. The forms use
-- maxLength and the validators throw above the limit, but a direct call to the
-- PostgREST endpoint bypasses both, so a caller that never opens the interface
-- could store an unbounded string in any text column. Empty and enum rules were
-- already in the database; length rules were not.
--
-- The limits below are the same numbers the forms use, so a value the interface
-- accepts is still accepted and one it rejects is now rejected by the database
-- too. Nothing changes for a user of the application.
--
--   machines               machine_id 32, machine_name 120,
--                          machine_type 80, location 160
--   alarms                 alarm_code 80, description 1000,
--                          cause 2000, action_taken 2000
--   maintenance_records    problem 2000, action_taken 2000
--   profiles               display_name 120
--   change_requests        description 2000, review_note 2000
--
-- change_requests.title already had a 3-120 check from migration 006 and is
-- left alone.
--
-- audit_log is written by a trigger from to_jsonb of the audited row and is not
-- user-editable, so it is deliberately not constrained. Constraining it would
-- only risk the trigger failing on a legitimate write.
--
-- Each constraint is dropped before it is added, because PostgreSQL has no ADD
-- CONSTRAINT IF NOT EXISTS. The whole file is safe to run more than once.

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------
-- machine_id already has machines_machine_id_not_blank covering 2-32.

alter table public.machines drop constraint if exists machines_machine_name_length;
alter table public.machines add constraint machines_machine_name_length
  check (length(machine_name) <= 120);

alter table public.machines drop constraint if exists machines_machine_type_length;
alter table public.machines add constraint machines_machine_type_length
  check (length(machine_type) <= 80);

alter table public.machines drop constraint if exists machines_location_length;
alter table public.machines add constraint machines_location_length
  check (length(location) <= 160);

-- ---------------------------------------------------------------------------
-- alarms
-- ---------------------------------------------------------------------------
alter table public.alarms drop constraint if exists alarms_code_length;
alter table public.alarms add constraint alarms_code_length
  check (length(alarm_code) <= 80);

alter table public.alarms drop constraint if exists alarms_description_length;
alter table public.alarms add constraint alarms_description_length
  check (length(description) <= 1000);

alter table public.alarms drop constraint if exists alarms_cause_length;
alter table public.alarms add constraint alarms_cause_length
  check (cause is null or length(cause) <= 2000);

alter table public.alarms drop constraint if exists alarms_action_taken_length;
alter table public.alarms add constraint alarms_action_taken_length
  check (action_taken is null or length(action_taken) <= 2000);

-- ---------------------------------------------------------------------------
-- maintenance_records
-- ---------------------------------------------------------------------------
alter table public.maintenance_records drop constraint if exists maintenance_problem_length;
alter table public.maintenance_records add constraint maintenance_problem_length
  check (length(problem) <= 2000);

alter table public.maintenance_records drop constraint if exists maintenance_action_length;
alter table public.maintenance_records add constraint maintenance_action_length
  check (length(action_taken) <= 2000);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- 120 is generous for a display name and matches what the sign-up form allows,
-- so a long name is stored rather than truncated silently.
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length
  check (length(display_name) <= 120);

-- ---------------------------------------------------------------------------
-- change_requests
-- ---------------------------------------------------------------------------
alter table public.change_requests drop constraint if exists change_requests_description_length;
alter table public.change_requests add constraint change_requests_description_length
  check (length(description) <= 2000);

alter table public.change_requests drop constraint if exists change_requests_review_note_length;
alter table public.change_requests add constraint change_requests_review_note_length
  check (review_note is null or length(review_note) <= 2000);

-- ---------------------------------------------------------------------------
-- Report what is now in place
-- ---------------------------------------------------------------------------
select
  c.relname as table_name,
  count(*) filter (where pg_get_constraintdef(con.oid) ilike '%length%') as length_checks
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'machines', 'alarms', 'maintenance_records', 'change_requests')
  and con.contype = 'c'
group by c.relname
order by c.relname;
