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