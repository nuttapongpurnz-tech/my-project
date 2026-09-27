/**
 * Regenerates DATABASE_SCHEMA.md from the live database.
 *
 * The document used to be a hand-maintained dump, which meant it drifted: it
 * still described two roles, four tables and eight triggers after migrations
 * 006 to 009 had added a third role, two more tables, a can_write() helper and
 * a change-request audit trigger. This reads the real catalogue instead, so the
 * schema documentation cannot disagree with the schema.
 *
 *   SB_TOKEN=<supabase management token> \
 *   SB_PROJECT_REF=<project ref> \
 *   node tools/generate-schema-doc.mjs
 */
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_PROJECT_REF;
const OUT = join(repoRoot, "DATABASE_SCHEMA.md");

if (!TOKEN) {
  console.error("Set SB_TOKEN to a Supabase management access token first.");
  process.exit(1);
}

if (!REF) {
  console.error("Set SB_PROJECT_REF to the project ref, e.g. abcdefghijklmnop.");
  process.exit(1);
}

async function sql(query, label = "query") {
  const url = `https://api.supabase.com/v1/projects/${REF}/database/query`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) {
    const firstLine = query.trim().split("\n")[0].slice(0, 90);
    throw new Error(`[${label}] HTTP ${r.status} on "${firstLine} ..."\n  project: ${REF}\n  res: ${t.slice(0, 400)}`);
  }
  return JSON.parse(t);
}

const md = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));
const inline = (value) => `\`${md(value).replaceAll("|", "\\|")}\``;
const yesNo = (value) => (value === "YES" ? "ว่างได้" : "ห้ามว่าง");

// ---------------------------------------------------------------------------
const enums = await sql(`
  select t.typname as name,
         string_agg(e.enumlabel, ', ' order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname;`);

