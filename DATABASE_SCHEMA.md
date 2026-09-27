# Database Schema

สคีมาฉบับนี้สร้างจากฐานข้อมูลจริงบน Supabase ไม่ได้เขียนด้วยมือ จึงไม่มีทางคลาดเคลื่อนจากของจริง

> สร้างใหม่ด้วย `SB_TOKEN=<management token> SB_PROJECT_REF=<project ref> node tools/generate-schema-doc.mjs` · โปรเจกต์ `undefined`

## วิธีติดตั้ง

**วิธีเร็วที่สุด:** คัดลอก [`supabase/bootstrap.sql`](./supabase/bootstrap.sql) ไปวางใน **Supabase → SQL Editor** แล้วกด **Run

ไฟล์นี้คือ migration ทั้ง 11 ไฟล์เรียงตามลำดับ ต่อด้วย `seed.sql` และ **รันซ้ำได้** ทุกคำสั่งมี guard กันการซ้ำ ได้แก่ `create type/table/index ... if not exists` และ `drop ... if exists` นำหน้า `create trigger` `create policy` กับ `add constraint`

**ทีละไฟล์:** รันใน Supabase SQL Editor ตามลำดับ

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_assignment_hardening.sql`
3. `supabase/migrations/003_signup_role.sql`
4. `supabase/migrations/004_machine_soft_delete.sql`
5. `supabase/migrations/005_signup_role_enforcement.sql`
6. `supabase/migrations/006_bonus_features.sql`
7. `supabase/migrations/007_seed_viewer_account.sql`
8. `supabase/migrations/008_seed_friendly_actor_defaults.sql`
9. `supabase/migrations/009_audit_change_requests.sql`
10. `supabase/migrations/010_column_length_limits.sql`
11. `supabase/migrations/011_profile_self_service.sql`

ข้อมูลตัวอย่างอยู่ใน `supabase/seed.sql` แยกต่างหากเพื่อให้เลือกได้ว่าจะใส่หรือไม่

> ไฟล์ `supabase/bootstrap.sql` สร้างอัตโนมัติจาก migration ด้วย `node supabase/build-bootstrap.mjs` หัวไฟล์จะบันทึก sha256 ของไฟล์ต้นทางแต่ละชิ้น

## ภาพรวม

| รายการ | จำนวน |
| --- | --- |
| ตาราง | 7 |
| Enum type | 3 |
| Foreign key | 11 |
| Check constraint | 31 |
| Index | 19 |
| RLS policy | 22 |
| Trigger | 13 |
| ฟังก์ชัน | 45 |

### Enum type

| ชื่อ | ค่าที่เป็นไปได้ |
| --- | --- |
| `alarm_status` | open, in_progress, closed |
| `app_role` | admin, technician, viewer |
| `machine_status` | running, stop, alarm, maintenance |

### Row Level Security

| ตาราง | เปิด RLS |
| --- | --- |
| `alarms` | เปิด |
| `audit_log` | เปิด |
| `change_requests` | เปิด |
| `machines` | เปิด |
| `maintenance_records` | เปิด |
| `profiles` | เปิด |
| `schema_migrations` | **ไม่เปิด** |

## ตารางและคอลัมน์

### `alarms`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `id` | `uuid` | ห้ามว่าง | `gen_random_uuid()` |
| `machine_id` | `uuid` | ห้ามว่าง | — |
| `alarm_code` | `text` | ห้ามว่าง | — |
| `description` | `text` | ห้ามว่าง | — |
| `occurred_at` | `timestamp with time zone` | ห้ามว่าง | — |
| `cause` | `text` | ว่างได้ | — |
| `action_taken` | `text` | ว่างได้ | — |
| `status` | `alarm_status` | ห้ามว่าง | `'open'::alarm_status` |
| `created_by` | `uuid` | ห้ามว่าง | — |
| `closed_by` | `uuid` | ว่างได้ | — |
| `closed_at` | `timestamp with time zone` | ว่างได้ | — |
| `created_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |
| `updated_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |

### `audit_log`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `id` | `uuid` | ห้ามว่าง | `gen_random_uuid()` |
| `table_name` | `text` | ห้ามว่าง | — |
| `record_id` | `uuid` | ว่างได้ | — |
| `action` | `text` | ห้ามว่าง | — |
| `actor_id` | `uuid` | ว่างได้ | — |
| `actor_role` | `app_role` | ว่างได้ | — |
| `summary` | `text` | ว่างได้ | — |
| `changes` | `jsonb` | ว่างได้ | — |
| `created_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |

