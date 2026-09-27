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