const tables = await sql(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name;`);

const columns = {};
for (const row of await sql(`
  select table_name, column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position;`)) {
  (columns[row.table_name] ??= []).push(row);
}

const fks = await sql(`
  select tc.table_name, kcu.column_name, ccu.table_name as ref_table,
         ccu.column_name as ref_column, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
  where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
  order by tc.table_name, kcu.column_name;`);

const checks = await sql(`
  select c.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and con.contype = 'c'
  order by c.relname, con.conname;`);

const indexes = await sql(`
  select tablename as table_name, indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
  order by tablename, indexname;`);

const policies = await sql(`
  select tablename as table_name, policyname, cmd, roles::text, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname;`);

const triggers = await sql(`
  select c.relname as table_name, t.tgname,
         case when (t.tgtype & 2) = 2 then 'BEFORE' else 'AFTER' end as timing,
         pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth') and not t.tgisinternal
  order by c.relname, t.tgname;`);

const functions = await sql(`
  select p.proname as name,
         pg_get_function_result(p.oid) as returns,
         case p.prosecdef when true then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
         l.lanname as language
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
  order by p.proname;`);

const rls = await sql(`
  select c.relname as table_name, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;`);

// Read the migrations off disk rather than listing them here, so a new migration
// cannot be left out of the document the way 010 and 011 were.
const migrations = readdirSync(join(repoRoot, "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => `supabase/migrations/${name}`);

const counts = await sql(`
  select
    (select count(*) from public.machines)             as machines,
    (select count(*) from public.alarms)               as alarms,
    (select count(*) from public.maintenance_records)  as maintenance,
    (select count(*) from public.audit_log)            as audit_log,
    (select count(*) from public.change_requests)      as change_requests,
    (select count(*) from public.profiles)             as profiles;`);

// ---------------------------------------------------------------------------
const out = [];

out.push(`# Database Schema`);
out.push(``);
out.push(`สคีมาฉบับนี้สร้างจากฐานข้อมูลจริงบน Supabase ไม่ได้เขียนด้วยมือ จึงไม่มีทางคลาดเคลื่อนจากของจริง`);
out.push(``);
out.push(`> สร้างใหม่ด้วย \`SB_TOKEN=<management token> SB_PROJECT_REF=<project ref> node tools/generate-schema-doc.mjs\` · โปรเจกต์ \`${REF}\``);
out.push(``);
out.push(`## วิธีติดตั้ง`);
out.push(``);
out.push(`**วิธีเร็วที่สุด:** คัดลอก [\`supabase/bootstrap.sql\`](./supabase/bootstrap.sql) ไปวางใน **Supabase → SQL Editor** แล้วกด **Run`);
out.push(``);
out.push(`ไฟล์นี้คือ migration ทั้ง ${migrations.length} ไฟล์เรียงตามลำดับ ต่อด้วย \`seed.sql\` และ **รันซ้ำได้** ทุกคำสั่งมี guard กันการซ้ำ ได้แก่ \`create type/table/index ... if not exists\` และ \`drop ... if exists\` นำหน้า \`create trigger\` \`create policy\` กับ \`add constraint\``);
out.push(``);
out.push(`**ทีละไฟล์:** รันใน Supabase SQL Editor ตามลำดับ`);
out.push(``);
migrations.forEach((name, index) => out.push(`${index + 1}. \`${name}\``));
out.push(``);
out.push(`ข้อมูลตัวอย่างอยู่ใน \`supabase/seed.sql\` แยกต่างหากเพื่อให้เลือกได้ว่าจะใส่หรือไม่`);
out.push(``);
out.push(`> ไฟล์ \`supabase/bootstrap.sql\` สร้างอัตโนมัติจาก migration ด้วย \`node supabase/build-bootstrap.mjs\` หัวไฟล์จะบันทึก sha256 ของไฟล์ต้นทางแต่ละชิ้น`);
out.push(``);

out.push(`## ภาพรวม`);
out.push(``);
out.push(`| รายการ | จำนวน |`);
out.push(`| --- | --- |`);
out.push(`| ตาราง | ${tables.length} |`);
out.push(`| Enum type | ${enums.length} |`);
out.push(`| Foreign key | ${fks.length} |`);
out.push(`| Check constraint | ${checks.length} |`);
out.push(`| Index | ${indexes.length} |`);
out.push(`| RLS policy | ${policies.length} |`);
out.push(`| Trigger | ${triggers.length} |`);
out.push(`| ฟังก์ชัน | ${functions.length} |`);
out.push(``);

out.push(`### Enum type`);
out.push(``);
out.push(`| ชื่อ | ค่าที่เป็นไปได้ |`);
out.push(`| --- | --- |`);
for (const row of enums) out.push(`| ${inline(row.name)} | ${row.labels} |`);
out.push(``);

out.push(`### Row Level Security`);
out.push(``);
out.push(`| ตาราง | เปิด RLS |`);
out.push(`| --- | --- |`);
for (const row of rls) out.push(`| ${inline(row.table_name)} | ${row.relrowsecurity ? "เปิด" : "**ไม่เปิด**"} |`);
out.push(``);

out.push(`## ตารางและคอลัมน์`);
out.push(``);
for (const { table_name: table } of tables) {
  const cols = columns[table] ?? [];
  out.push(`### ${inline(table)}`);
  out.push(``);
  out.push(`| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |`);
  out.push(`| --- | --- | --- | --- |`);
  for (const col of cols) {
    const type = col.udt_name && !["text", "uuid", "bool", "timestamptz", "jsonb", "int4"].includes(col.udt_name)
      ? `${col.udt_name}`
      : col.data_type;
    out.push(`| ${inline(col.column_name)} | ${inline(type)} | ${yesNo(col.is_nullable)} | ${col.column_default ? inline(col.column_default) : "—"} |`);
  }
  out.push(``);
}

out.push(`## Foreign Key`);
out.push(``);
out.push(`| ตาราง | คอลัมน์ | อ้างไปที่ | กฎเมื่อลบ |`);
out.push(`| --- | --- | --- | --- |`);
for (const fk of fks) {
  out.push(`| ${inline(fk.table_name)} | ${inline(fk.column_name)} | ${inline(`${fk.ref_table}.${fk.ref_column}`)} | ${inline(fk.delete_rule)} |`);
}
out.push(``);
out.push(`ทุกคีย์ใช้ \`restrict\` หรือ \`set null\` ไม่มี \`cascade\` ยกเว้น \`profiles.id\` ซึ่งชี้กลับไปที่ \`auth.users\` เพราะเมื่อลบบัญชีออกจากระบบ profile ต้องหายตามไป ส่วนข้อมูลปฏิบัติการจะไม่ถูกลบตามบัญชี เพื่อให้ประวัติยังอยู่`);
out.push(``);

out.push(`## Check Constraint`);
out.push(``);
out.push(`| ตาราง | ชื่อ | นิยาม |`);
out.push(`| --- | --- | --- |`);
for (const check of checks) {
  out.push(`| ${inline(check.table_name)} | ${inline(check.conname)} | ${inline(check.definition)} |`);
}
out.push(``);

out.push(`## Index`);
out.push(``);
out.push(`| ตาราง | ชื่อ |`);
out.push(`| --- | --- |`);
for (const index of indexes) out.push(`| ${inline(index.table_name)} | ${inline(index.indexname)} |`);
out.push(``);

out.push(`## RLS Policy`);
out.push(``);
out.push(`| ตาราง | ชื่อ policy | คำสั่ง | ใช้กับ | เงื่อนไข USING | เงื่อนไข WITH CHECK |`);
out.push(`| --- | --- | --- | --- | --- | --- |`);
for (const p of policies) {
  out.push(`| ${inline(p.table_name)} | ${inline(p.policyname)} | ${inline(p.cmd)} | ${inline(p.roles)} | ${inline(p.qual)} | ${inline(p.with_check)} |`);
}
out.push(``);
out.push(`**หมายเหตุ:** \`audit_log\` มีเพียง policy ระบุ \`for select\` เท่านั้น ไม่มี policy สำหรับ insert แม้แต่ตัวเดียว เพราะรายการต้องถูกเขียนโดย trigger ซึ่งรันเป็น \`security definer\` เท่านั้น ผลคือ client ไม่สามารถสร้าง แก้ไข หรือลบรายการ audit ได้เลย แม้จะล็อกอินด้วย role ใดก็ตาม`);
out.push(``);

out.push(`## Trigger`);
out.push(``);
out.push(`| ตาราง | ชื่อ | จังหวะ |`);
out.push(`| --- | --- | --- |`);
for (const t of triggers) out.push(`| ${inline(t.table_name)} | ${inline(t.tgname)} | ${t.timing} |`);
out.push(``);

out.push(`## ฟังก์ชัน`);
out.push(``);
out.push(`| ชื่อ | คืนค่า | ภาษา | สิทธิ์ |`);
out.push(`| --- | --- | --- | --- |`);
for (const f of functions) {
  out.push(`| ${inline(f.name)} | ${inline(f.returns)} | ${inline(f.language)} | ${f.security} |`);
}
out.push(``);
out.push(`ฟังก์ชันที่ทำงานแทนผู้เรียก (\`security definer\`) คือ \`is_admin()\` \`can_write()\` \`handle_new_user()\` \`set_record_actor()\` \`write_audit_log()\` \`audit_record_id()\` และ \`protect_profile_role()\` ทั้งหมดตั้ง \`search_path = public\` เพื่อไม่ให้มีการเรียกฟังก์ชันของ schema อื่นผ่านชื่อกำกวม`);
out.push(``);
out.push(`### ฟังก์ชันที่กันการเลื่อนสิทธิ์ตัวเอง`);
out.push(``);
out.push(`\`protect_profile_role()\` ทำงานก่อน \`UPDATE\` บน \`profiles\` และ**ปฏิเสธ**คำขอเปลี่ยน \`role\` เว้นแต่ผู้เรียกเป็น Admin`);
out.push(``);
out.push(`จำเป็นเพราะ policy \`users update own profile\` อนุญาตให้ผู้ใช้แก้โปรไฟล์ของตัวเองได้ แต่ \`role\` อยู่ในแถวเดียวกัน และ RLS ของ PostgreSQL **เลือกได้แค่ระดับแถว ไม่ได้ระดับคอลัมน์** ถ้าไม่มี trigger กันไว้ ผู้ใช้ทั่วไปจะตั้ง \`role = 'admin'\` ให้ตัวเองได้`);
out.push(``);
out.push(`การตรวจสอบด้วยการยิงคำขอจริง: ช่างเทคนิคตั้งชื่อตัวเองได้ · ตั้งชื่อบัญชีอื่นไม่ได้ · ตั้ง \`role\` ของตัวเองไม่ได้ (ทั้งจาก technician และ viewer) · Admin ยังจัดการ Role ได้ตามปกติ`);
out.push(``);

out.push(`## ข้อมูลปัจจุบันในระบบ`);
out.push(``);
out.push(`| ตาราง | แถว |`);
out.push(`| --- | --- |`);
out.push(`| \`profiles\` | ${counts[0].profiles} |`);
out.push(`| \`machines\` | ${counts[0].machines} |`);
out.push(`| \`alarms\` | ${counts[0].alarms} |`);
out.push(`| \`maintenance_records\` | ${counts[0].maintenance} |`);
out.push(`| \`audit_log\` | ${counts[0].audit_log} |`);
out.push(`| \`change_requests\` | ${counts[0].change_requests} |`);
out.push(``);
out.push(`## วิธีดูสคีมาด้วยตนเอง`);
out.push(``);
out.push(`รันใน Supabase SQL Editor`);
out.push(``);
out.push("```sql");
out.push(`-- คอลัมน์ทั้งหมดของทุกตาราง`);
out.push(`select table_name, column_name, data_type, is_nullable, column_default`);
out.push(`from information_schema.columns`);
out.push(`where table_schema = 'public'`);
out.push(`order by table_name, ordinal_position;`);
out.push(``);
out.push(`-- RLS Policy ทั้งหมด`);
out.push(`select tablename, policyname, cmd, roles, qual, with_check`);
out.push(`from pg_policies`);
out.push(`where schemaname = 'public'`);
out.push(`order by tablename, policyname;`);
out.push(``);
out.push(`-- Trigger ทั้งหมด`);
out.push(`select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid)`);
out.push(`from pg_trigger t`);
out.push(`join pg_class c on c.oid = t.tgrelid`);
out.push(`join pg_namespace n on n.oid = c.relnamespace`);
out.push(`where n.nspname in ('public', 'auth') and not t.tgisinternal;`);
out.push("```");

writeFileSync(OUT, `${out.join("\n")}\n`);

console.log(`DATABASE_SCHEMA.md regenerated`);
console.log(`  ${tables.length} tables, ${enums.length} enums, ${fks.length} FKs, ${checks.length} checks`);
console.log(`  ${indexes.length} indexes, ${policies.length} policies, ${triggers.length} triggers, ${functions.length} functions`);