### `change_requests`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `id` | `uuid` | ห้ามว่าง | `gen_random_uuid()` |
| `title` | `text` | ห้ามว่าง | — |
| `description` | `text` | ห้ามว่าง | — |
| `category` | `text` | ห้ามว่าง | `'feature'::text` |
| `status` | `text` | ห้ามว่าง | `'pending'::text` |
| `requested_by` | `uuid` | ห้ามว่าง | — |
| `reviewed_by` | `uuid` | ว่างได้ | — |
| `reviewed_at` | `timestamp with time zone` | ว่างได้ | — |
| `review_note` | `text` | ว่างได้ | — |
| `created_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |

### `machines`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `id` | `uuid` | ห้ามว่าง | `gen_random_uuid()` |
| `machine_id` | `text` | ห้ามว่าง | — |
| `machine_name` | `text` | ห้ามว่าง | — |
| `machine_type` | `text` | ห้ามว่าง | — |
| `location` | `text` | ห้ามว่าง | — |
| `status` | `machine_status` | ห้ามว่าง | `'stop'::machine_status` |
| `created_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |
| `updated_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |
| `is_archived` | `boolean` | ห้ามว่าง | `false` |
| `archived_at` | `timestamp with time zone` | ว่างได้ | — |
| `archived_by` | `uuid` | ว่างได้ | — |

### `maintenance_records`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `id` | `uuid` | ห้ามว่าง | `gen_random_uuid()` |
| `machine_id` | `uuid` | ห้ามว่าง | — |
| `technician_id` | `uuid` | ห้ามว่าง | — |
| `problem` | `text` | ห้ามว่าง | — |
| `action_taken` | `text` | ห้ามว่าง | — |
| `started_at` | `timestamp with time zone` | ห้ามว่าง | — |
| `completed_at` | `timestamp with time zone` | ว่างได้ | — |
| `status` | `text` | ห้ามว่าง | `'in_progress'::text` |
| `created_by` | `uuid` | ห้ามว่าง | — |
| `created_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |
| `updated_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |

### `profiles`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `id` | `uuid` | ห้ามว่าง | — |
| `display_name` | `text` | ห้ามว่าง | — |
| `role` | `app_role` | ห้ามว่าง | `'technician'::app_role` |
| `created_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |
| `updated_at` | `timestamp with time zone` | ห้ามว่าง | `now()` |

### `schema_migrations`

| คอลัมน์ | ชนิด | null | ค่าเริ่มต้น |
| --- | --- | --- | --- |
| `version` | `varchar` | ห้ามว่าง | — |

## Foreign Key

| ตาราง | คอลัมน์ | อ้างไปที่ | กฎเมื่อลบ |
| --- | --- | --- | --- |
| `alarms` | `closed_by` | `profiles.id` | `RESTRICT` |
| `alarms` | `created_by` | `profiles.id` | `RESTRICT` |
| `alarms` | `machine_id` | `machines.id` | `RESTRICT` |
| `audit_log` | `actor_id` | `profiles.id` | `SET NULL` |
| `change_requests` | `requested_by` | `profiles.id` | `CASCADE` |
| `change_requests` | `reviewed_by` | `profiles.id` | `SET NULL` |
| `machines` | `archived_by` | `profiles.id` | `SET NULL` |
| `maintenance_records` | `created_by` | `profiles.id` | `RESTRICT` |
| `maintenance_records` | `machine_id` | `machines.id` | `RESTRICT` |
| `maintenance_records` | `technician_id` | `profiles.id` | `RESTRICT` |
| `profiles` | `id` | `users.id` | `CASCADE` |

