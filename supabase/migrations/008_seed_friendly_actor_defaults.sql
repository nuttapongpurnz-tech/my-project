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
