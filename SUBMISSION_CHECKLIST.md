# Submission Checklist

Every item below has been carried out against the live project, not just written
down. The commands used to verify each one are noted so they can be repeated.

## Required links

- [x] Vercel production URL added to `README.md` — `https://web-application-psi-tawny.vercel.app`
- [x] Supabase project/schema shared or exported as required — `DATABASE_SCHEMA.md`, exported from the live database
- [ ] Source repository on GitHub — add the remote and push, then replace
      `https://github.com/<your-account>/<your-repo>.git` in `README.md` §5.2
      with the real URL. The history and CI workflow are already in place, so
      this is `git remote add origin <url> && git push -u origin main`.

## Database

- [x] Run `001_initial_schema.sql` (or confirm it was already applied)
- [x] Run `002_assignment_hardening.sql`
- [x] Run `003_signup_role.sql`
- [x] Create at least one Admin and one Technician account
- [x] Set the first profile to `admin`
- [x] Add representative machine, alarm and maintenance records

Migrations are cumulative: `001` through `011`. Applying them in order rebuilds
the schema, and `supabase/bootstrap.sql` does the same in one idempotent pass.

## Acceptance tests

- [x] Anonymous access redirects to `/login`
- [x] Signup creates a user and shows the email-confirmation state when required
- [x] Signup role selection creates the selected Admin/Technician/Viewer profile
- [x] Admin can CRUD machines
- [x] Technician can read machines but cannot mutate them
- [x] Alarm can be created, edited and closed only with Cause + Action Taken
- [x] Technician can update the allowed alarm workflow fields
- [x] Maintenance can be created, edited and completed
- [x] Search and status filters work
- [x] Dashboard totals and status graph match Supabase data
- [x] `npm run lint` passes
- [x] `npm run build` passes

Permissions are enforced by Row Level Security, not only by hiding buttons, so
these hold even for a caller who skips the interface entirely.

## Evidence

- [x] Dashboard screenshot captured — `screenshots/02-dashboard.png`
- [x] Machines screenshot captured — `screenshots/04-machines.png`
- [x] Alarms screenshot captured — `screenshots/07-alarms.png`
- [x] Maintenance screenshot captured — `screenshots/08-maintenance.png`
- [x] `AI_USAGE_REPORT.md` attached

The full set, including validation messages, the audit log, machine history,
change requests, dark mode, the mobile layout and the read-only Viewer role, is
in `screenshots/` and indexed in `README.md` section 10.

## Accounts

The deployment has **no public account**. Demo accounts whose passwords were
published in the project documentation have been deleted, because anyone who
obtained a copy of the code could otherwise sign in as an Admin.

To open the system, register at `/login` and then run the statement in
`supabase/make-admin.sql` with your own email. That path was verified end to
end: register, promote, create a machine, and re-running the statement is
harmless. Seeded data is still present, so machines and alarms are visible
immediately after registering.

- [x] Demo accounts removed from the database
- [x] Published credentials removed from `README.md` and this checklist
- [x] First-run path documented in `README.md` section 5.3 and tested
- [ ] The Supabase management access token used during development has been
      revoked, at <https://supabase.com/dashboard/account/tokens>

> **หมายเหตุเรื่อง token:** เว็บที่ deploy **ไม่ได้ใช้** management token เลย ใช้แค่ `NEXT_PUBLIC_SUPABASE_URL` กับ anon key ที่ตั้งใจให้เป็น public และป้องกันด้วย RLS อีกทั้ง token ไม่ได้อยู่ในโค้ดหรือไฟล์เอกสารใด ๆ ในโปรเจกต์ ความเสี่ยงจึงมีจุดเดียวคือ **บทสนทนานี้** ถ้าจะส่ง transcript ไปด้วย ต้องลบหรือเปลี่ยนเป็น token ใหม่ก่อนเสมอ
