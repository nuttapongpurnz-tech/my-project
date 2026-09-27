-- ===========================================================================
-- bootstrap.sql  --  GENERATED FILE, DO NOT EDIT BY HAND
-- ===========================================================================
--
-- Rebuild it after changing anything under supabase/:
--
--     node supabase/build-bootstrap.mjs
--
-- What it is: every migration in supabase/migrations, in order, followed by
-- supabase/seed.sql, concatenated into one script.
--
-- How to use it: Supabase dashboard -> SQL Editor -> New query -> paste this
-- whole file -> Run. On a brand new project this builds the schema, the
-- policies, the triggers and the demo data in a single pass, and running it a
-- second time is safe because every statement is idempotent.
--
-- If you would rather see the steps separately, run the files in
-- supabase/migrations in numeric order and then supabase/seed.sql.
--
-- Sign-up creates a profile for you. setup.sql used to promote the first
-- account to Admin, but that is not done here: an account has to exist before
-- it can be promoted, so do it by signing up and then running the promote
-- statement printed at the end of this file.
--
-- Contents, in order:
--    1. 001_initial_schema.sql  (sha256:0ab3dabdde15)
--    2. 002_assignment_hardening.sql  (sha256:282ffcb4f341)
--    3. 003_signup_role.sql  (sha256:586682d39a80)
--    4. 004_machine_soft_delete.sql  (sha256:9054450d99b4)
--    5. 005_signup_role_enforcement.sql  (sha256:a57c5e577b40)
--    6. 006_bonus_features.sql  (sha256:745dfc484bee)
--    7. 007_seed_viewer_account.sql  (sha256:613971340fda)
--    8. 008_seed_friendly_actor_defaults.sql  (sha256:361d7072a4c1)
--    9. 009_audit_change_requests.sql  (sha256:352304462be5)
--   10. 010_column_length_limits.sql  (sha256:08179732e311)
--   11. 011_profile_self_service.sql  (sha256:f31c17bc7763)
--   12. seed.sql  (sha256:b1a7e04a6342)
-- ===========================================================================

-- ==========================================================================
-- 001_initial_schema.sql
-- sha256:0ab3dabdde15
-- ==========================================================================
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'app_role') then
    create type public.app_role as enum ('admin', 'technician');
  end if;
end
$$;
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'machine_status') then
    create type public.machine_status as enum ('running', 'stop', 'alarm', 'maintenance');
  end if;
end
$$;
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'alarm_status') then
    create type public.alarm_status as enum ('open', 'in_progress', 'closed');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'technician',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null unique,
  machine_name text not null,
  machine_type text not null,
  location text not null,
  status public.machine_status not null default 'stop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_machine_id_not_blank check (length(btrim(machine_id)) between 2 and 32),
  constraint machines_machine_id_format check (machine_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$'),
  constraint machines_machine_name_not_blank check (length(btrim(machine_name)) > 0),
  constraint machines_machine_type_not_blank check (length(btrim(machine_type)) > 0),
  constraint machines_location_not_blank check (length(btrim(location)) > 0)
);

create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete restrict,
  alarm_code text not null,
  description text not null,
  occurred_at timestamptz not null,
  cause text,
  action_taken text,
  status public.alarm_status not null default 'open',
  created_by uuid not null references public.profiles(id) on delete restrict,
  closed_by uuid references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alarms_code_not_blank check (length(btrim(alarm_code)) > 0),
  constraint alarms_description_not_blank check (length(btrim(description)) > 0),
  constraint closed_alarm_has_resolution check (status <> 'closed' or (length(btrim(coalesce(cause, ''))) > 0 and length(btrim(coalesce(action_taken, ''))) > 0 and closed_by is not null and closed_at is not null))
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete restrict,
  technician_id uuid not null references public.profiles(id) on delete restrict,
  problem text not null,
  action_taken text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_problem_not_blank check (length(btrim(problem)) > 0),
  constraint maintenance_action_not_blank check (length(btrim(action_taken)) > 0),
  constraint maintenance_dates_valid check (completed_at is null or completed_at >= started_at)
);

