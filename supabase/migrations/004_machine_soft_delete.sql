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