ทุกคีย์ใช้ `restrict` หรือ `set null` ไม่มี `cascade` ยกเว้น `profiles.id` ซึ่งชี้กลับไปที่ `auth.users` เพราะเมื่อลบบัญชีออกจากระบบ profile ต้องหายตามไป ส่วนข้อมูลปฏิบัติการจะไม่ถูกลบตามบัญชี เพื่อให้ประวัติยังอยู่

## Check Constraint

| ตาราง | ชื่อ | นิยาม |
| --- | --- | --- |
| `alarms` | `alarms_action_taken_length` | `CHECK (((action_taken IS NULL) OR (length(action_taken) <= 2000)))` |
| `alarms` | `alarms_cause_length` | `CHECK (((cause IS NULL) OR (length(cause) <= 2000)))` |
| `alarms` | `alarms_code_length` | `CHECK ((length(alarm_code) <= 80))` |
| `alarms` | `alarms_code_not_blank` | `CHECK ((length(btrim(alarm_code)) > 0))` |
| `alarms` | `alarms_description_length` | `CHECK ((length(description) <= 1000))` |
| `alarms` | `alarms_description_not_blank` | `CHECK ((length(btrim(description)) > 0))` |
| `alarms` | `closed_alarm_has_resolution` | `CHECK (((status <> 'closed'::alarm_status) OR ((length(btrim(COALESCE(cause, ''::text))) > 0) AND (length(btrim(COALESCE(action_taken, ''::text))) > 0) AND (closed_by IS NOT NULL) AND (closed_at IS NOT NULL))))` |
| `audit_log` | `audit_log_action_check` | `CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))` |
| `change_requests` | `change_requests_description_check` | `CHECK ((length(btrim(description)) > 0))` |
| `change_requests` | `change_requests_description_length` | `CHECK ((length(description) <= 2000))` |
| `change_requests` | `change_requests_review_note_length` | `CHECK (((review_note IS NULL) OR (length(review_note) <= 2000)))` |
| `change_requests` | `change_requests_status_check` | `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))` |
| `change_requests` | `change_requests_title_check` | `CHECK (((length(btrim(title)) >= 3) AND (length(btrim(title)) <= 120)))` |
| `machines` | `archived_machine_is_stopped` | `CHECK (((NOT is_archived) OR (status = 'stop'::machine_status)))` |
| `machines` | `machines_location_length` | `CHECK ((length(location) <= 160))` |
| `machines` | `machines_location_not_blank` | `CHECK ((length(btrim(location)) > 0))` |
| `machines` | `machines_machine_id_format` | `CHECK ((machine_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$'::text))` |
| `machines` | `machines_machine_id_not_blank` | `CHECK (((length(btrim(machine_id)) >= 2) AND (length(btrim(machine_id)) <= 32)))` |
| `machines` | `machines_machine_name_length` | `CHECK ((length(machine_name) <= 120))` |
| `machines` | `machines_machine_name_not_blank` | `CHECK ((length(btrim(machine_name)) > 0))` |
| `machines` | `machines_machine_type_length` | `CHECK ((length(machine_type) <= 80))` |
| `machines` | `machines_machine_type_not_blank` | `CHECK ((length(btrim(machine_type)) > 0))` |
| `maintenance_records` | `maintenance_action_length` | `CHECK ((length(action_taken) <= 2000))` |
| `maintenance_records` | `maintenance_action_not_blank` | `CHECK ((length(btrim(action_taken)) > 0))` |
| `maintenance_records` | `maintenance_dates_valid` | `CHECK (((completed_at IS NULL) OR (completed_at >= started_at)))` |
| `maintenance_records` | `maintenance_problem_length` | `CHECK ((length(problem) <= 2000))` |
| `maintenance_records` | `maintenance_problem_not_blank` | `CHECK ((length(btrim(problem)) > 0))` |
| `maintenance_records` | `maintenance_records_status_check` | `CHECK ((status = ANY (ARRAY['in_progress'::text, 'waiting_part'::text, 'completed'::text])))` |
| `maintenance_records` | `maintenance_waiting_part_not_completed` | `CHECK (((status <> 'waiting_part'::text) OR (completed_at IS NULL)))` |
| `profiles` | `profiles_display_name_length` | `CHECK ((length(display_name) <= 120))` |
| `profiles` | `profiles_role_length` | `CHECK ((role = ANY (ARRAY['admin'::app_role, 'technician'::app_role, 'viewer'::app_role])))` |