create index if not exists alarms_status_idx on public.alarms(status);
create index if not exists alarms_machine_idx on public.alarms(machine_id);
create index if not exists alarms_occurred_idx on public.alarms(occurred_at desc);
create index if not exists maintenance_machine_idx on public.maintenance_records(machine_id);
create index if not exists maintenance_technician_idx on public.maintenance_records(technician_id);
create unique index if not exists machines_machine_id_lower_unique on public.machines(lower(machine_id));

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists machines_updated_at on public.machines;
create trigger machines_updated_at before update on public.machines for each row execute function public.set_updated_at();
drop trigger if exists alarms_updated_at on public.alarms;
create trigger alarms_updated_at before update on public.alarms for each row execute function public.set_updated_at();
drop trigger if exists maintenance_updated_at on public.maintenance_records;
create trigger maintenance_updated_at before update on public.maintenance_records for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'admin'
      then 'admin'::public.app_role
      else 'technician'::public.app_role
    end
  );
  return new;
end;
$$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop trigger if exists alarms_actor on public.alarms;
create trigger alarms_actor before insert or update on public.alarms for each row execute function public.set_record_actor();
drop trigger if exists maintenance_actor on public.maintenance_records;
create trigger maintenance_actor before insert or update on public.maintenance_records for each row execute function public.set_record_actor();

alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.alarms enable row level security;
alter table public.maintenance_records enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "authenticated users read machines" on public.machines;
create policy "authenticated users read machines" on public.machines for select to authenticated using (true);
drop policy if exists "admins manage machines" on public.machines;
create policy "admins manage machines" on public.machines for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "authenticated users read alarms" on public.alarms;
create policy "authenticated users read alarms" on public.alarms for select to authenticated using (true);
drop policy if exists "authenticated users create alarms" on public.alarms;
create policy "authenticated users create alarms" on public.alarms for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "admins update alarms" on public.alarms;
create policy "admins update alarms" on public.alarms for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "technicians update alarm workflow" on public.alarms;
create policy "technicians update alarm workflow" on public.alarms for update to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'technician')) with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'technician'));
drop policy if exists "authenticated users read maintenance" on public.maintenance_records;
create policy "authenticated users read maintenance" on public.maintenance_records for select to authenticated using (true);
drop policy if exists "admins or technicians create maintenance" on public.maintenance_records;
create policy "admins or technicians create maintenance" on public.maintenance_records for insert to authenticated with check ((public.is_admin() or technician_id = auth.uid()) and created_by = auth.uid());
drop policy if exists "admins or assigned technicians update maintenance" on public.maintenance_records;
create policy "admins or assigned technicians update maintenance" on public.maintenance_records for update to authenticated using (public.is_admin() or technician_id = auth.uid()) with check (public.is_admin() or technician_id = auth.uid());
drop policy if exists "admins delete alarms" on public.alarms;
create policy "admins delete alarms" on public.alarms for delete to authenticated using (public.is_admin());
drop policy if exists "admins delete maintenance" on public.maintenance_records;
create policy "admins delete maintenance" on public.maintenance_records for delete to authenticated using (public.is_admin());

-- ==========================================================================
-- 002_assignment_hardening.sql
-- sha256:282ffcb4f341
-- ==========================================================================
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

-- ==========================================================================
-- 003_signup_role.sql
-- sha256:586682d39a80
-- ==========================================================================
-- Allow the signup form to submit a role.
-- Run this after 001_initial_schema.sql and 002_assignment_hardening.sql.

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'admin'
      then 'admin'::public.app_role
      else 'technician'::public.app_role
    end
  );
  return new;
end;
$$;

-- ==========================================================================
-- 004_machine_soft_delete.sql
-- sha256:9054450d99b4
-- ==========================================================================
-- Machine soft delete.
-- Run this after 001_initial_schema.sql, 002_assignment_hardening.sql and 003_signup_role.sql
-- in the Supabase SQL editor.
--
-- Instead of removing the row, archiving keeps the machine id on every historical
-- alarm and maintenance record readable, and lets an admin restore it later.

