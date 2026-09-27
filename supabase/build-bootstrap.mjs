/**
 * Builds supabase/bootstrap.sql, a single file that can be pasted into the
 * Supabase SQL Editor in one go.
 *
 * The Supabase SQL Editor cannot include other files, so a genuinely one-shot
 * install has to be one file. Concatenating the migrations by hand would let
 * the copies drift apart, so the combined file is generated from the numbered
 * migrations and the seed, and this script is committed next to it so the
 * result can be rebuilt after any migration changes.
 *
 *   node supabase/build-bootstrap.mjs
 *
 * The header of the generated file records the inputs and their checksums.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const migrationsDir = join(here, "migrations");
const outputPath = join(here, "bootstrap.sql");

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No migrations found in supabase/migrations.");
  process.exit(1);
}

const parts = [];
const manifest = [];

for (const name of files) {
  const body = readFileSync(join(migrationsDir, name), "utf8").trim();
  const checksum = createHash("sha256").update(body).digest("hex").slice(0, 12);
  manifest.push({ name, checksum });
  parts.push(
    [
      "-- " + "=".repeat(74),
      `-- ${name}`,
      `-- sha256:${checksum}`,
      "-- " + "=".repeat(74),
      body,
    ].join("\n"),
  );
}

const seed = readFileSync(join(here, "seed.sql"), "utf8").trim();
const seedChecksum = createHash("sha256").update(seed).digest("hex").slice(0, 12);
manifest.push({ name: "seed.sql", checksum: seedChecksum });

const header = `-- ===========================================================================
-- bootstrap.sql  --  GENERATED FILE, DO NOT EDIT BY HAND
-- ===========================================================================
--
-- Rebuild it after changing anything under supabase/:
--
--     node supabase/build-bootstrap.mjs
--
-- What it is: every migration in supabase/migrations, in order, followed by
-- supabase/seed.sql, concatenated into one script.
--
-- How to use it: Supabase dashboard -> SQL Editor -> New query -> paste this
-- whole file -> Run. On a brand new project this builds the schema, the
-- policies, the triggers and the demo data in a single pass, and running it a
-- second time is safe because every statement is idempotent.
--
-- If you would rather see the steps separately, run the files in
-- supabase/migrations in numeric order and then supabase/seed.sql.
--
-- Sign-up creates a profile for you. setup.sql used to promote the first
-- account to Admin, but that is not done here: an account has to exist before
-- it can be promoted, so do it by signing up and then running the promote
-- statement printed at the end of this file.
--
-- Contents, in order:
${manifest.map((entry, index) => `--   ${String(index + 1).padStart(2)}. ${entry.name}  (sha256:${entry.checksum})`).join("\n")}
-- ===========================================================================

`;

const epilogue = `

-- ===========================================================================
-- Verify
-- ===========================================================================

select
  (select count(*) from public.profiles)               as profiles,
  (select count(*) from public.machines)               as machines,
  (select count(*) from public.alarms)                 as alarms,
  (select count(*) from public.maintenance_records)    as maintenance_records,
  (select count(*) from public.audit_log)              as audit_entries,
  (select count(*) from public.change_requests)        as change_requests;

-- Roles this install knows about.
select enumlabel as app_role, enumsortorder
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname = 'app_role'
order by enumsortorder;

-- Sign up through the app first, then run the statement below to make your own
-- account an Admin. Replace the email with yours.
--
--   update public.profiles p
--   set role = 'admin'
--   where p.id = (select u.id from auth.users u where u.email = 'you@example.com');
--
-- To promote the oldest account instead, drop the email filter:
--
--   update public.profiles p
--   set role = 'admin'
--   where p.id = (select u.id from auth.users u order by u.created_at limit 1);
`;

writeFileSync(outputPath, `${header}${parts.join("\n\n")}\n\n-- ${"=".repeat(74)}\n-- seed.sql  (sha256:${seedChecksum})\n-- ${"=".repeat(74)}\n\n${seed}\n${epilogue}`);

const bytes = readFileSync(outputPath).length;
console.log(`bootstrap.sql written: ${files.length} migrations + seed.sql, ${(bytes / 1024).toFixed(1)} KB`);
for (const entry of manifest) console.log(`  ${entry.name.padEnd(42)} sha256:${entry.checksum}`);
