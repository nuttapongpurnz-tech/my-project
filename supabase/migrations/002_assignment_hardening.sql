-- Assignment hardening migration.
-- Run this after 001_initial_schema.sql in the Supabase SQL editor.
-- The guards keep the migration safe when the constraints are already present
-- in a database created from the latest version of 001_initial_schema.sql.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'machines_machine_id_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.machines drop constraint if exists machines_machine_id_not_blank;
    alter table public.machines add constraint machines_machine_id_not_blank check (length(btrim(machine_id)) between 2 and 32);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'machines_machine_id_format') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.machines drop constraint if exists machines_machine_id_format;
    alter table public.machines add constraint machines_machine_id_format check (machine_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'machines_machine_name_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.machines drop constraint if exists machines_machine_name_not_blank;
    alter table public.machines add constraint machines_machine_name_not_blank check (length(btrim(machine_name)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'machines_machine_type_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.machines drop constraint if exists machines_machine_type_not_blank;
    alter table public.machines add constraint machines_machine_type_not_blank check (length(btrim(machine_type)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'machines_location_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.machines drop constraint if exists machines_location_not_blank;
    alter table public.machines add constraint machines_location_not_blank check (length(btrim(location)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'alarms_code_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.alarms drop constraint if exists alarms_code_not_blank;
    alter table public.alarms add constraint alarms_code_not_blank check (length(btrim(alarm_code)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'alarms_description_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.alarms drop constraint if exists alarms_description_not_blank;
    alter table public.alarms add constraint alarms_description_not_blank check (length(btrim(description)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maintenance_problem_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.maintenance_records drop constraint if exists maintenance_problem_not_blank;
    alter table public.maintenance_records add constraint maintenance_problem_not_blank check (length(btrim(problem)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maintenance_action_not_blank') then
    -- Re-runnable: drop first, because PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS.
    alter table public.maintenance_records drop constraint if exists maintenance_action_not_blank;
    alter table public.maintenance_records add constraint maintenance_action_not_blank check (length(btrim(action_taken)) > 0);
  end if;
end
$$;

-- Resolution text must contain actual content, not only non-null whitespace values.
alter table public.alarms drop constraint if exists closed_alarm_has_resolution;
alter table public.alarms add constraint closed_alarm_has_resolution check (
  status <> 'closed'
  or (
    length(btrim(coalesce(cause, ''))) > 0
    and length(btrim(coalesce(action_taken, ''))) > 0
    and closed_by is not null
    and closed_at is not null
  )
);

-- Machine IDs are case-insensitive from the application's point of view.
create unique index if not exists machines_machine_id_lower_unique
  on public.machines (lower(machine_id));

-- Keep the existing 001 policy compatible with installations that already ran it.
drop policy if exists "authenticated users can read profiles" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "admins read profiles" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- Admins may remove records when no foreign-key relationship prevents it.
drop policy if exists "admins delete alarms" on public.alarms;
create policy "admins delete alarms" on public.alarms
  for delete to authenticated using (public.is_admin());

drop policy if exists "admins delete maintenance" on public.maintenance_records;
create policy "admins delete maintenance" on public.maintenance_records
  for delete to authenticated using (public.is_admin());

-- Keep closure metadata correct when an alarm is reopened or created as closed.
create or replace function public.set_record_actor() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'alarms' then
    if tg_op = 'INSERT' then
      new.created_by = coalesce(auth.uid(), new.created_by);
      if new.status = 'closed' then
        new.closed_by = auth.uid();
        new.closed_at = now();
      else
        new.closed_by = null;
        new.closed_at = null;
      end if;
    else
      new.id = old.id;
      new.created_by = old.created_by;
      new.created_at = old.created_at;
      if new.status = 'closed' then
        if old.status <> 'closed' then
          new.closed_by = auth.uid();
          new.closed_at = now();
        else
          new.closed_by = old.closed_by;
          new.closed_at = old.closed_at;
        end if;
      else
        new.closed_by = null;
        new.closed_at = null;
      end if;
      if not public.is_admin() then
        if new.machine_id <> old.machine_id or new.alarm_code <> old.alarm_code or new.description <> old.description or new.occurred_at <> old.occurred_at then
          raise exception 'technicians can only update alarm workflow fields';
        end if;
      end if;
    end if;
  elsif tg_table_name = 'maintenance_records' then
    if tg_op = 'INSERT' then
      new.created_by = coalesce(auth.uid(), new.created_by);
      if new.status = 'completed' then new.completed_at = now(); else new.completed_at = null; end if;
    else
      new.id = old.id;
      new.created_by = old.created_by;
      new.created_at = old.created_at;
      if new.status = 'completed' then
        if old.status = 'completed' then new.completed_at = old.completed_at; else new.completed_at = now(); end if;
      else
        new.completed_at = null;
      end if;
      if not public.is_admin() and auth.uid() is not null then
        new.technician_id = auth.uid();
        if new.machine_id <> old.machine_id then
          raise exception 'technicians cannot change maintenance ownership';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