alter table public.machines add column if not exists is_archived boolean not null default false;
alter table public.machines add column if not exists archived_at timestamptz;
alter table public.machines add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists machines_active_idx on public.machines(machine_id) where is_archived = false;

-- An archived machine is idle by definition. Clear the status so archived rows
-- never inflate the running/stop/alarm/maintenance counters on the dashboard.
alter table public.machines drop constraint if exists archived_machine_is_stopped;
alter table public.machines add constraint archived_machine_is_stopped
  check (not is_archived or status = 'stop');

-- Record who archived the machine and when, and keep archived_at in step with the flag.
create or replace function public.set_machine_archive_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.is_archived then
      new.archived_by = coalesce(auth.uid(), new.archived_by);
      new.archived_at = coalesce(new.archived_at, now());
    else
      new.archived_at = null;
      new.archived_by = null;
    end if;
    return new;
  end if;

  new.id = old.id;
  new.created_at = old.created_at;

  if new.is_archived and not old.is_archived then
    new.archived_by = coalesce(auth.uid(), old.archived_by);
    new.archived_at = coalesce(new.archived_at, now());
    new.status = 'stop';
  elsif not new.is_archived and old.is_archived then
    new.archived_at = null;
    new.archived_by = null;
  else
    new.archived_at = old.archived_at;
    new.archived_by = old.archived_by;
  end if;

  -- Only an admin may archive or restore a machine. The row-level policies already
  -- restrict writes to admins, this keeps the intent enforced inside the database too.
  if not public.is_admin() then
    if new.is_archived <> old.is_archived then
      raise exception 'only admins can archive or restore machines';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists machines_archive_actor on public.machines;
create trigger machines_archive_actor before insert or update on public.machines
  for each row execute function public.set_machine_archive_actor();

-- ==========================================================================
-- 005_signup_role_enforcement.sql
-- sha256:a57c5e577b40
-- ==========================================================================
-- 005_signup_role_enforcement.sql
--
-- Fixes sign-up always producing a Technician profile.
--
-- Symptom: signing up through /login with the Admin role selected stores
-- role = 'technician' in public.profiles, even though auth.users
-- raw_user_meta_data correctly contains "role": "admin".
--
-- Cause: this only happens when the deployed public.handle_new_user() is an
-- older revision that hardcodes 'technician' and never reads the role from
-- raw_user_meta_data. Migration 003 only replaces the function, and it assumes
-- the on_auth_user_created trigger was already wired up by 001. This migration
-- makes both halves explicit and idempotent, so it is safe to re-run.
--
-- Run this in the Supabase SQL Editor, then sign up again.
-- Existing accounts are NOT changed by this file; see the note at the bottom.

-- 1. Role-aware trigger function.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    case when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'admin'
      then 'admin'::public.app_role
      else 'technician'::public.app_role
    end
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        role = excluded.role;
  return new;
end;
$$;

-- 2. Guarantee the trigger exists and points at the function above.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Backfill any profile that has no row yet (for example accounts created
--    while the trigger was missing).
insert into public.profiles (id, display_name, role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1)),
  case when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) = 'admin'
    then 'admin'::public.app_role
    else 'technician'::public.app_role
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- Promote an account that was created before this fix, or that was created in
-- the Supabase dashboard (the dashboard sends no role metadata, so the trigger
-- correctly falls back to technician). Replace the UUID and run by hand:
--
--   update public.profiles
--   set role = 'admin'
--   where id = 'AUTH-USER-UUID-HERE';
--
-- Verify after running this file:
--
--   select u.email, p.role, u.raw_user_meta_data ->> 'role' as requested_role
--   from auth.users u
--   join public.profiles p on p.id = u.id
--   order by u.created_at desc;
-- ---------------------------------------------------------------------------