## Index

| ตาราง | ชื่อ |
| --- | --- |
| `alarms` | `alarms_machine_idx` |
| `alarms` | `alarms_occurred_idx` |
| `alarms` | `alarms_pkey` |
| `alarms` | `alarms_status_idx` |
| `audit_log` | `audit_log_created_at_idx` |
| `audit_log` | `audit_log_pkey` |
| `audit_log` | `audit_log_table_idx` |
| `change_requests` | `change_requests_pkey` |
| `change_requests` | `change_requests_status_idx` |
| `machines` | `machines_active_idx` |
| `machines` | `machines_machine_id_key` |
| `machines` | `machines_machine_id_lower_unique` |
| `machines` | `machines_pkey` |
| `maintenance_records` | `maintenance_machine_idx` |
| `maintenance_records` | `maintenance_records_pkey` |
| `maintenance_records` | `maintenance_technician_idx` |
| `profiles` | `profiles_pkey` |
| `schema_migrations` | `schema_migrations_pkey` |
| `schema_migrations` | `schema_migrations_version_idx` |

## RLS Policy

| ตาราง | ชื่อ policy | คำสั่ง | ใช้กับ | เงื่อนไข USING | เงื่อนไข WITH CHECK |
| --- | --- | --- | --- | --- | --- |
| `alarms` | `admins delete alarms` | `DELETE` | `{authenticated}` | `is_admin()` | `—` |
| `alarms` | `admins update alarms` | `UPDATE` | `{authenticated}` | `is_admin()` | `is_admin()` |
| `alarms` | `authenticated users create alarms` | `INSERT` | `{authenticated}` | `—` | `((created_by = uid()) AND can_write())` |
| `alarms` | `authenticated users read alarms` | `SELECT` | `{authenticated}` | `true` | `—` |
| `alarms` | `technicians update alarm workflow` | `UPDATE` | `{authenticated}` | `(can_write() AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = uid()) AND (p.role = 'technician'::app_role)))))` | `(can_write() AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = uid()) AND (p.role = 'technician'::app_role)))))` |
| `alarms` | `viewers read alarms` | `SELECT` | `{authenticated}` | `true` | `—` |
| `audit_log` | `authenticated users read audit log` | `SELECT` | `{authenticated}` | `true` | `—` |
| `change_requests` | `admins review change requests` | `UPDATE` | `{authenticated}` | `is_admin()` | `is_admin()` |
| `change_requests` | `authenticated users create change requests` | `INSERT` | `{authenticated}` | `—` | `(requested_by = uid())` |
| `change_requests` | `authenticated users read change requests` | `SELECT` | `{authenticated}` | `true` | `—` |
| `machines` | `admins manage machines` | `ALL` | `{authenticated}` | `is_admin()` | `is_admin()` |
| `machines` | `authenticated users read machines` | `SELECT` | `{authenticated}` | `true` | `—` |
| `machines` | `viewers read machines` | `SELECT` | `{authenticated}` | `true` | `—` |
| `maintenance_records` | `admins delete maintenance` | `DELETE` | `{authenticated}` | `is_admin()` | `—` |
| `maintenance_records` | `admins or assigned technicians update maintenance` | `UPDATE` | `{authenticated}` | `(can_write() AND (is_admin() OR (technician_id = uid())))` | `(can_write() AND (is_admin() OR (technician_id = uid())))` |
| `maintenance_records` | `admins or technicians create maintenance` | `INSERT` | `{authenticated}` | `—` | `(can_write() AND (technician_id = uid()) AND (created_by = uid()))` |
| `maintenance_records` | `authenticated users read maintenance` | `SELECT` | `{authenticated}` | `true` | `—` |
| `maintenance_records` | `viewers read maintenance` | `SELECT` | `{authenticated}` | `true` | `—` |
| `profiles` | `admins manage profiles` | `ALL` | `{authenticated}` | `is_admin()` | `is_admin()` |
| `profiles` | `admins read profiles` | `SELECT` | `{authenticated}` | `is_admin()` | `—` |
| `profiles` | `users read own profile` | `SELECT` | `{authenticated}` | `(id = uid())` | `—` |
| `profiles` | `users update own profile` | `UPDATE` | `{authenticated}` | `(id = uid())` | `(id = uid())` |

