# AI Usage Report — ForgeOps

Alarm & Maintenance Management System for a factory automation environment.
Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Supabase and Vercel.

The assignment permits AI assistance at every stage. This report states where AI was
used, what a human had to verify, and which parts of the system a human is still
responsible for.

## 1. Where AI was used

Mapped against the activities the assignment lists as AI-assisted.

| Assignment activity | How AI was used | Human responsibility |
| --- | --- | --- |
| Requirement analysis | Read the assignment, split it into functional, database, security, UI, quality-gate and deployment requirements, and produced a compliance table mapping each numbered requirement to the code that satisfies it. A later pass re-read the assignment against the finished system and produced a list of discrepancies, which is where most of the corrections in section 5 came from. | Confirm the interpretation of ambiguous requirements, notably that a Technician may create an Alarm even though the assignment only grants "change Alarm status". |
| Database design | Designed the four core tables, the `app_role` / `machine_status` / `alarm_status` enums, foreign keys, check constraints, the `lower(machine_id)` unique index, the actor triggers and the full RLS policy set. The bonus work added `audit_log` and `change_requests`, a `viewer` role and a `can_write()` helper. | Decide the retention policy for machines that have alarm history, and confirm the RLS rules match the intended role split. |
| Writing source code | Generated the Next.js App Router structure, the Supabase clients, `proxy.ts` route protection, the Machine / Alarm / Maintenance / Dashboard / Users / Reports / Settings modules, the Audit / History / Requests pages, and the Tailwind utility layer. | Review every file before committing. |
| UI/UX design | Drafted the visual system, the design tokens declared with Tailwind `@theme`, the light and dark palettes, and the responsive behaviour of every page. | Decide whether the visual style is acceptable, and confirm the layout at real viewport sizes. |
| Writing SQL | Wrote nine migrations, `seed.sql`, and a generator that concatenates them into a single `bootstrap.sql`. | Run the SQL in the Supabase editor in order and confirm the result. |
| Debugging and error fixing | Diagnosed the sign-up role defect, the missing `is_archived` column, the misleading "email rejected" message, the RLS `204 No Content` behaviour, a Tailwind conversion regression that broke the login grid, a chart whose bars collapsed to zero height, and a set of seed failures traced to a trigger overwriting a column it had been given. | Reproduce each reported behaviour and confirm the fix in the running application. |
| Creating tests | Wrote one-off scripts that signed up real accounts against the live Supabase project and asserted the role matrix, the CRUD matrix, the validation matrix and the bonus-feature matrix, then removed the test data. Later converted the durable parts into a committed `node --test` suite. | Decide whether the committed suite covers the behaviour that matters to you. |
| Refactoring | Migrated the entire UI from hand-written CSS to Tailwind utilities, factored repeated utility strings into shared modules, replaced roughly one hundred hard-coded colours with theme tokens so dark mode actually re-themes, and moved the Postgres error mapper into a shared module used by all three consoles. | Confirm the rendered result still matches the intended design. |

## 2. Verification actually performed

These were run against the live Supabase project or the deployed site, not only
inspected in code.

- **Role matrix** — signed up fresh Admin, Technician and Viewer accounts and confirmed the trigger assigns the requested role; confirmed a Technician cannot insert a machine, cannot edit locked alarm fields, and cannot promote their own profile.
- **CRUD matrix** — 22 checks covering Machine create/read/update/archive/restore/delete, Alarm create/read/update across `open` to `in_progress` to `closed`, and Maintenance create/read/update.
- **Validation matrix** — 13 checks confirming blank fields, duplicate Machine IDs (including case variants), malformed and out-of-range Machine IDs, and unknown enum values are all rejected.
- **Bonus matrix** — 20 checks covering Viewer read access with every write refused, the `waiting_part` status, automatic audit logging with no way to forge an entry, and a change request that a Technician can raise but only an Admin can approve.
- **Search and filter** — confirmed Machines apply three conditions (text, status, archived scope), Alarms and Maintenance apply two each, and Audit applies two.
- **Screenshot pass** — drove a real browser against the deployed Vercel URL and captured sixteen screenshots. Reading those images is what exposed three defects that reading the code had not: the alarm chart drew nothing, the machine health column showed a fabricated percentage, and the counters read "1 machines".
- **Install pass** — ran the generated `bootstrap.sql` three times inside a rolled-back transaction to confirm a fresh install and a repeat install both succeed.
- **Secret scan** — repository-wide search for Service Role Keys, secret keys and token patterns; confirmed no `.env.local` is tracked, that `.env.example` holds placeholders only, and that client code reads only `NEXT_PUBLIC_*` variables.
- **Toolchain** — `npm run lint`, `npm test`, `npm run typecheck` and `npm run build` all pass.

## 3. What the human must still do