-- ==========================================================================
-- 006_bonus_features.sql
-- sha256:745dfc484bee
-- ==========================================================================
-- 006_bonus_features.sql
--
-- Assignment section 7 (Bonus) support. Adds a read-only Viewer role, a
-- Waiting Part maintenance status, automatic audit logging and a change
-- request workflow that an Admin approves.
--
-- Run this in the Supabase SQL Editor after 005_signup_role_enforcement.sql.
-- It is idempotent, so re-running it is safe.

-- ---------------------------------------------------------------------------
-- 1. Viewer role
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on t.oid = e.enumtypid
                 join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'app_role'
                   and e.enumlabel = 'viewer') then
    alter type public.app_role add value 'viewer';
  end if;
end
$$;

-- The sign-up trigger only mapped 'admin' and fell back to 'technician' for
-- everything else, so adding the enum value alone would still hand every viewer
-- account the technician role. Map all three values explicitly.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    case lower(coalesce(new.raw_user_meta_data ->> 'role', ''))
      when 'admin' then 'admin'::public.app_role
      when 'viewer' then 'viewer'::public.app_role
      else 'technician'::public.app_role
    end
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        role = excluded.role;
  return new;
end;
$$;

-- A viewer is read-only. is_admin() alone is not enough to express that, because
-- the technician policies below are written as "not an admin", which a viewer
-- would otherwise satisfy. can_write() is the explicit write-role check.
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'technician')
  );
$$;

-- A viewer may read every application table, like the other roles.
drop policy if exists "viewers read machines" on public.machines;
create policy "viewers read machines" on public.machines
  for select to authenticated using (true);

drop policy if exists "viewers read alarms" on public.alarms;
create policy "viewers read alarms" on public.alarms
  for select to authenticated using (true);

drop policy if exists "viewers read maintenance" on public.maintenance_records;
create policy "viewers read maintenance" on public.maintenance_records
  for select to authenticated using (true);

-- The technician write policies are re-declared with can_write() so a viewer
-- cannot slip through "anything that is not an Admin".
drop policy if exists "authenticated users create alarms" on public.alarms;
create policy "authenticated users create alarms" on public.alarms
  for insert to authenticated with check (created_by = auth.uid() and public.can_write());

drop policy if exists "admins or technicians create maintenance" on public.maintenance_records;
create policy "admins or technicians create maintenance" on public.maintenance_records
  for insert to authenticated
  with check (public.can_write() and technician_id = auth.uid() and created_by = auth.uid());

drop policy if exists "admins or assigned technicians update maintenance" on public.maintenance_records;
create policy "admins or assigned technicians update maintenance" on public.maintenance_records
  for update to authenticated
  using (public.can_write() and (public.is_admin() or technician_id = auth.uid()))
  with check (public.can_write() and (public.is_admin() or technician_id = auth.uid()));

drop policy if exists "technicians update alarm workflow" on public.alarms;
create policy "technicians update alarm workflow" on public.alarms
  for update to authenticated
  using (public.can_write() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'technician'))
  with check (public.can_write() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'technician'));

-- ---------------------------------------------------------------------------
-- 2. Waiting Part maintenance status
-- ---------------------------------------------------------------------------
alter table public.maintenance_records
  drop constraint if exists maintenance_records_status_check;
alter table public.maintenance_records
  add constraint maintenance_records_status_check
  check (status = any (array['in_progress', 'waiting_part', 'completed']));

-- completed_at only makes sense once the work is actually finished.
alter table public.maintenance_records
  drop constraint if exists maintenance_waiting_part_not_completed;
alter table public.maintenance_records
  add constraint maintenance_waiting_part_not_completed
  check (status <> 'waiting_part' or completed_at is null);

-- ---------------------------------------------------------------------------
-- 3. Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text        not null,
  record_id   uuid,
  action      text        not null check (action in ('insert', 'update', 'delete')),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  public.app_role,
  summary     text,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_table_idx     on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;

drop policy if exists "authenticated users read audit log" on public.audit_log;
create policy "authenticated users read audit log" on public.audit_log
  for select to authenticated using (true);

-- Only the trigger writes, and it runs as security definer, so no insert
-- policy is granted to the anon or authenticated roles on purpose.
create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor   uuid := auth.uid();
  role    public.app_role;
  old_row jsonb;
  new_row jsonb;
