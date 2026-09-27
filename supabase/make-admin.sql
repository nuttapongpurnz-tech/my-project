-- ===========================================================================
-- make-admin.sql  --  give an account the Admin role
-- ===========================================================================
--
-- Why this file exists
-- --------------------
-- Supabase cannot create an Admin on its own: a new sign-up is a Technician or a
-- Viewer, which is correct, but it also means the very first account in a fresh
-- project cannot open the Machines module or change anyone's role.
--
-- There is no safe way to automate that. Promoting "the first account to be
-- created" would hand Admin to whoever registered first, and on a public
-- deployment that could be a stranger. So it is done deliberately, by name.
--
-- How to use it
-- -------------
-- 1. Sign up through the app at /login, so the account and its profile exist.
-- 2. Paste the statement below into Supabase -> SQL Editor and Run.
-- 3. Sign out, then sign back in. The app reads the role once when the page
--    loads, so a refresh is not enough.
--
-- Running it twice is safe: it only ever sets the role to admin.
-- ===========================================================================

-- Change the email to your own, then run.
update public.profiles p
set role = 'admin'
where p.id = (select u.id from auth.users u where u.email = 'you@example.com')
returning p.display_name, p.role;

-- ---------------------------------------------------------------------------
-- If you would rather promote whichever account registered first:
--
--   update public.profiles p
--   set role = 'admin'
--   where p.id = (select u.id from auth.users u order by u.created_at limit 1)
--   returning p.display_name, p.role;
--
-- Check what you have before and after:
--
--   select u.email, p.display_name, p.role
--   from auth.users u
--   join public.profiles p on p.id = u.id
--   order by u.created_at;
-- ---------------------------------------------------------------------------