- [x] Run the local quality gates: `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.
- [x] Deploy to Vercel, add the two public environment variables, and verify the live URL.
- [x] Confirm the interface visually at desktop and mobile widths.
- [x] Capture the required system screenshots.
- [x] Insert the real Vercel URL into `README.md`.

Remaining before the project is shown outside the team:

- [ ] Revoke the Supabase management access token used during development, at
      <https://supabase.com/dashboard/account/tokens>.
- [ ] Decide whether the seeded demo data should stay or be cleared.

## 3a. Accounts and credentials

The deployment has no public account. Demo accounts for all three roles were
created so screenshots could be taken of each one, and their passwords were
published in the README so a reviewer could sign in. That combination was a real
exposure: anyone who obtained a copy of the code could sign in as an Admin on a
deployed URL.

The accounts have been deleted, the credentials are out of the documentation, and
`supabase/make-admin.sql` replaces the old automatic promotion with a deliberate
one that names the account. The seeded data stays, so a new registration sees
machines and alarms immediately.

The reasoning is recorded here because it is a judgement, not a rule: promoting
the first account automatically would have been less friction, and on a student
project the risk is small. It was not done anyway, because a public deployment
means "first account registered" is not necessarily the owner.

## 4. Security statement

No Supabase Service Role Key or secret appears in the browser bundle, the source code
or any documentation file in the project. The browser receives only the public Supabase
project URL and the publishable anon key, which are designed to be public and are
protected by Row Level Security. Authorization is enforced by RLS in the database in
addition to the checks in the interface and `proxy.ts`. The `audit_log` table has no
INSERT policy for anybody, so an audit entry cannot be created or edited from the
client. `.env.local` is excluded by `.gitignore`; the tracked `.env.example` contains
placeholders only.

## 5. Honest limitations

Things AI got wrong, and what checking the running system caught.

- **The automated checks were originally one-off scripts, not a suite.** `npm test` did
  not exist. A `node --test` suite covering validation, formatting and the machine query
  fallback now runs on every `npm test`, but it exercises pure logic only. The role, CRUD and bonus
  matrices are still one-off scripts because they need a real database.
- **The machine health column displayed a fabricated number.** `healthForStatus()`
  returned a fixed 96 / 71 / 48 / 20 depending only on the machine's status, so every
  running machine read exactly 96% under a heading called "Machine health". The code
  looked plausible and the column rendered correctly; only reading the rendered page
  revealed that the figure was invented. It is now the count of alarms still open on
  that machine, taken from the database.
- **The alarm chart drew nothing at all.** Each bar was sized with a percentage height
  inside a flex-sized column with no definite height, so every percentage resolved
  against `auto`. The component type-checked, linted and rendered an empty box. Found by
  looking at a screenshot.
- **Technicians were shown Admin-only Machine buttons.** Adding the `Viewer` role
  widened a shared `canWrite()` helper and a machine console was switched to use it,
  which contradicted the assignment and the README. The database still refused the
  writes, so the tests passed and the UI was still wrong.
- **Dark mode was broken while appearing to work.** The token layer flipped correctly,
  but eighteen `bg-white` surfaces and roughly ninety hard-coded hex colours did not, so
  the result was a near-black page with white cards. The mechanism was correct and the
  outcome was not.
- **`waiting_part` displayed as "In progress".** The status existed in the database and
  in the edit form but was missing from the table filter and the inline status dropdown.
  A record in that state rendered under the wrong label and touching the dropdown
  silently rewrote it.
- **`setup.sql` silently removed a feature.** It rewrote `handle_new_user()` with the
  older two-role version, so pasting it after the bonus migrations removed `viewer` from
  the system. It has been replaced by a generated `bootstrap.sql`.
- **`seed.sql` could not run the way the README said.** `set_record_actor()` filled
  `created_by` with `coalesce(auth.uid(), ...)` but `closed_by` with a bare `auth.uid()`.
  In the SQL editor there is no session, so the trigger erased the value the seed had
  supplied and the check constraint then rejected the insert. Found only by trying to
  apply the seed from a session-less context.
- **The sign-up defect was first misdiagnosed** as an outdated database function when
  the real cause was a migration that had not been applied. Corrected only after reading
  the live function definition over the management API.
- **The Tailwind migration was committed with a broken login grid**, found by inspecting
  the rendered markup rather than by a test.
- **One script of mine contained a mistyped project reference** and returned a
  confidently-worded 404 for a project that did not exist. It cost a long detour before
  a byte-level diff of the two files found the transposed characters.
- **A migration was committed but never applied.** `009` attached the audit trigger to
  `change_requests`; the repository had it and the running database did not, so three
  statements in the documentation were untrue. Found by re-running the requirement checks
  against the live project rather than trusting that a committed migration had been
  applied anywhere.
- **My own migration script broke six class names.** Replacing a colour literal inside
  `bg-[#f5f8fb]` left the existing `bg-` prefix in place and produced `bg-bg-sunken`,
  which Tailwind does not recognise, so those surfaces would have lost their background
  silently.
- **The settings page queried before the session resolved**, building the filter `id=eq.`
  with an empty value and taking a 400 on every visit. The page looked correct because the
  name loaded a moment later. Found by logging the URL of every 4xx while driving the
  deployed site, not by reading the code.
- **The CSV export wrote raw uuids in the machine column** for alarms and maintenance,
  which means nothing to whoever opens the file. It carries the machine code now.
- **The reports page had no filters at all**, and was a summary sentence with a button.

### Checks that were themselves wrong

The pattern recurred often enough to be worth recording, because each one produced a
failure that had nothing to do with the code:

- A unique violation returns HTTP 409 with `23505` in the body, not 23505 as the status.
- Row Level Security drops a refused write silently and answers 200 or 204. A status
  assertion would pass a write that never happened and fail one that was correctly
  blocked, so the row has to be read back.
- `set_record_actor()` sets `completed_at` to null unless the status is `completed`, so a
  completion time supplied alongside `waiting_part` is discarded rather than rejected. The
  end state is correct and the mechanism is not the obvious one.
- PostgREST reports a check-constraint violation as code `21000`.
- A machine code is printed in two cells of a report row, so counting occurrences is not
  counting rows.
- A retired machine is correctly absent from a list whose scope is Active, so asserting it
  is "still listed" without switching the scope proves nothing.
- A capitalised badge does not match a lowercase pattern.

### The notification bell took three passes, and each pass was a different bug

This is worth setting out in full, because the first version passed lint, passed
the build and still did not work, and the reason each time was a different kind
of wrong.

**Pass one: it was a signpost.** The bell listed the active alarms, and clicking
a row did nothing. The feature reported that an alarm existed and then left the
reader to go and find it. Adding a link meant somewhere for the link to land, so
`/alarms?id=` and `/machines?q=` were added, with the console reading the
parameter, scrolling the row into view and outlining it.

Two things had to be decided rather than guessed. A linked alarm is pulled out of
the status filter, because a link to a closed alarm would otherwise land on an
empty list and read as a broken page. And a link to an id that is not there says
so, naming the two likely reasons, because an empty table with no explanation is
indistinguishable from a permission problem.

**Pass two: it reported alarms that were no longer open.** Closing an alarm left
it in the bell for the rest of the session. The cause was structural. The bell,
the dashboard queue and the alarm table are three components with three separate
copies of the same rows, and each was updated only by whatever had fetched it. No
amount of care inside any one of them would have fixed it.

The fix is a three-line bus: a write emits, the readers refetch, and window focus
covers a change made in another tab. There is deliberately no polling. A write is
the only moment the data can have changed underneath a reader, and a write is
exactly when a signal can be sent.

Making the dashboard reload exposed a second problem. It can now be triggered
three ways that overlap, so a slow first request could land after a fresher one
and put the old numbers back on screen. The loader was split into a fetch and an
apply, and guarded with a request id. A cancelled flag would not do: the request
has already been sent and cannot be called off.

**Pass three: the desktop alert offer could not be refused.** A four-line pitch
for an optional feature, above the alarms, on every page, with no dismiss. It was
larger than the thing it was promoting, and a prompt that cannot be declined is a
prompt the reader has learned to ignore. Removing it would have been wrong on its
own, though, because then there was no way to turn the feature on at all. So it
became one line with a dismiss that is remembered, and Settings gained a section
that reports the real permission state and offers to bring the offer back.
Refusing is now a choice with a way out, which is what it should have been.

Two things came out of rewriting that are worth separating from the rest:

- The bell held `Notification.permission` in component state, so a page loaded
  after permission had been granted elsewhere still said desktop alerts were off.
  Reading the browser's value is now the source of truth, and only the answer to
  our own click overrides it. This bug was introduced by the rewrite that was
  supposed to be removing a related one.
- Both the permission and the dismissal are external state, so they are read with
  `useSyncExternalStore` rather than copied out of the browser by an effect. An
  effect that mirrors an external value has to be re-run to stay correct, cannot
  be trusted during server rendering, and duplicates something the browser will
  keep for us. The store also made the dismissal reactive across tabs for free.

The desktop notification "new alarm" prompt had its own version of the same
error. It remembered *which* alarm it had announced, so closing the newest alarm
made the next one down count as new, and the browser announced an alarm that had
been sitting there for hours. It remembers *when* it last announced, which is
what it was trying to express.

## 6. Deliberate design decisions

Not oversights, and not limitations.

- **A Technician may create an alarm.** The assignment grants a Technician "change Alarm
  status" and an Admin "manage Alarm", so creating is not asked for. It is allowed because
  a technician standing at the machine is normally the one who logs the alarm. The policy is
  `authenticated users create alarms`; tightening it is a one-line change and the
  trade-off is written up in `README.md` section 3.1.
- **The seed dates its records relative to the moment it runs.** A fixed date would mean a
  project installed next month shows a fortnight of history entirely in the past and an
  empty dashboard. A fresh install shows a current week instead.
- **A Viewer may raise a change request even though it may not write factory data.**
  Restricting requests to write roles would defeat the purpose of a request workflow,
  where the read-only users are often the ones who notice a gap. The integration suite
  found this asymmetry and it is now asserted.
- **Machine status is not filtered by the dashboard time range.** A machine's status is a
  fact about right now, so scoping it by time would be misleading. Everything that is a
  matter of record is scoped, and the filter strip says what it is showing.