begin
  select p.role into role from public.profiles p where p.id = actor;

  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, summary, changes)
    values (tg_table_name, public.audit_record_id(new_row), 'insert', actor, role,
            tg_table_name || ' created',
            jsonb_build_object('after', new_row));
    return new;
  elsif tg_op = 'DELETE' then
    old_row := to_jsonb(old);
    insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, summary, changes)
    values (tg_table_name, public.audit_record_id(old_row), 'delete', actor, role,
            tg_table_name || ' deleted',
            jsonb_build_object('before', old_row));
    return old;
  else
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    insert into public.audit_log (table_name, record_id, action, actor_id, actor_role, summary, changes)
    values (tg_table_name, public.audit_record_id(new_row), 'update', actor, role,
            tg_table_name || ' updated',
            jsonb_build_object('before', old_row, 'after', new_row));
    return new;
  end if;
end;
$$;

-- `->>` yields text but record_id is uuid, so cast only when the value really
-- looks like a uuid. A row without a usable id still gets logged, with a null
-- record_id, instead of failing the write that triggered the log.
create or replace function public.audit_record_id(doc jsonb) returns uuid
language sql immutable as $$
  select case when (doc ->> 'id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              then (doc ->> 'id')::uuid
              else null
         end;
$$;

drop trigger if exists machines_audit      on public.machines;
drop trigger if exists alarms_audit        on public.alarms;
drop trigger if exists maintenance_audit   on public.maintenance_records;

create trigger machines_audit    after insert or update or delete on public.machines
  for each row execute function public.write_audit_log();
create trigger alarms_audit      after insert or update or delete on public.alarms
  for each row execute function public.write_audit_log();
create trigger maintenance_audit after insert or update or delete on public.maintenance_records
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 4. Change requests, approved by an Admin
-- ---------------------------------------------------------------------------
create table if not exists public.change_requests (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null check (length(btrim(title)) between 3 and 120),
  description  text        not null check (length(btrim(description)) > 0),
  category     text        not null default 'feature',
  status       text        not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid        not null references public.profiles(id) on delete cascade,
  reviewed_by  uuid        references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now()
);

create index if not exists change_requests_status_idx on public.change_requests (status, created_at desc);

alter table public.change_requests enable row level security;

drop policy if exists "authenticated users read change requests" on public.change_requests;
create policy "authenticated users read change requests" on public.change_requests
  for select to authenticated using (true);

-- Any signed-in user may raise a request, but only for themselves.
drop policy if exists "authenticated users create change requests" on public.change_requests;
create policy "authenticated users create change requests" on public.change_requests
  for insert to authenticated with check (requested_by = auth.uid());

-- Only an Admin can approve or reject, and only while it is still pending.
drop policy if exists "admins review change requests" on public.change_requests;
create policy "admins review change requests" on public.change_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ==========================================================================
-- 007_seed_viewer_account.sql
-- sha256:613971340fda
-- ==========================================================================
-- 007_seed_viewer_account.sql
--
-- Runs after 006_bonus_features.sql. A Viewer profile is useful for a demo but
-- has no way to log in, because the signup form only offers Technician and
-- Admin. Seed one so every role in section 7 of the assignment can be shown in
-- the Users page.
--
-- No password is stored for this account, on purpose. A demo credential that
-- ships inside the repository is readable by anyone who clones it, so it would
-- hand them a session the moment it is published. To see the Viewer experience,
-- sign up as a Technician and have an Admin demote that account on the Users
-- page, which section 1.5 already restricts to Admins.

do $$
declare
  v_id uuid;
begin
  if not exists (select 1 from auth.users where email = 'viewer@example.com') then
    v_id := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    values (v_id, 'viewer@example.com', now(),
            '{"display_name":"Viewer Demo","role":"viewer"}'::jsonb, now(), now());
  else
    select id into v_id from auth.users where email = 'viewer@example.com';
  end if;

  insert into public.profiles (id, display_name, role)
  values (v_id, 'Viewer Demo', 'viewer')
  on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;
end
$$;

-- ==========================================================================
-- 008_seed_friendly_actor_defaults.sql
-- sha256:361d7072a4c1
-- ==========================================================================
-- 008_seed_friendly_actor_defaults.sql
--
-- Runs after 007_seed_viewer_account.sql.
--
-- Problem: set_record_actor() filled created_by with
-- coalesce(auth.uid(), new.created_by) but filled closed_by with a bare
-- auth.uid(). auth.uid() is NULL whenever there is no signed-in session, which
-- is exactly the case when seed.sql is pasted into the Supabase SQL Editor or
-- run through the Management API. The bare call therefore overwrote a
-- deliberately supplied closed_by with NULL, and the closed_alarm_has_resolution
-- check constraint then rejected the whole insert. In other words the seed
-- could not create the closed alarms it is supposed to create, using the very
-- method the README documents.
--
-- Fix: use the same coalesce fallback for closed_by that created_by already
-- used. Inside the application auth.uid() is always present, so nothing changes
-- there. Outside a session the supplied value is kept instead of being erased.
-- This does not weaken access control, because RLS still decides who may write
-- the row at all; it only stops the trigger discarding a value it was given.
--
-- closed_at uses coalesce(now(), ...) style handling for the same reason: a
-- closed alarm needs a timestamp, and now() is fine in every context, so it is
-- left as is.

create or replace function public.set_record_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'alarms' then
    if tg_op = 'INSERT' then
      new.created_by = coalesce(auth.uid(), new.created_by);
      if new.status = 'closed' then
        new.closed_by = coalesce(auth.uid(), new.closed_by);
        new.closed_at = coalesce(new.closed_at, now());
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
          new.closed_by = coalesce(auth.uid(), new.closed_by, old.closed_by);
          new.closed_at = coalesce(new.closed_at, now());
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
      if new.status = 'completed' then new.completed_at = coalesce(new.completed_at, now()); else new.completed_at = null; end if;
    else
      new.id = old.id;
      new.created_by = old.created_by;
      new.created_at = old.created_at;
      if new.status = 'completed' then
        if old.status = 'completed' then new.completed_at = old.completed_at; else new.completed_at = coalesce(new.completed_at, now()); end if;
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

-- ==========================================================================
-- 009_audit_change_requests.sql
-- sha256:352304462be5
-- ==========================================================================
-- 009_audit_change_requests.sql
--
-- Runs after 008_seed_friendly_actor_defaults.sql.
--
-- The audit trigger was attached to machines, alarms and maintenance_records
-- only, so a change request and the decision an Admin made on it left no trace
-- in the audit log. The /requests page even claimed they did, which made the
-- documentation wrong rather than the code.
--
-- This attaches the same write_audit_log() trigger to change_requests, so a
-- request being raised, approved or rejected is now recorded with its actor and
-- their role, exactly like every other write in the system.
--
-- The trigger is a plain AFTER ... FOR EACH ROW trigger, so it does not change
-- any value on the row and cannot interfere with the review flow. It is
-- SECURITY DEFINER and runs as the owner, so the absence of an INSERT policy on
-- audit_log is not a problem for it.

drop trigger if exists change_requests_audit on public.change_requests;

create trigger change_requests_audit
  after insert or update or delete on public.change_requests
  for each row execute function public.write_audit_log();

-- The audit page and the machine history page both offer a table filter, and the
-- filter list is hard-coded in the client. This is the list it should offer, so
-- the two stay in step.
--
-- Recorded here for reference rather than enforced: change_requests is now the
-- fifth audited table.
--
--   machines | alarms | maintenance_records | change_requests

-- ==========================================================================
-- 010_column_length_limits.sql
-- sha256:08179732e311
-- ==========================================================================
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

-- ==========================================================================
-- 011_profile_self_service.sql
-- sha256:f31c17bc7763
-- ==========================================================================
-- 011_profile_self_service.sql
--
-- Runs after 010_column_length_limits.sql.
--
-- Problem: a user had no way to correct their own display name. The only policy
-- on profiles was "admins manage profiles", which is FOR ALL USING (is_admin()),
-- so an ordinary Technician could not update their own row at all.
--
-- Granting a blanket UPDATE would be a privilege escalation: role lives in the
-- same row, so a user allowed to update their profile could set
-- role = 'admin' on it. Row Level Security cannot restrict an update to a subset
-- of columns, so the guard is a trigger.
--
-- Two pieces:
--   1. "users update own profile" lets a signed-in user update their own row.
--   2. protect_profile_role() puts the role back, or refuses, unless the caller
--      really is an Admin.
--
-- The trigger raises rather than silently reverting, so the interface can tell
-- the user their request was refused instead of appearing to succeed.

alter table public.profiles drop constraint if exists profiles_role_length;
alter table public.profiles add constraint profiles_role_length
  check (role in ('admin', 'technician', 'viewer'));

-- 1. Self-service update ----------------------------------------------------
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. The role guard ---------------------------------------------------------
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- An Admin may change anyone's role, including their own.
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'only an Admin can change a role'
      using hint = 'Ask an administrator to update your role from the Users page.';
  end if;

  -- id and role are the only columns that matter for identity; everything else
  -- on this row is presentation, so anything left alone is a user's own choice.
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;

-- ==========================================================================
-- seed.sql  (sha256:b1a7e04a6342)
-- ==========================================================================

-- Optional demo data for local development.
-- Run after the migrations and after at least one profile exists.
-- An Admin profile is preferred as the record owner, but any profile works so
-- the data can be seeded before the first account has been promoted.

insert into public.machines (machine_id, machine_name, machine_type, location, status)
values
  ('CNC-04', 'CNC Machining Center', 'CNC', 'Line A / Bay 04', 'alarm'),
  ('ROB-12', 'Assembly Robot', 'Robot', 'Line B / Cell 12', 'maintenance'),
  ('ASM-02', 'Assembly Press', 'Press', 'Line A / Bay 02', 'running'),
  ('PKG-08', 'Packaging Unit', 'Packaging', 'Line C / Bay 08', 'running')
on conflict (machine_id) do nothing;

insert into public.alarms (machine_id, alarm_code, description, occurred_at, cause, action_taken, status, created_by)
select m.id, 'TEMP-HIGH', 'Spindle temperature high', now() - interval '2 minutes', null, null, 'open', p.id
from public.machines m
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where m.machine_id = 'CNC-04'
  and not exists (select 1 from public.alarms a where a.machine_id = m.id and a.alarm_code = 'TEMP-HIGH');

insert into public.alarms (machine_id, alarm_code, description, occurred_at, cause, action_taken, status, created_by)
select m.id, 'SERVO-OL', 'Servo motor overload', now() - interval '18 minutes', 'Excessive load', 'Inspection in progress', 'in_progress', p.id
from public.machines m
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where m.machine_id = 'ROB-12'
  and not exists (select 1 from public.alarms a where a.machine_id = m.id and a.alarm_code = 'SERVO-OL');

insert into public.maintenance_records (machine_id, technician_id, problem, action_taken, started_at, status, created_by)
select m.id, p.id, 'Replace servo coupling', 'Machine isolated and parts requested', now() - interval '3 hours', 'in_progress', p.id
from public.machines m
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where m.machine_id = 'ROB-12'
  and not exists (select 1 from public.maintenance_records r where r.machine_id = m.id and r.problem = 'Replace servo coupling');

-- A week of closed history.
--
-- The two alarms above are both "right now", which leaves the dashboard's
-- 7-day alarm chart with a single bar and makes the date-range filter look
-- empty. These are resolved alarms spread across the past week so the trend
-- chart, the date filter and the reports page all have something real to show.
-- Each one is skipped when it already exists, so re-running is safe.
-- The `values` list below is all text, so the status has to be cast back to the
-- alarm_status enum that alarms.status is declared as.
--
-- A closed alarm has to carry a full resolution, not just a status. The
-- closed_alarm_has_resolution check constraint requires cause, action_taken,
-- closed_by and closed_at together, so all four are supplied here.
insert into public.alarms (machine_id, alarm_code, description, occurred_at, cause, action_taken, status, created_by, closed_by, closed_at)
select m.id, h.alarm_code, h.description, now() - h.ago, h.cause, h.action_taken, h.status::public.alarm_status, p.id, p.id, now() - h.ago + interval '45 minutes'
from public.machines m
join (values
  ('CNC-04', 'VIB-HIGH',  'Excessive vibration on the spindle', interval '6 days 3 hours',  'Imbalance in the tool holder',   'Rebalanced the tool and rechecked',        'closed'),
  ('ASM-02', 'PRESS-CYC', 'Press cycle time above target',    interval '5 days 1 hour',   'Hydraulic pressure drift',            'Adjusted the pressure valve',             'closed'),
  ('PKG-08', 'LABEL-JAM', 'Label feed jam',                   interval '4 days 5 hours',  'Film tension too loose',               'Cleaned the feed rollers',                'closed'),
  ('ROB-12', 'GRIP-SLIP', 'Gripper losing grip on the part',  interval '3 days 2 hours',  'Worn gripper pad',                      'Fitted a replacement pad',               'closed'),
  ('CNC-04', 'COOL-LOW',  'Coolant level below the minimum',  interval '2 days 6 hours',  'Reservoir valve left open',            'Refilled and sealed the valve',           'closed'),
  ('ASM-02', 'TEMP-HIGH', 'Motor temperature rising',         interval '1 day 4 hours',    'Blocked cooling fan',                   'Cleared the fan and verified the run',   'closed'),
  ('PKG-08', 'SEAL-LOW',  'Film seal tension low',            interval '1 day 7 hours',    'Worn tension roller',                   'Replaced the tension roller',             'closed')
) as h(machine_id, alarm_code, description, ago, cause, action_taken, status) on h.machine_id = m.machine_id
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where not exists (
  select 1 from public.alarms a
  where a.machine_id = m.id and a.alarm_code = h.alarm_code
);

-- Two finished maintenance jobs, so the completion rate on the dashboard is a
-- real ratio rather than 0 of 1.
insert into public.maintenance_records (machine_id, technician_id, problem, action_taken, started_at, completed_at, status, created_by)
select m.id, p.id, h.problem, h.action_taken, now() - h.ago - interval '4 hours', now() - h.ago, 'completed', p.id
from public.machines m
join (values
  ('CNC-04', 'Monthly spindle inspection', 'Checked runout and replaced the bearings', interval '5 days 2 hours'),
  ('PKG-08', 'Guarding sensor fault',       'Replaced the faulty safety sensor',         interval '2 days 4 hours')
) as h(machine_id, problem, action_taken, ago) on h.machine_id = m.machine_id
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where not exists (
  select 1 from public.maintenance_records r
  where r.machine_id = m.id and r.problem = h.problem
);

-- Verify the seed landed.
select
  (select count(*) from public.machines) as machines,
  (select count(*) from public.alarms) as alarms,
  (select count(*) from public.maintenance_records) as maintenance_records;


-- ===========================================================================
-- Verify
-- ===========================================================================

select
  (select count(*) from public.profiles)               as profiles,
  (select count(*) from public.machines)               as machines,
  (select count(*) from public.alarms)                 as alarms,
  (select count(*) from public.maintenance_records)    as maintenance_records,
  (select count(*) from public.audit_log)              as audit_entries,
  (select count(*) from public.change_requests)        as change_requests;

-- Roles this install knows about.
select enumlabel as app_role, enumsortorder
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname = 'app_role'
order by enumsortorder;

-- Sign up through the app first, then run the statement below to make your own
-- account an Admin. Replace the email with yours.
--
--   update public.profiles p
--   set role = 'admin'
--   where p.id = (select u.id from auth.users u where u.email = 'you@example.com');
--
-- To promote the oldest account instead, drop the email filter:
--
--   update public.profiles p
--   set role = 'admin'
--   where p.id = (select u.id from auth.users u order by u.created_at limit 1);
