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
