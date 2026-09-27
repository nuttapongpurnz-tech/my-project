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
