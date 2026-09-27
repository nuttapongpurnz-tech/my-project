-- Optional demo data for local development.
-- Run after the migrations and after at least one profile exists.
-- An Admin profile is preferred as the record owner, but any profile works so
-- the data can be seeded before the first account has been promoted.

insert into public.machines (machine_id, machine_name, machine_type, location, status)
values
  ('CNC-04', 'CNC Machining Center', 'CNC', 'Line A / Bay 04', 'alarm'),
  ('ROB-12', 'Assembly Robot', 'Robot', 'Line B / Cell 12', 'maintenance'),
  ('ASM-02', 'Assembly Press', 'Press', 'Line A / Bay 02', 'running'),
  ('PKG-08', 'Packaging Unit', 'Packaging', 'Line C / Bay 08', 'running')
on conflict (machine_id) do nothing;

insert into public.alarms (machine_id, alarm_code, description, occurred_at, cause, action_taken, status, created_by)
select m.id, 'TEMP-HIGH', 'Spindle temperature high', now() - interval '2 minutes', null, null, 'open', p.id
from public.machines m
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where m.machine_id = 'CNC-04'
  and not exists (select 1 from public.alarms a where a.machine_id = m.id and a.alarm_code = 'TEMP-HIGH');

insert into public.alarms (machine_id, alarm_code, description, occurred_at, cause, action_taken, status, created_by)
select m.id, 'SERVO-OL', 'Servo motor overload', now() - interval '18 minutes', 'Excessive load', 'Inspection in progress', 'in_progress', p.id
from public.machines m
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where m.machine_id = 'ROB-12'
  and not exists (select 1 from public.alarms a where a.machine_id = m.id and a.alarm_code = 'SERVO-OL');

insert into public.maintenance_records (machine_id, technician_id, problem, action_taken, started_at, status, created_by)
select m.id, p.id, 'Replace servo coupling', 'Machine isolated and parts requested', now() - interval '3 hours', 'in_progress', p.id
from public.machines m
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where m.machine_id = 'ROB-12'
  and not exists (select 1 from public.maintenance_records r where r.machine_id = m.id and r.problem = 'Replace servo coupling');

-- A week of closed history.
--
-- The two alarms above are both "right now", which leaves the dashboard's
-- 7-day alarm chart with a single bar and makes the date-range filter look
-- empty. These are resolved alarms spread across the past week so the trend
-- chart, the date filter and the reports page all have something real to show.
-- Each one is skipped when it already exists, so re-running is safe.
-- The `values` list below is all text, so the status has to be cast back to the
-- alarm_status enum that alarms.status is declared as.
--
-- A closed alarm has to carry a full resolution, not just a status. The
-- closed_alarm_has_resolution check constraint requires cause, action_taken,
-- closed_by and closed_at together, so all four are supplied here.
insert into public.alarms (machine_id, alarm_code, description, occurred_at, cause, action_taken, status, created_by, closed_by, closed_at)
select m.id, h.alarm_code, h.description, now() - h.ago, h.cause, h.action_taken, h.status::public.alarm_status, p.id, p.id, now() - h.ago + interval '45 minutes'
from public.machines m
join (values
  ('CNC-04', 'VIB-HIGH',  'Excessive vibration on the spindle', interval '6 days 3 hours',  'Imbalance in the tool holder',   'Rebalanced the tool and rechecked',        'closed'),
  ('ASM-02', 'PRESS-CYC', 'Press cycle time above target',    interval '5 days 1 hour',   'Hydraulic pressure drift',            'Adjusted the pressure valve',             'closed'),
  ('PKG-08', 'LABEL-JAM', 'Label feed jam',                   interval '4 days 5 hours',  'Film tension too loose',               'Cleaned the feed rollers',                'closed'),
  ('ROB-12', 'GRIP-SLIP', 'Gripper losing grip on the part',  interval '3 days 2 hours',  'Worn gripper pad',                      'Fitted a replacement pad',               'closed'),
  ('CNC-04', 'COOL-LOW',  'Coolant level below the minimum',  interval '2 days 6 hours',  'Reservoir valve left open',            'Refilled and sealed the valve',           'closed'),
  ('ASM-02', 'TEMP-HIGH', 'Motor temperature rising',         interval '1 day 4 hours',    'Blocked cooling fan',                   'Cleared the fan and verified the run',   'closed'),
  ('PKG-08', 'SEAL-LOW',  'Film seal tension low',            interval '1 day 7 hours',    'Worn tension roller',                   'Replaced the tension roller',             'closed')
) as h(machine_id, alarm_code, description, ago, cause, action_taken, status) on h.machine_id = m.machine_id
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where not exists (
  select 1 from public.alarms a
  where a.machine_id = m.id and a.alarm_code = h.alarm_code
);

-- Two finished maintenance jobs, so the completion rate on the dashboard is a
-- real ratio rather than 0 of 1.
insert into public.maintenance_records (machine_id, technician_id, problem, action_taken, started_at, completed_at, status, created_by)
select m.id, p.id, h.problem, h.action_taken, now() - h.ago - interval '4 hours', now() - h.ago, 'completed', p.id
from public.machines m
join (values
  ('CNC-04', 'Monthly spindle inspection', 'Checked runout and replaced the bearings', interval '5 days 2 hours'),
  ('PKG-08', 'Guarding sensor fault',       'Replaced the faulty safety sensor',         interval '2 days 4 hours')
) as h(machine_id, problem, action_taken, ago) on h.machine_id = m.machine_id
cross join (select id from public.profiles order by (role = 'admin') desc, created_at limit 1) p
where not exists (
  select 1 from public.maintenance_records r
  where r.machine_id = m.id and r.problem = h.problem
);

-- Verify the seed landed.
select
  (select count(*) from public.machines) as machines,
  (select count(*) from public.alarms) as alarms,
  (select count(*) from public.maintenance_records) as maintenance_records;

