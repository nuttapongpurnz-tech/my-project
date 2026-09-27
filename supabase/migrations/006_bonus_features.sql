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
