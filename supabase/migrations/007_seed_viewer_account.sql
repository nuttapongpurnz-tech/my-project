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