**หมายเหตุ:** `audit_log` มีเพียง policy ระบุ `for select` เท่านั้น ไม่มี policy สำหรับ insert แม้แต่ตัวเดียว เพราะรายการต้องถูกเขียนโดย trigger ซึ่งรันเป็น `security definer` เท่านั้น ผลคือ client ไม่สามารถสร้าง แก้ไข หรือลบรายการ audit ได้เลย แม้จะล็อกอินด้วย role ใดก็ตาม

## Trigger

| ตาราง | ชื่อ | จังหวะ |
| --- | --- | --- |
| `alarms` | `alarms_actor` | BEFORE |
| `alarms` | `alarms_audit` | AFTER |
| `alarms` | `alarms_updated_at` | BEFORE |
| `change_requests` | `change_requests_audit` | AFTER |
| `machines` | `machines_archive_actor` | BEFORE |
| `machines` | `machines_audit` | AFTER |
| `machines` | `machines_updated_at` | BEFORE |
| `maintenance_records` | `maintenance_actor` | BEFORE |
| `maintenance_records` | `maintenance_audit` | AFTER |
| `maintenance_records` | `maintenance_updated_at` | BEFORE |
| `profiles` | `profiles_protect_role` | BEFORE |
| `profiles` | `profiles_updated_at` | BEFORE |
| `users` | `on_auth_user_created` | AFTER |

## ฟังก์ชัน

