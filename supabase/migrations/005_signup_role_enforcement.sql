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