| ชื่อ | คืนค่า | ภาษา | สิทธิ์ |
| --- | --- | --- | --- |
| `armor` | `text` | `c` | SECURITY INVOKER |
| `armor` | `text` | `c` | SECURITY INVOKER |
| `audit_record_id` | `uuid` | `sql` | SECURITY INVOKER |
| `can_write` | `boolean` | `sql` | SECURITY DEFINER |
| `crypt` | `text` | `c` | SECURITY INVOKER |
| `dearmor` | `bytea` | `c` | SECURITY INVOKER |
| `decrypt` | `bytea` | `c` | SECURITY INVOKER |
| `decrypt_iv` | `bytea` | `c` | SECURITY INVOKER |
| `digest` | `bytea` | `c` | SECURITY INVOKER |
| `digest` | `bytea` | `c` | SECURITY INVOKER |
| `encrypt` | `bytea` | `c` | SECURITY INVOKER |
| `encrypt_iv` | `bytea` | `c` | SECURITY INVOKER |
| `gen_random_bytes` | `bytea` | `c` | SECURITY INVOKER |
| `gen_random_uuid` | `uuid` | `c` | SECURITY INVOKER |
| `gen_salt` | `text` | `c` | SECURITY INVOKER |
| `gen_salt` | `text` | `c` | SECURITY INVOKER |
| `handle_new_user` | `trigger` | `plpgsql` | SECURITY DEFINER |
| `hmac` | `bytea` | `c` | SECURITY INVOKER |
| `hmac` | `bytea` | `c` | SECURITY INVOKER |
| `is_admin` | `boolean` | `sql` | SECURITY DEFINER |
| `pgp_armor_headers` | `SETOF record` | `c` | SECURITY INVOKER |
| `pgp_key_id` | `text` | `c` | SECURITY INVOKER |
| `pgp_pub_decrypt` | `text` | `c` | SECURITY INVOKER |
| `pgp_pub_decrypt` | `text` | `c` | SECURITY INVOKER |
| `pgp_pub_decrypt` | `text` | `c` | SECURITY INVOKER |
| `pgp_pub_decrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_pub_decrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_pub_decrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_pub_encrypt` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_pub_encrypt` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_pub_encrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_pub_encrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_sym_decrypt` | `text` | `c` | SECURITY INVOKER |
| `pgp_sym_decrypt` | `text` | `c` | SECURITY INVOKER |
| `pgp_sym_decrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_sym_decrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_sym_encrypt` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_sym_encrypt` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_sym_encrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `pgp_sym_encrypt_bytea` | `bytea` | `c` | SECURITY INVOKER |
| `protect_profile_role` | `trigger` | `plpgsql` | SECURITY DEFINER |
| `set_machine_archive_actor` | `trigger` | `plpgsql` | SECURITY DEFINER |
| `set_record_actor` | `trigger` | `plpgsql` | SECURITY DEFINER |
| `set_updated_at` | `trigger` | `plpgsql` | SECURITY INVOKER |
| `write_audit_log` | `trigger` | `plpgsql` | SECURITY DEFINER |

ฟังก์ชันที่ทำงานแทนผู้เรียก (`security definer`) คือ `is_admin()` `can_write()` `handle_new_user()` `set_record_actor()` `write_audit_log()` `audit_record_id()` และ `protect_profile_role()` ทั้งหมดตั้ง `search_path = public` เพื่อไม่ให้มีการเรียกฟังก์ชันของ schema อื่นผ่านชื่อกำกวม

### ฟังก์ชันที่กันการเลื่อนสิทธิ์ตัวเอง

`protect_profile_role()` ทำงานก่อน `UPDATE` บน `profiles` และ**ปฏิเสธ**คำขอเปลี่ยน `role` เว้นแต่ผู้เรียกเป็น Admin

จำเป็นเพราะ policy `users update own profile` อนุญาตให้ผู้ใช้แก้โปรไฟล์ของตัวเองได้ แต่ `role` อยู่ในแถวเดียวกัน และ RLS ของ PostgreSQL **เลือกได้แค่ระดับแถว ไม่ได้ระดับคอลัมน์** ถ้าไม่มี trigger กันไว้ ผู้ใช้ทั่วไปจะตั้ง `role = 'admin'` ให้ตัวเองได้

การตรวจสอบด้วยการยิงคำขอจริง: ช่างเทคนิคตั้งชื่อตัวเองได้ · ตั้งชื่อบัญชีอื่นไม่ได้ · ตั้ง `role` ของตัวเองไม่ได้ (ทั้งจาก technician และ viewer) · Admin ยังจัดการ Role ได้ตามปกติ

## ข้อมูลปัจจุบันในระบบ

| ตาราง | แถว |
| --- | --- |
| `profiles` | 12 |
| `machines` | 6 |
| `alarms` | 10 |
| `maintenance_records` | 4 |
| `audit_log` | 37 |
| `change_requests` | 3 |

## วิธีดูสคีมาด้วยตนเอง

รันใน Supabase SQL Editor

```sql
-- คอลัมน์ทั้งหมดของทุกตาราง
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- RLS Policy ทั้งหมด
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Trigger ทั้งหมด
select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth') and not t.tgisinternal;
```
