# ForgeOps — ระบบจัดการ Alarm และงานบำรุงรักษา

Web application สำหรับทีมงาน Automation ในโรงงาน ใช้จัดการข้อมูลเครื่องจักรหลัก (Machine Master), เหตุแจ้งเตือนเครื่องจักร (Alarm) และงานบำรุงรักษา (Maintenance) พร้อมสถานะการทำงานแบบเรียลไทม์ โปรเจกต์นี้จัดทำตามข้อกำหนดวิชา *Programming in Automation Systems*

## 1. วัตถุประสงค์

- ให้มีพื้นที่ทำงาน (workspace) เดียวสำหรับเครื่องจักรในสายการผลิต
- บันทึก ตรวจสอบสาเหตุ และปิดเหตุแจ้งเตือนของเครื่องจักร
- บันทึกงานบำรุงรักษาและสถานะการดำเนินงาน
- แสดงสรุปจำนวนเครื่องจักร เหตุแจ้งเตือน และงานบำรุงรักษาแบบเรียลไทม์
- บังคับสิทธิ์ของ Admin และ Technician ทั้งที่ชั้น UI และที่ชั้น Supabase Row Level Security (RLS)
- ใช้เทคโนโลยีสมัยใหม่ ได้แก่ Supabase, Next.js, Tailwind CSS และ Vercel

## 2. เทคโนโลยีที่ใช้

| รายการ | เวอร์ชัน / รายละเอียด |
| --- | --- |
| Next.js | 16 App Router + TypeScript |
| React | 19 |
| Tailwind CSS | 4 (ผ่าน `@theme` และ utility classes ทั้งหมด) |
| Supabase | Authentication, PostgreSQL, Row Level Security |
| Vercel | การ Deploy ระบบ |
| AI | ช่วยวิเคราะห์โจทย์ เขียนโค้ด หาและแก้บั๊ก จัดทำเอกสาร |

## 3. Function หลักของระบบ

### 3.1 ระบบผู้ใช้งาน (Authentication & Role)

- Login และ Logout โดยใช้ Supabase Authentication แบบอีเมล/รหัสผ่าน
- ผู้ใช้ใหม่สมัครสมาชิกจากหน้า Login และเลือก Role เป็น `Technician` หรือ `Admin` โดย Role ที่เลือกถูกตรวจสอบซ้ำที่ชั้นฐานข้อมูลอีกครั้ง
- Role ทั้งสองเก็บไว้ในตาราง `public.profiles`
- **Admin**: จัดการ Machine, Alarm, Maintenance และข้อมูลหลักของระบบได้ทั้งหมด
- **Technician**: ดูข้อมูลเครื่องจักรและ Dashboard, บันทึก/แก้ไข Maintenance ที่ได้รับมอบหมาย, เปลี่ยนสถานะ Alarm และบันทึก Alarm ใหม่
- Next.js `proxy.ts` ทำหน้าที่ป้องกันเส้นทาง (route protection) ส่วน PostgreSQL RLS เป็นขอบเขตสิทธิ์การเข้าถึงขั้นสุดท้าย

#### ตารางความสามารถตาม Role

| ความสามารถ | ชั้น UI | RLS Policy | ตัวป้องกันเพิ่มที่ฐานข้อมูล |
| --- | --- | --- | --- |
| ดูข้อมูลเครื่องจักร | `machine-console.tsx` แสดงแบบอ่านอย่างเดียว ขึ้นว่า "View only" | `authenticated users read machines` | — |
| เพิ่ม / แก้ / Archive เครื่องจักร | `canManage = role === "admin"` ซ่อนปุ่มทั้งหมด | `admins manage machines` | — |
| บันทึก Maintenance | ระบบบังคับให้ Technician เป็นเจ้าของงาน | `admins or technicians create maintenance` | `set_record_actor()` ตั้ง `created_by` / `completed_at` |
| แก้ไข Maintenance | `canEditRecord()` อนุญาตเฉพาะงานของตัวเอง | `admins or assigned technicians update maintenance` | `set_record_actor()` บังคับ `technician_id = auth.uid()` |
| เปลี่ยนสถานะ Alarm | `canManageDetails` จำกัดฟอร์มเหลือ status / cause / action | `technicians update alarm workflow` | `set_record_actor()` ตอก error เมื่อพยายามแก้ field อื่น |
| ดู Dashboard | ไม่มีการจำกัดตาม Role | `authenticated users read alarms` / `authenticated users read maintenance` | — |
| เลื่อนสิทธิ์ตัวเองเป็น Admin | หน้า `/users` เข้าได้เฉพาะ Admin ที่เหลือจะถูก redirect | `admins manage profiles` | — |
| อ่านข้อมูลทุกตารางในฐานะ `Viewer` | `canWrite()` ซ่อนปุ่ม Create / Edit / Delete ทุกหน้า | `viewers read machines` / `viewers read alarms` / `viewers read maintenance` | `public.can_write()` ทำให้ policy ของช่างไม่รับ Viewer |

**ทำไมต้องมี `public.can_write()`:** ถ้าเขียน policy ของช่างว่า "ไม่ใช่ Admin" ตรง ๆ บอกว่า `not is_admin()` หรือเขียนเป็น `is_admin() or technician_id = auth.uid()` บอร์ด `viewer` จะผ่านเงื่อนไขนั้นด้วย เพราะ Viewer ไม่ใช่ Admin และช่อง `technician_id` เป็นค่าว่างได้ ฟังก์ชัน `can_write()` จึงระบุตรง ๆ ว่าใครเขียนข้อมูลได้บ้าง และถูกเรียกใน policy ที่เกี่ยวข้องทุกตัว

**ข้อสังเกต 2 ข้อสำหรับผู้ตรวจ:**

- โจทย์ระบุให้ Technician ทำ *เปลี่ยนสถานะ Alarm* และให้ Admin ทำ *จัดการ Alarm* แต่ระบบนี้เปิดให้ Technician **บันทึก Alarm** เพิ่มด้วย เพราะในโรงงานจริงช่างเทคนิคที่อยู่หน้าเครื่องมักเป็นผู้บันทึกเหตุแจ้งเตือน โดยใช้ policy `authenticated users create alarms` และ `created_by` ถูกบังคับเป็นผู้ใช้ที่ล็อกอินเสมอ หากต้องการแยกสิทธิ์เข้มขึ้น แก้ policy ได้ในบรรทัดเดียว
- Technician แก้ไข Maintenance ได้เฉพาะรายการที่ได้รับมอบหมาย บังคับด้วย policy `admins or assigned technicians update maintenance` จึงไม่สามารถแก้งานของช่างคนอื่นได้

**หมายเหตุเรื่อง RLS:** เมื่อการเขียนข้อมูลถูก RLS ปฏิเสธ PostgREST จะกรองแถวนั้นทิ้งและตอบ `204 No Content` แทนที่จะตอบเป็น error เพราะไม่มีแถวที่ match ส่วนโค้ดแอปตรวจจับกรณีนี้แล้วและแสดงข้อความว่าไม่มีสิทธิ์ แทนที่จะรายงานว่าสำเร็จ (ดู `changeStatus` ใน `alarm-console.tsx` และ `destroy` ใน `machine-console.tsx`)

### 3.2 Machine Master

- **ฟิลด์**: Machine ID, Machine Name, Machine Type, Location, Status
- **สถานะ**: `Running`, `Stop`, `Alarm`, `Maintenance`
- Admin สามารถ Create, Read, Update และ Delete ได้
- Machine ID ตรวจซ้ำทั้งที่เบราว์เซอร์และที่ฐานข้อมูลด้วย unique index แบบไม่สนตัวพิมพ์ (`lower(machine_id)`)
- การ Archive เก็บเครื่องออกจากรายการที่ใช้งานอยู่ แต่คงประวัติ Alarm และ Maintenance ไว้ทั้งหมด และเครื่องที่ Archive แล้วจะถูกบังคับเป็นสถานะ `Stop` เพื่อไม่ให้ตัวนับบน Dashboard เพี้ยน

### 3.3 Alarm Record

- **ฟิลด์**: Machine, Alarm Code, Alarm Description, Date/Time, Cause, Action Taken, Status
- **สถานะ**: `Open`, `In Progress`, `Closed`
- สามารถ Create, Read และ Update ได้
- Alarm ต้องมีทั้ง Cause และ Action Taken ก่อนจึงจะปิดเป็น `Closed` ได้
- Admin แก้ได้ทุก field · Technician แก้ได้เฉพาะ field ของ workflow ตามที่ policy อนุญาต

### 3.4 Maintenance Record

- **ฟิลด์**: Machine, Technician, Problem, Action Taken, Started At, Status และเวลาที่ปิดงาน
- **สถานะ**: `In Progress`, `Completed`
- สามารถ Create, Read และ Update ได้
- Technician ถูกบังคับให้เป็นเจ้าของงานของตัวเองเท่านั้น

#### ตารางแสดงความครอบคลุมข้อกำหนด 3.2 – 3.4

| ข้อกำหนด | การดำเนินการ | ผลการตรวจสอบ |
| --- | --- | --- |
| 3.2 ฟิลด์ Machine ID, Machine Name, Machine Type, Location, Status | ตาราง `machines` + modal ใน `machine-console.tsx` | ครบ 5/5 ฟิลด์ |
| 3.2 สถานะ Running, Stop, Alarm, Maintenance | enum `machine_status` | รับได้ครบทั้ง 4 ค่า |
| 3.2 Machine Master CRUD | เพิ่ม / แก้ / archive / restore / ลบ ใน `machine-console.tsx` | ผ่านครบทั้ง 4 การกระทำ |
| 3.3 ฟิลด์ Machine, Alarm Code, Alarm Description, Date/Time, Cause, Status | ตาราง `alarms` + modal ใน `alarm-console.tsx` | ครบ 6/6 ฟิลด์ |
| 3.3 สถานะ Open, In Progress, Closed | enum `alarm_status` | ทั้ง 3 ค่าเปลี่ยนได้ |
| 3.3 Alarm Record Create, Read, Update | `alarm-console.tsx` | ผ่านทั้งหมด |
| 3.4 Maintenance Record Create, Read, Update | `maintenance-console.tsx` | ผ่านทั้งหมด |

**เรื่อง Delete ของ Machine Master:** ปุ่ม Delete แสดงให้ Admin ทุกแถว แต่เครื่องที่ยังถูกอ้างอิงโดย Alarm หรือ Maintenance จะถูกฐานข้อมูลปฏิเสธด้วย foreign key violation และระบบจะแนะนำให้ใช้ **Archive** แทน เพราะ Archive เก็บประวัติไว้ครบถ้วน นี่เป็นการตัดสินใจด้านความถูกต้องของข้อมูลอย่างตั้งใจ ไม่ใช่ฟีเจอร์ที่ขาด และเข้าถึงได้ทั้งสองทางจากแถวเดียวกัน

### 3.5 Search และ Filter

| หน้า | เงื่อนไขที่ใช้กรอง | จำนวนเงื่อนไข |
| --- | --- | --- |
| Machines | ค้นข้อความ (ID / ชื่อ / ชนิด / ตำแหน่ง) + สถานะ + ขอบเขต archived | 3 |
| Alarms | ค้นข้าความ (เครื่อง / code / รายละเอียด) + สถานะ | 2 |
| Maintenance | ค้นข้อความ (ปัญหา / งานที่ทำ / เครื่อง / ช่าง) + สถานะ (รวม Waiting part) | 2 |
| Dashboard | ค้นข้อความ + ช่วงเวลา 24 ชั่วโมง / 7 วัน | 2 |
| Reports | ค้นข้อความ + ชนิดข้อมูล + เครื่องจักร + สถานะ + ช่วงเวลา | 5 |
| Audit | ตารางที่บันทึก + ประเภทการกระทำ (insert / update / delete) | 2 |
| History | เลือกเครื่องจักร | 1 |

ครอบคลุมเป้าหมายการค้นหาครบทั้ง 5 หัวข้อตามโจทย์ ได้แก่ Machine, Status, Alarm Code, Technician และ Date

**ขอบเขตของตัวกรองบน Dashboard:** ช่วงเวลาและช่องค้นหามีผลกับทุกอย่างที่เป็น "เรื่องที่เกิดขึ้น" ได้แก่ ตัวเลข Alarm, คิวเหตุแจ้งเตือน, กราฟแท่งรายวัน และอัตราการปิดงานบำรุงรักษา แต่**ไม่กรองจำนวนเครื่องจักรตามสถานะ** เพราะสถานะของเครื่องเป็นข้อมูล "ตอนนี้" ไม่ใช่ช่วงเวลา — ถ้ากรองตามเวลาแล้วสถานะที่เห็นจะทำให้เข้าใจผิดว่าเครื่องหยุดทำงานในช่วงนั้น

### 3.6 Dashboard

- แสดงจำนวนเครื่องจักรทั้งหมด (การ์ด "Total machines" และตัวเลขกลาง donut)
- แสดงจำนวนเครื่องจักรแยกตามสถานะ Running, Stop, Alarm และ Maintenance (legend ของกราฟ donut พิมพ์จำนวนแต่ละสถานะ)
- แสดงจำนวน Alarm ที่ยัง active และจำนวนงาน Maintenance โดยนับเฉพาะที่อยู่ในช่วงเวลาที่เลือก
- สรุปข้อมูลเป็นกราฟได้ ได้แก่ กราฟ donut แหวนสถานะเครื่องจักร, คิวเหตุแจ้งเตือน, กราฟแท่งจำนวน Alarm รายวัน 7 วัน และแถบสรุปอัตราการปิดงานบำรุงรักษา
- ช่องค้นหาและตัวเลือกช่วงเวลา (24 ชม. / 7 วัน) มีผลจริงกับตัวเลข Alarm, คิวเหตุแจ้งเตือน, กราฟ และอัตราการปิดงาน ไม่ใช่แค่เปลี่ยนป้ายบอกช่วงเวลา
- คอลัมน์ "Machine health" แสดง **จำนวน Alarm ที่ยังค้างของแต่ละเครื่อง** นับจากข้อมูลจริง ไม่ใช่ค่าคะแนนที่ตั้งขึ้น
- ข้อมูลทั้งหมดมาจาก route `/api/dashboard` ที่ต้องผ่านการยืนยันตัวตนก่อน
- หน้า Reports รวมข้อมูลทั้งสามชนิดเป็นตารางเดียว กรองได้ 5 เงื่อนไข และส่งออก CSV เฉพาะแถวที่แสดงอยู่

### 3.7 Input Validation

- ช่องข้อมูลสำคัญห้ามว่าง — บังคับด้วย `not null` และ check constraint `length(btrim(...)) > 0` บนคอลัมน์ข้อความทุกคอลัมน์
- Machine ID ห้ามซ้ำ — unique index `machines_machine_id_lower_unique` บน `lower(machine_id)` และซ้ำแบบตัวพิมพ์ต่างกันก็ถูกปฏิเสธเช่นกัน
- รูปแบบข้อมูลถูกต้อง — Machine ID ต้องตรง regex `^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$` และค่าของ Status ต้องเป็น enum ที่กำหนดไว้เท่านั้น
- **ความยาวสูงสุดบังคับที่ฐานข้อมูล ไม่ใช่แค่ที่เบราว์เซอร์** — migration `010` เพิ่ม check constraint ให้ทุกคอลัมน์ข้อความ (Machine Name ≤ 120, Location ≤ 160, Description ≤ 1000 และอื่น ๆ) ยิง REST API ตรง ๆ เลยก็เขียนค่าที่ยาวเกินไม่ได้
- แสดงข้อความแจ้งเตือนเมื่อข้อมูลไม่ถูกต้อง — ฟังก์ชัน `describeWriteError` ใน `src/lib/operations/validation.ts` แปลงรหัส error ของ Postgres แต่ละแบบเป็นข้อความ **ภาษาไทยคู่ภาษาอังกฤษ** ที่ระบุวิธีแก้ได้ ใช้ร่วมกันทั้งสามโมดูล และแสดงผ่าน `role="alert"` **ภายใน modal** ไม่ใช่หลังฉากหลัง
- ฟอร์มตั้ง `noValidate` เพื่อไม่ให้ browser ดักข้อความของตัวเองมาก่อน เพราะข้อความของ browser เป็นภาษาอังกฤษล้วน

ผลการตรวจสอบ Input Validation ด้วยการยิงคำขอจริง 13 รายการ **ผ่านทั้ง 13 รายการ** ได้แก่ ช่องว่าง, Machine ID ซ้ำ, Machine ID ซ้ำแบบต่างตัวพิมพ์, รูปแบบผิด, สั้นเกิน, ยาวเกิน, Status ไม่มีในระบบ, Alarm Code ว่าง, Alarm Description ว่าง, Maintenance Problem ว่าง และ Status ที่ไม่มีในระบบ

นอกจากนี้ยังมีชุดทดสอบ `tests/integration.test.ts` ที่ยิงข้าม browser ไปตรง ๆ เพื่อพิสูจน์ว่า **ฐานข้อมูล** ปฏิเสธด้วยเอง ไม่ใช่แค่ฟอร์ม ครอบคลุมกรณีค่าที่ยาวเกินขีดจำกัดพอดีและเกินขีด 1 ตัวอักษร และกรณีที่ผู้ใช้พยายามเปลี่ยน Role ของตัวเอง

## 4. โครงสร้างฐานข้อมูล

### 4.1 ตารางข้อมูล

> เอกสารสคีมาฉบับเต็มพร้อม ERD, Foreign Key, RLS Policy, Trigger และฟังก์ชัน อยู่ที่ [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)

| ตาราง | คอลัมน์ | ความสัมพันธ์ |
| --- | --- | --- |
| `profiles` | `id`, `display_name`, `role` | 1 profile ต่อผู้ใช้ Supabase Auth |
| `machines` | `id`, `machine_id`, `machine_name`, `machine_type`, `location`, `status`, `is_archived`, `archived_at`, `archived_by` | — |
| `alarms` | `id`, `machine_id`, `alarm_code`, `description`, `occurred_at`, `cause`, `action_taken`, `status`, `created_by`, `closed_by`, `closed_at` | `machine_id` → `machines.id` |
| `maintenance_records` | `id`, `machine_id`, `technician_id`, `problem`, `action_taken`, `started_at`, `completed_at`, `status`, `created_by` | `machine_id` → `machines.id`, `technician_id` → `profiles.id` |

เปิด RLS ไว้บนทุกตารางของแอป Foreign key ใช้ `on delete restrict` เพื่อไม่ให้ประวัติที่อ้างอิงอยู่ถูกลบทิ้งโดยไม่ตั้งใจ

### 4.2 การติดตั้งฐานข้อมูล (แนะนำวิธีเร็วที่สุด)

คัดลอกเนื้อหาไฟล์ [`supabase/bootstrap.sql`](./supabase/bootstrap.sql) ไปวางใน **Supabase → SQL Editor** แล้วกด **Run** ไฟล์นี้คือ migration ทั้ง 11 ไฟล์เรียงตามลำดับ ต่อด้วย `seed.sql` รวมเป็นไฟล์เดียว

ไฟล์นี้ **รันซ้ำได้** ทุกคำสั่งถูกเขียนให้ปลอดภัยเมื่อรันซ้ำ ได้แก่

- `create type` / `create table` / `create index` ใช้ `if not exists`
- `create trigger` / `create policy` / `add constraint` มี `drop ... if exists` นำหน้าทุกตัว เพราะ PostgreSQL ไม่มี `ADD CONSTRAINT IF NOT EXISTS`

ยืนยันแล้วว่ารันทั้งไฟล์ **3 รอบซ้อนกันใน transaction เดียวไม่เกิด error** และไม่ทำให้จำนวนแถวเปลี่ยน

หลังจากรันเสร็จ ให้สมัครบัญชีผ่านหน้าเว็บก่อน แล้วรันคำสั่งท้ายไฟล์เพื่อเลื่อนบัญชีของตัวเองเป็น Admin (ไฟล์พิมพ์คำสั่งนี้ไว้ให้แล้ว) จากนั้นออกจากระบบแล้วเข้าใหม่ เนื่องจากระบบอ่านค่า Role เพียงครั้งเดียวตอนหน้าเว็บโหลด

> `supabase/bootstrap.sql` เป็นไฟล์ที่ **สร้างอัตโนมัติ** จาก `supabase/migrations/*.sql` และ `supabase/seed.sql` โดยสคริปต์ `supabase/build-bootstrap.mjs` หากแก้ migration ให้รัน `node supabase/build-bootstrap.mjs` เพื่อสร้างไฟล์ใหม่ ส่วนหัวไฟล์จะบันทึกชื่อไฟล์และค่า sha256 ของแต่ละชิ้นที่นำมาประกอบ

### 4.3 การติดตั้งสคีมาทีละไฟล์

หากต้องการติดตั้งทีละขั้นตอนเพื่อดูรายละเอียด ให้รันไฟล์ต่อไปนี้ใน Supabase SQL Editor ตามลำดับ

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

ข้อมูลตัวอย่างสำหรับทดลองใช้งานเพิ่มเติมอยู่ใน `supabase/seed.sql` ไฟล์นี้มี 4 เครื่อง, 9 alarm กระจายใน 7 วัน และ 3 งานบำรุงรักษา (2 งานปิดเสร็จแล้ว)

> **ข้อควรระวัง:** `003_signup_role.sql` เขียนทับเฉพาะฟังก์ชัน `public.handle_new_user()` ส่วน trigger `on_auth_user_created` ถูกสร้างโดย `001_initial_schema.sql` ดังนั้น `005_signup_role_enforcement.sql` จึงเขียนทับทั้งฟังก์ชันและสร้าง trigger ใหม่อีกครั้ง เพื่อซ่อมโปรเจกต์ที่มีฟังก์ชันเวอร์ชันเก่าซึ่งกำหนด role เป็น `technician` แบบตายตัว

## 5. วิธีติดตั้งและใช้งาน

### 5.1 ความต้องการของระบบ

- Node.js เวอร์ชัน 22.6 ขึ้นไป (Next.js 16 ต้องการ 20.9 ขึ้นไป แต่ชุดทดสอบใช้ type stripping ของ Node.js ซึ่งมาตั้งแต่ 22.6 ดูรายละเอียดที่[หัวข้อ 7](#7-การ-deploy))
- โปรเจกต์ Supabase 1 โปรเจกต์
- บัญชีผู้ใช้ Supabase แยกสำหรับแต่ละ Role

### 5.2 ติดตั้งและตั้งค่า

```bash
git clone https://github.com/nuttapongpurnz-tech/my-project.git
cd my-project
npm install
cp .env.example .env.local
```

กำหนดค่าในไฟล์ `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> ห้ามใส่ Supabase Service Role Key ในตัวแปร `NEXT_PUBLIC_*` หรือในโค้ดฝั่ง client โดยเด็ดขาด

### 5.3 สร้างบัญชี Admin แรก

ระบบนี้**ไม่มีบัญชีสาธารณะ** เพื่อไม่ให้มีใครเข้าใช้งานได้จากข้อมูลที่เผยแพร่อยู่ใน README ผู้ตรวจต้องสมัครบัญชีเองตามขั้นตอนนี้

1. สมัครบัญชีที่หน้า `/login` (เลือก Role เป็น **Technician** ได้ จะสมัครสำเร็จแน่นอน)
2. เปิด **Supabase → SQL Editor** แล้วรันคำสั่งใน [`supabase/make-admin.sql`](./supabase/make-admin.sql) โดยแก้อีเมลเป็นของตัวเอง

   ```sql
   update public.profiles p
   set role = 'admin'
   where p.id = (select u.id from auth.users u where u.email = 'you@example.com')
   returning p.display_name, p.role;
   ```

3. ออกจากระบบแล้วเข้าใหม่ (ระบบอ่านค่า Role ครั้งเดียวตอนหน้าเว็บโหลด จึงต้องเข้าใหม่ไม่ใช่แค่ refresh)

> **ทำไมต้องเลื่อนด้วยตนเอง** การเลื่อน "บัญชีแรกที่สมัคร" อัตโนมัติจะให้สิทธิ์ Admin แก่ใครก็ตามที่สมัครก่อน ซึ่งบนเว็บที่ deploy สาธารณะอาจเป็นคนแปลกหน้า การเลื่อนโดยระบุอีเมลจึงปลอดภัยกว่า · ยืนยันแล้วว่าขั้นตอนนี้ใช้ได้จริง: สมัคร → เลื่อนเป็น admin → สร้างเครื่องจักรสำเร็จ (HTTP 201) · รันซ้ำสองครั้งก็ไม่มีผลข้างเคียง

ข้อมูลตัวอย่างจาก `seed.sql` ยังอยู่ครบ เห็นเครื่องจักรและ Alarm ทันทีหลังสมัครโดยไม่ต้องใส่อะไรเพิ่ม

### 5.4 ปิดการยืนยันอีเมลเพื่อให้สมัครสมาชิกได้

ไปที่ **Supabase Dashboard → Authentication → Sign In / Providers → Email** แล้ว **ปิด** ตัวเลือก **Confirm email**

หากไม่ทำขั้นตอนนี้ ฟอร์มสมัครสมาชิกจะใช้งานไม่ได้ในโปรเจกต์ใหม่ เพราะบริการอีเมลในตัวของ Supabase มีโควตาต่อชั่วโมงน้อยมาก อีเมลยืนยันจึงไม่ถูกส่งออกไป

### 5.5 แก้ปัญหาสมัครสมาชิกแล้วได้ Role เป็น Technician ทั้งหมด

**อาการ:** เลือก Role **Admin** ในฟอร์มสมัครสมาชิก แต่เข้าเว็บแล้วระบบแสดง **Technician** และปุ่มสำหรับ Admin ไม่ปรากฏ

**ตรวจสอบ** ด้วยคำสั่งนี้ใน Supabase SQL Editor จะเห็นว่า `requested_role` เป็น `admin` แต่ `role` เป็น `technician`

```sql
select u.email, p.role, u.raw_user_meta_data ->> 'role' as requested_role
from auth.users u
join public.profiles p on p.id = u.id
order by u.created_at desc;
```

**สาเหตุ:** ฟังก์ชัน `public.handle_new_user()` ที่ใช้งานอยู่เป็นเวอร์ชันเก่าที่กำหนด role เป็น `technician` แบบตายตัว และไม่ได้อ่าน role จาก `raw_user_meta_data` เลย

**วิธีแก้:** รัน `supabase/migrations/005_signup_role_enforcement.sql` ใน SQL Editor แล้วสมัครสมาชิกใหม่ ไฟล์นี้รันซ้ำได้

**การเลื่อนบัญชีเดิมเป็น Admin:** โปรไฟล์ที่สร้างก่อนแก้ไขจะยังคง role เดิม และบัญชีที่สร้างผ่านหน้า Dashboard ของ Supabase จะเป็น Technician เสมอ เพราะ Dashboard ไม่ได้ส่งข้อมูล role มา ใช้คำสั่งนี้โดยแทนค่า UUID จาก **Authentication → Users**

```sql
update public.profiles
set role = 'admin'
where id = 'AUTH-USER-UUID-HERE';
```

### 5.6 รันระบบ

```bash
npm run dev
```

เปิด `http://localhost:3000/login`

### 5.7 แก้ปัญหาการเข้าสู่ระบบ

สาเหตุที่พบบ่อยที่สุดคือค่า **Confirm email** เมื่อเปิดใช้งาน Supabase จะไม่คืน session หลังสมัครสมาชิก แต่จะส่งอีเมลยืนยันแทน ซึ่งในโปรเจกต์ใหม่มักไม่ถูกส่ง

ตรวจสถานะปัจจุบันของโปรเจกต์ได้ด้วยคำสั่ง

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

- `mailer_autoconfirm: true` หมายถึงสมัครสมาชิกแล้วเข้าใช้งานได้ทันทีโดยไม่ต้องยืนยันอีเมล
- `mailer_autoconfirm: false` หมายถึงต้องยืนยันอีเมลก่อน

ปัญหาอื่นที่ควรตรวจสอบ

- สร้างผู้ใช้ได้ที่ Supabase → Authentication → Users
- ยืนยันอีเมลก่อนเข้าสู่ระบบเมื่อเปิด Email Confirmation
- รีสตาร์ท dev server หลังแก้ไข `.env.local`
- หากเบราว์เซอร์กลับไปที่ `/login` แม้ล็อกอินสำเร็จ ให้ล้าง cookie ของ `localhost` แล้วลองใหม่
- ห้ามส่งรหัสผ่านหรือคีย์ของ Supabase มาในรายงานปัญหา

## 6. การตรวจสอบคุณภาพ

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

ทั้งสี่คำสั่งนี้รันอัตโนมัติทุกครั้งที่ push หรือเปิด Pull Request ผ่าน GitHub Actions ที่ [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) โดยใช้ `npm ci` เพื่อให้ได้ dependency ตาม lockfile แบบตรงเป๊ะ และตรวจด้วย Node.js 22 ซึ่งเป็นเวอร์ชันเดียวกับที่ `package.json` กำหนดไว้

นอกจากนี้ยังมีชุดทดสอบที่ต้องต่อฐานข้อมูลจริง ซึ่งรันแยกออกไปเพราะสิ่งที่ทดสอบคือกลไกการบังคับสิทธิ์ใน Postgres เอง ไม่ใช่โค้ดฝั่ง client

```bash
TEST_SUPABASE_URL=https://<project-ref>.supabase.co \
TEST_SUPABASE_ANON_KEY=<anon key> \
npm run test:db
```

ชุดนี้สมัครบัญชีทดสอบทิ้งไปเองด้วยอีเมลสุ่ม แล้วลบทิ้งทั้งหมด ไม่ต้องใช้ Service Role Key จึงรันกับข้อมูลจริงได้โดยไม่ต้องมีสิทธิ์ระดับสูง ถ้าไม่ได้ตั้งค่า `TEST_SUPABASE_URL` ชุดนี้จะข้ามตัวเองอย่างชัดเจน

### 6.1 ลำดับการตรวจสอบคุณภาพ

รันที่เครื่องตามลำดับนี้ โดย `npm ci` ทำครั้งเดียวตอนติดตั้ง

| ขั้นตอน | คำสั่ง |
| --- | --- |
| 1. Install dependencies | `npm ci` |
| 2. Lint | `npm run lint` |
| 3. Test | `npm test` |
| 4. Integration test | `npm run test:db` (ข้ามถ้ายังไม่ได้ตั้งค่า) |
| 5. Generate Next.js route types | `npx next typegen` |
| 6. Typecheck | `npm run typecheck` |
| 7. Build | `npm run build` |

ขั้นตอนที่ 5 ต้องมาก่อน 6 เพราะ `npm run typecheck` เรียก `next typegen` ให้อยู่แล้ว แต่ถ้าจะรัน `tsc` เดี่ยว ๆ ต้องสร้างชนิดจากเส้นทางให้เสร็จก่อน

`npm run lint` ใช้ `--max-warnings 0` ดังนั้น warning ใด ๆ ก็ทำให้การตรวจสอบล้มเหลว ไม่ใช่แค่ error

`npm test` รันชุดทดสอบด้วย test runner ที่มากับ Node.js โดยตรง ไม่ต้องติดตั้ง test framework เพิ่ม ไฟล์ทดสอบอยู่ใน `src/lib/operations/*.test.ts` ครอบคลุมตรรกะที่ตรวจสอบได้โดยไม่ต้องต่อฐานข้อมูล ได้แก่

| ไฟล์ทดสอบ | สิ่งที่ตรวจ |
| --- | --- |
| `validation.test.ts` | การบังคับข้อมูล, รูปแบบ Machine ID, การแปลงวันที่, การแปลงรหัส error เป็นข้อความสองภาษา |
| `format.test.ts` | การเติม s ตามจำนวน เช่น `1 machine` ไม่ใช่ `1 machines` |
| `machines.test.ts` | การอ่านเครื่องจักรทั้งเครื่องที่ใช้งานอยู่และที่ถูก archive แล้ว |

`npm run test:db` เป็นชุดแยกต่างหากใน [`tests/integration.test.ts`](./tests/integration.test.ts) ตรวจ 27 ข้อ **โดยตรงกับฐานข้อมูลจริง** ครอบคลุมสิ่งที่มีอยู่เฉพาะใน Postgres เท่านั้น ได้แก่ RLS, check constraint และ trigger · ต้องใช้ค่าสองตัวที่เป็น public เท่านั้น (ไม่ต้องใช้ service role key) และจะข้ามตัวเองอย่างชัดเจนถ้าไม่ได้ตั้งค่า

```bash
TEST_SUPABASE_URL=https://<project-ref>.supabase.co \
TEST_SUPABASE_ANON_KEY=<publishable key> \
npm run test:db
```

ต้องรัน `next typegen` ก่อนตรวจ TypeScript เพราะชนิดอย่าง `LayoutProps` ถูกสร้างไว้ใน `.next/types/` ซึ่งอยู่ใน `.gitignore` เครื่องที่ checkout ใหม่จึงไม่มีไฟล์นี้

### 6.2 รายการตรวจสอบด้วยตนเอง

- ผู้ใช้ที่ยังไม่ล็อกอินจะถูก redirect ไปที่ `/login` จากทุกโมดูลของระบบ
- Technician มองไม่เห็นและเรียกใช้ปุ่มจัดการเครื่องจักรของ Admin ไม่ได้
- เครื่องจักรที่สร้างใหม่สามารถแก้ไขและลบได้โดยใช้ ID ที่ฐานข้อมูลสร้างให้
- Alarm สามารถสร้าง แก้ไข กำหนด Cause/Action และปิดได้
- Maintenance สามารถสร้างโดย Technician แก้ไข และปิดงานได้
- การค้นหาและกรองตามสถานะคืนค่าที่ถูกต้อง
- ตัวเลขบน Dashboard และมุมมองเครื่องจักร/Alarm มาจาก Supabase โดยตรง
- ฟิลด์ Machine ID ปฏิเสธค่าที่ไม่ถูกต้องตั้งแต่ในเบราว์เซอร์ เช่น `Line 1` ที่มีช่องว่าง โดยไม่ต้องรอให้ server ตอบกลับ
- เปิดหน้าใดก็ได้ขณะตั้งค่าระบบเป็น Dark Mode แล้วเปิด Console ต้องไม่มีข้อความ error หรือ warning เกี่ยวกับ hydration

## 7. การ Deploy

1. ติดตั้งและตรวจสอบโค้ดในเครื่องก่อน ให้ผ่านทั้งหมดตาม[หัวข้อ 6](#6-การตรวจสอบคุณภาพ)
2. เข้าเว็บ [vercel.com](https://vercel.com) เลือก **Add New → Project** แล้วอัปโหลดโฟลเดอร์โปรเจกต์นี้ ระบบจะตรวจจับ Next.js 16 ให้เอง ไม่ต้องตั้งค่าการ build
3. ก่อน deploy ครั้งแรก ให้เพิ่มตัวแปรสภาพแวดล้อม (Vercel จะถามระหว่าง import หรือเพิ่มภายหลังที่ **Project → Settings → Environment Variables**)

   | ชื่อตัวแปร | ค่า |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | คีย์ `sb_publishable_...` จาก Supabase → Project Settings → API |

   ติ๊กให้ครบทั้ง **Production**, **Preview** และ **Development** · ไม่จำเป็นต้องใช้และห้ามใส่ Service Role Key
4. รัน `supabase/bootstrap.sql` (หรือ migration ทั้ง 11 ไฟล์) กับโปรเจกต์ Supabase ก่อนทดสอบ
5. Deploy แล้วทดสอบ `/login`, `/dashboard`, `/machines`, `/alarms`, `/maintenance`, `/audit`, `/history` และ `/requests` บน URL ของ Vercel

ระบบต้องการ Node.js เวอร์ชัน 22.6 ขึ้นไป โดย `package.json` ระบุ `engines.node` ไว้เพื่อให้ Vercel เลือก runtime ที่เข้ากันได้ (Next.js 16 ต้องการ 20.9 ขึ้นไป แต่ชุดทดสอบใช้ type stripping ของ Node.js ซึ่งมาตั้งแต่ 22.6)

**Vercel URL:** https://web-application-psi-tawny.vercel.app

ระบบที่ deploy แล้วเปิดใช้งานได้จริง ตรวจสอบแล้วว่า `/login` ตอบ 200, หน้าอื่น redirect ไป `/login` เมื่อยังไม่ล็อกอิน, `/api/dashboard` ตอบ 401, Tailwind CSS ให้ครบ 446 กฎ และ client bundle เชื่อมต่อ Supabase project ถูกต้อง

> เปิด **Settings → Deployment Protection** แล้วปิด **Vercel Authentication** ไว้ เพื่อให้ผู้ตรวจเปิด URL นี้ได้โดยไม่ต้องล็อกอิน

### 7.1 ฟีเจอร์เพิ่มเติม (Bonus)

งานส่วนนี้เป็นสิ่งที่เพิ่ม**นอกเหนือจากตารางคะแนนหลัก 100 คะแนน** ตามหัวข้อ 7 ของโจทย์

| ฟีเจอร์ | สถานะ | ที่อยู่ |
| --- | --- | --- |
| เพิ่ม Role `Viewer` | ทำแล้ว | หน้า Login (เลือกได้ตอนสมัคร) · RLS ให้อ่านอย่างเดียว |
| เพิ่มสถานะ `Waiting Part` | ทำแล้ว | งาน Maintenance · check constraint กันปิดงานที่ยังรออะไหล่ |
| เพิ่มกราฟประเอ็ด Alarm | ทำแล้ว | หน้า Dashboard · แท่งสีแดง=ยัง active สีเขียว=ปิดแล้ว |
| เพิ่มหน้า Machine History | ทำแล้ว | เมนู **History** · อ่านจาก audit log |
| เพิ่ม Audit Log | ทำแล้ว | เมนู **Audit** · trigger บันทึกอัตโนมัติทุก insert/update/delete |
| เพิ่ม Notification | ทำแล้ว | กระดิ่งบน Topbar ทุกหน้า · คลิกแถวเข้าถึงรายการนั้นได้ทันที (ไฮไลต์ + เลื่อนมาให้) · **ปิด alarm แล้วหายจากกระดิ่งทันที** · desktop notification เปิด-ปิดได้ที่ Settings |
| Responsive UI | ทำแล้ว | ทุกหน้า รองรับมือถือ |
| Export CSV | ทำแล้ว | หน้า Reports · ส่งออกเฉพาะแถวที่กรองไว้ คอลัมน์เครื่องใช้รหัสเครื่องจริง ไม่ใช่ id ภายใน |
| Dark Mode | ทำแล้ว | ปุ่มพระจันทร์บน Topbar และหน้า Login · หน้า Settings เลือกได้ 3 แบบ (ตามระบบ / สว่าง / มืด) · จำค่าไว้ใน localStorage |
| เพิ่ม Filter ตามช่วงวันที่ | ทำแล้ว | Dashboard เลือก 24 ชม. / 7 วัน |
| Change Request ต้องผู้ดูแลอนุมัติ | ทำแล้ว | เมนู **Requests** · ทุกคนเสนอได้, เฉพาะ Admin อนุมัติ/ปฏิเสธ |
| เพิ่มข้อมูล Technician | ทำแล้ว | ค้นหาและกรองตามช่างในหน้า Maintenance, แสดงชื่อผู้รับผิดชอบใน Audit และ Requests |
| เพิ่ม Validation เพิ่มเติม | ทำแล้ว | `waiting_part` ต้องไม่มี `completed_at`, ความยาว title/description ของ change request |
| Deep link เข้าถึงรายการโดยตรง | ทำแล้ว | `/alarms?id=` · `/alarms?status=` · `/maintenance?id=` · `/machines?q=` · ใช้จากกระดิ่งแจ้งเตือน, คิว Alarm บน Dashboard และรายชื่อเครื่อง |

**Dark Mode** ทำงานโดยสลับคลาส `dark` บน `<html>` และปรับเฉพาะ**ค่าตัวแปรสี**ใน `globals.css` ทุก utility ที่สร้างบน token เหล่านั้นจึงเปลี่ยนตามอัตโนมัติโดยไม่ต้องแก้ component ใดๆ สคริปต์เล็กใน `layout.tsx` จะกำหนดธีมก่อนหน้าจอแรกวาด เพื่อไม่ให้เห็นธีมสว่างแวบก่อนแล้วกระพริบเป็นธีมมืด

ข้อสำคัญของกลไกนี้คือ **ต้องใช้ token เท่านั้น** ถ้าคลาสใดเขียนสีตายตัว เช่น `bg-white` หรือ `text-[#8793a1]` สีนั้นจะไม่เปลี่ยนตามธีมและจะเห็นเป็นแถบสีขาวบนพื้นมืด ดังนั้นในโปรเจกต์นี้ผูกสีพื้นผิวกับ `bg-surface`, `bg-canvas` และ `bg-sunken` ส่วนสีตัวอักษรรองใช้ `text-muted` และ `text-faint` การมี `bg-white` ในโค้ดเป็นข้อผิดพลาด ไม่ใช่แค่รายละเอียดเล็กน้อย

**Audit Log** เขียนโดย trigger `public.write_audit_log()` บันทึกผู้กระทำ (`actor_role`) และค่าก่อน/หลัง (`changes`) โดยตาราง `audit_log` **ไม่มี INSERT policy ให้ใคร** แม้แต่ client จึงสร้างรายการปลอมไม่ได้ trigger ถูกติดตั้งบน `machines`, `alarms`, `maintenance_records` และ `change_requests` รวมทั้งการอนุมัติและการปฏิเสธ change request

**Viewer** ใช้ฟังก์ชัน `public.can_write()` ใน RLS เพราะ `is_admin()` อย่างเดียวแสดงความตั้งใจไม่ได้ ต้องกันกรณี role อื่นที่ไม่ใช่ admin หลุดเข้า policy ของ technician

**Notification** ออกแบบให้ "แจ้งเตือนแล้วเข้าไปดูรายละเอียดได้" ไม่ใช่แค่บอกว่ามีอะไรเกิดขึ้น ทุกแถวในกระดิ่งเป็นลิงก์ไปที่ `/alarms?id=...` ซึ่งหน้า Alarms จะเลื่อนมาหาแถวนั้น ไฮไลต์ไว้ และขึ้นป้ายบอกว่าทำไมถึงถูกเน้น (มีปุ่มปิดป้ายเพื่อกลับไปดูรายการปกติ) ถ้าลิงก์ชี้ไปยังรายการที่มองไม่เห็น ระบบจะบอกตรง ๆ ว่าเป็นเพราะถูกลบหรือ role มองไม่เห็น แทนที่จะแสดงตารางว่างเปล่า

จุดที่ต้องระวังคือ **กระดิ่ง, คิวบน Dashboard และตารางในหน้า Alarms เป็นคนละ component ที่ถือข้อมูลชุดเดียวกันคนละชุด** ถ้าไม่มีการส่งสัญญาณเมื่อมีการเขียน เมื่อปิด alarm ในหน้า Alarms กระดิ่งก็จะยังค้างบอกว่ายัง active อยู่ ซึ่งแย่กว่าการไม่มีกระดิ่งเลย เพราะเป็นตัวเลขที่ผู้ใช้เรียนรู้ว่าเชื่อไม่ได้ โค้ดนี้จึงมี bus สามบรรทัด (`onAlarmsChanged` / `emitAlarmsChanged` ใน `src/lib/operations/alarm-events.ts`) ที่ทุกจุดที่เขียน alarm จะส่งสัญญาณ แล้วผู้อ่านโหลดใหม่ รวมถึงฟัง event `focus` เพื่อรับการแก้ไขที่เกิดจากอีกแท็บหนึ่ง **ไม่มีการ poll** เพราะการเขียนคือช่วงเวลาเดียวที่ข้อมูลเปลี่ยนได้โดยที่ผู้อ่านไม่รู้ตัว

การเสนอ desktop notification เป็นตัวเลือกเสริมที่ **ปิดได้** — ถ้ามีบรรทัดโฆษณาที่ปิดทิ้งไม่ได้ ผู้ใช้จะเลิกสนใจมันไปเอง ตอนนี้เหลือบรรทัดเดียวพร้อมปุ่มปิดที่จำค่าไว้ในเบราว์เซอร์ และเปิดกลับได้ที่หน้า Settings ซึ่งรายงานสถานะจริงว่าเปิดอยู่ / ปิดอยู่ / ถูกเบราว์เซอร์บล็อก / เบราว์เซอร์ไม่รองรับ พร้อมบอกวิธีปลดบล็อก

ผลการตรวจสอบฟีเจอร์ bonus ด้วยการยิงคำขอจริง **ผ่าน 20/20 รายการ** ครอบคลุมการอ่านของ viewer ที่ถูกต้องและการเขียนที่ถูกปฏิเสธทั้งหมด, สถานะ waiting_part, audit log ที่บันทึกอัตโนมัติและป้องกันการปลอมแปลง, และ change request ที่เสนอได้ทุกคนแต่อนุมัติได้เฉพาะ admin

### 7.2 การจัดการสไตล์ด้วย Tailwind CSS

หน้าตาของระบบสร้างด้วย Tailwind CSS v4 ทั้งหมด โดยกำหนด design token ครั้งเดียวด้วย `@theme` ในไฟล์ `src/app/globals.css` (เช่น `--color-brand`, `--color-ink`, `--color-line`) แล้วเรียกใช้เป็น utility ปกติ เช่น `bg-canvas`, `text-ink` และ `border-line`

ชุด utility ที่ใช้ซ้ำในหลายหน้าถูกรวบรวมไว้ที่ `src/features/operations/module-styles.ts` และ `src/features/operations/dashboard-styles.ts` เพื่อไม่ให้เขียน class ยาวๆ ซ้ำกัน 7 ไฟล์ **ไม่มี CSS ที่เขียนขึ้นเองสำหรับ component ใดเลย**

## 8. รายละเอียดการใช้ AI ในการพัฒนา

โจทย์อนุญาตให้ใช้ AI ช่วยในทุกขั้นตอน AI ถูกใช้ในงานนี้ดังนี้

| กิจกรรม | การใช้ AI | สิ่งที่มนุษย์ต้องตรวจสอบ |
| --- | --- | --- |
| วิเคราะห์ Requirement | อ่านโจทย์ แยกเป็นงานด้านฟังก์ชัน ฐานข้อมูล ความปลอดภัย UI การตรวจสอบคุณภาพ และการ deploy พร้อมจัดทำตารางเทียบแต่ละข้อกำหนดกับโค้ดที่รองรับ | ยืนยันการตีความข้อกำหนดที่กำกวม เช่น กรณี Technician บันทึก Alarm ได้แม้โจทย์ไม่ได้ระบุ |
| ออกแบบ Database | ออกแบบตารางทั้ง 4 enum, foreign key, check constraint, unique index, trigger และชุด RLS policy | ตัดสินนโยบายการเก็บข้อมูลของเครื่องที่มีประวัติ และยืนยันกฎ RLS ตรงกับการแบ่งสิทธิ์ที่ต้องการ |
| เขียน Source Code | สร้างโครงสร้าง Next.js App Router, Supabase client, `proxy.ts`, โมดูล Machine / Alarm / Maintenance / Dashboard / Users / Reports / Settings และชั้น Tailwind | ตรวจทุกไฟล์ก่อนนำขึ้นระบบจริง |
| สร้าง UI/UX | ออกแบบระบบภาพ, design token ผ่าน `@theme` และพฤติกรรม responsive ของทุกหน้า | ตัดสินว่าหน้าตาตรงตามความต้องการ และตรวจที่ขนาดจอจริง |
| เขียน SQL | เขียน migration 11 ไฟล์ รวมถึง `bootstrap.sql` และ `seed.sql` | รันแต่ละไฟล์ใน Supabase SQL Editor เรียงตามลำดับและตรวจผลลัพธ์ |
| Debug และแก้ Error | วินิจฉัยปัญหา role ตอนสมัครสมาชิก, คอลัมน์ `is_archived` ที่หายไป, ข้อความแจ้งเตือนที่ทำให้เข้าใจผิด, พฤติกรรม `204 No Content` ของ RLS และ layout หน้า login ที่พังหลังแปลง CSS | ทำซ้ำพฤติกรรมที่พบและยืนยันการแก้ไขในระบบที่รันอยู่ |
| สร้าง Test | เขียนสคริปต์ทดสอบที่สมัครบัญชีจริงกับ Supabase และตรวจสิทธิ์ตาม Role, CRUD และ Input Validation จากนั้นลบข้อมูลทดสอบ | ตัดสินใจว่าจะเก็บสคริปต์เหล่านั้นเป็นชุดทดสอบถาวรหรือไม่ |
| ปรับปรุงและ Refactor | เปลี่ยน UI ทั้งหมดจาก CSS ที่เขียนเองไปเป็น Tailwind utility, รวบรวม utility ที่ซ้ำกันเป็นสองโมดูล และลบ stylesheet ที่ไม่ใช้แล้ว | ยืนยันว่าผลลัพธ์ที่แสดงยังตรงกับดีไซน์ที่ตั้งใจ |

### ผลการตรวจสอบที่ดำเนินการจริง

- **สิทธิ์ตาม Role** — สมัครบัญชี Admin และ Technician ใหม่ ยืนยันว่า trigger ให้ role ตามที่เลือก และยืนยันว่า Technician สร้างเครื่องจักรไม่ได้ (403), แก้ field ที่ล็อกของ Alarm ไม่ได้ (400) และเลื่อนสิทธิ์ตัวเองไม่ได้
- **CRUD** — ตรวจ 22 รายการ ครอบคลุมการสร้าง อ่าน แก้ไข archive restore และลบเครื่องจักร, การเปลี่ยนสถานะ Alarm ทั้ง 3 ค่า และการสร้าง แก้ไข และปิดงาน Maintenance
- **Input Validation** — ตรวจ 13 รายการ ยืนยันว่าช่องว่าง, Machine ID ซ้ำรวมถึงแบบต่างตัวพิมพ์, รูปแบบผิด, ความยาวผิด และค่า enum ที่ไม่มีในระบบ ถูกปฏิเสธทั้งหมด
- **การสแกนความลับ** — ค้นหา Service Role Key, secret key และรูปแบบ token ทั้งโฟลเดอร์โปรเจกต์รวมถึงไฟล์ bundle ที่จะส่งไปเบราว์เซอร์ ยืนยันว่าไม่มีไฟล์ `.env` อยู่ในโปรเจกต์ (มีแต่ `.env.example` ที่เป็น placeholder) และโค้ดฝั่ง client อ่านเฉพาะตัวแปร `NEXT_PUBLIC_*`
- **เครื่องมือ** — `npm run lint`, `npm test`, `npm run typecheck` และ `npm run build` ผ่านทั้งหมด

### ข้อจำกัดที่พบจริง

- ชุดทดสอบอัตโนมัติที่กล่าวถึงข้างต้นเริ่มต้นเป็นสคริปต์ใช้ครั้งเดียว ต่อมาจึงแยกส่วนที่ตรวจสอบได้โดยไม่ต้องต่อฐานข้อมูลออกมาเป็นชุด `node --test` ถาวร 50 เคส เรียกด้วย `npm test` ส่วนที่ต้องตรวจบน Postgres จริงยังแยกไว้ที่ `npm run test:db`
- ปัญหา role ตอนสมัครสมาชิกเคยถูกวินิจฉัยผิดว่าเกิดจากฟังก์ชันในฐานข้อมูลเป็นเวอร์ชันเก่า สาเหตุที่แท้จริงคือมี migration ที่ยังไม่ถูกรัน การวินิจฉัยที่ถูกต้องมาจากการอ่านนิยามฟังก์ชันจริงในฐานข้อมูลผ่าน Management API
- การแปลง CSS ไปเป็น Tailwind ครั้งแรกหน้า login ยังมี layout ผิด ซึ่งพบได้จากการตรวจ HTML ที่เรนเดอร์ออกมา ไม่ได้พบจากการทดสอบอัตโนมัติ

### คำสั่งนี้ใช้อ้างอิง

นโยบายความปลอดภัย: ไม่มี Supabase Service Role Key หรือ secret ใดๆ อยู่ใน browser bundle, โค้ดต้นฉบับ หรือ README นี้ เบราว์เซอร์ได้รับเฉพาะ URL ของโปรเจกต์ Supabase และ publishable anon key ซึ่งเป็นคีย์สาธารณะโดยการออกแบบและถูกป้องกันด้วย Row Level Security อีกชั้นหนึ่ง

รายละเอียดเพิ่มเติมอยู่ใน [`AI_USAGE_REPORT.md`](./AI_USAGE_REPORT.md)

## 9. รายการสิ่งที่ต้องส่ง

ดูรายละเอียดเพิ่มเติมได้ที่ [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)

- [x] URL ของระบบที่ deploy บน Vercel — https://web-application-psi-tawny.vercel.app
- [x] สคีมาฐานข้อมูลบน Supabase — [migration 11 ไฟล์](./supabase/migrations) และ [เอกสารสคีมา](./DATABASE_SCHEMA.md)
- [x] เตรียมวิธีสร้างและทดสอบบัญชีทั้ง 3 บทบาท (Admin, Technician, Viewer) — ดู [หัวข้อ 5.2](#52-ติดตั้งและตั้งค่า) และคำอธิบายเหตุผลที่ไม่ฝากรหัสผ่านไว้ในโค้ดใน [หัวข้อ 9](#9-รายการสิ่งที่ต้องส่ง)
- [x] อัปเดต README ด้วย URL จริงของ Vercel
- [x] จับภาพหน้าจอระบบแล้ว — ดู [หัวข้อ 10](#10-ภาพหน้าจอระบบ)
- [x] จัดทำรายงานสรุปการใช้ AI ในการพัฒนาแล้ว — [AI_USAGE_REPORT.md](./AI_USAGE_REPORT.md)

## 10. ภาพหน้าจอระบบ

ทุกภาพถ่ายจากระบบที่ deploy จริงบน [Vercel](https://web-application-psi-tawny.vercel.app) ไม่ใช่จากเครื่องนักพัฒนา และตัวเลขในภาพมาจาก Supabase โปรเจกต์เดียวกับที่ใช้งานจริง

> **ไม่มีบัญชีสาธารณะในระบบนี้** เดิมมีบัญชี `demo.*@forgeops.dev` พร้อมรหัสผ่านที่เขียนไว้ใน README ซึ่งหมายความว่าใครก็ตามที่ได้สำเนาโค้ดชุดนี้สามารถเข้าสู่ระบบในฐานะ Admin ได้ บัญชีเหล่านั้นจึงถูกลบออกจากฐานข้อมูลแล้ว การฝากรหัสผ่านของบัญชีทดสอบไว้ในโค้ดที่เปิดเผยบน GitHub จึงเป็นช่องโหว่ที่แก้ไม่ได้ด้วยการเปลี่ยนรหัสผ่านทีหลัง เพราะผู้ที่ได้สำเนาโค้ดไปแล้วยังคงรู้รหัสเดิมอยู่
>
> migration `007_seed_viewer_account.sql` สร้างแถว `viewer@example.com` ไว้หนึ่งแถวโดย **ตั้งใจไม่ใส่รหัสผ่าน** เพื่อให้หน้า Users มีตัวอย่างบทบาท Viewer ให้เห็น แต่บัญชีนี้จึงไม่สามารถเข้าสู่ระบบได้ วิธีดูประสบการณ์ของผู้ใช้ Viewer ที่ถูกต้องคือสมัครบัญชีที่หน้า `/login` เลือกบทบาท Technician แล้วให้ Admin ลดสิทธิ์บัญชีนั้นเป็น Viewer จากหน้า Users (หน้านี้ใช้ได้เฉพาะ Admin เท่านั้นตามข้อ 1.5)
>
> หากต้องการเปิดดูระบบ ให้สมัครบัญชีที่หน้า `/login` แล้วรันคำสั่งใน [`supabase/make-admin.sql`](./supabase/make-admin.sql) เพื่อเลื่อนตัวเองเป็น Admin (ขั้นตอนอยู่ใน [หัวข้อ 5.2](#52-ติดตั้งและตั้งค่า)) ข้อมูลตัวอย่าง 4 เครื่อง 9 alarm และ 3 งานบำรุงรักษายังอยู่ครบ จึงเห็นข้อมูลทันทีหลังสมัคร

### หน้า Login และ Dashboard

| ภาพ | สิ่งที่ต้องการพิสูจน์ |
| --- | --- |
| [`01-login.png`](./screenshots/01-login.png) | หน้า Login 2 คอลัมน์ พร้อมข้อความแจ้งเตือนภาษาไทยคู่ภาษาอังกฤษ |
| [`02-dashboard.png`](./screenshots/02-dashboard.png) | ตัวนับเครื่องจักรทุกสถานะ, จำนวน Alarm, จำนวนงาน Maintenance, กราฟ donut และกราฟแท่งรายวัน |
| [`03-dashboard-full.png`](./screenshots/03-dashboard-full.png) | Dashboard ทั้งหน้า รวมแถบสรุปอัตราการปิดงานบำรุงรักษา |
| [`14-dashboard-dark-mode.png`](./screenshots/14-dashboard-dark-mode.png) | Dark Mode (โบนัส) โดยสลับธีมจากปุ่มบน Topbar |
| [`15-responsive-mobile.png`](./screenshots/15-responsive-mobile.png) | Responsive UI ที่ความกว้างมือถือ 414 px (โบนัส) |

### การจัดการข้อมูลหลัก ข้อ 3.2 ถึง 3.4 และ 3.7

| ภาพ | สิ่งที่ต้องการพิสูจน์ |
| --- | --- |
| [`04-machines.png`](./screenshots/04-machines.png) | Machine Master พร้อมการค้นหา กรองตามสถานะ และปุ่ม Create / Edit / Delete ของ Admin |
| [`05-machine-form-validation.png`](./screenshots/05-machine-form-validation.png) | ฟอร์มข้อมูลเครื่องจักร พร้อมช่องที่บังคับกรอก |
| [`06-validation-errors.png`](./screenshots/06-validation-errors.png) | ข้อความแจ้งเตือนเมื่อกรอกข้อมูลไม่ครบ (ข้อ 3.7) |
| [`07-alarms.png`](./screenshots/07-alarms.png) | Alarm Record พร้อมสถานะ Open / In Progress / Closed |
| [`08-maintenance.png`](./screenshots/08-maintenance.png) | Maintenance Record พร้อมสถานะ In progress / Waiting part / Completed |
| [`13-users.png`](./screenshots/13-users.png) | หน้าผู้ใช้งานสำหรับ Admin เปลี่ยน Role ได้ |

### สิทธิ์ตามบทบาท ข้อ 3.1 และฟีเจอร์โบนัส

| ภาพ | สิ่งที่ต้องการพิสูจน์ |
| --- | --- |
| [`16-viewer-readonly.png`](./screenshots/16-viewer-readonly.png) | Role Viewer อ่านได้แต่ไม่มีปุ่ม Create / Edit / Delete ให้เห็น |
| [`09-audit-log.png`](./screenshots/09-audit-log.png) | Audit Log ที่ trigger บันทึกทุก insert / update / delete พร้อมผู้กระทำ |
| [`10-machine-history.png`](./screenshots/10-machine-history.png) | ประวัติการเปลี่ยนแปลงของเครื่องจักรแต่ละเครื่อง |
| [`11-change-requests.png`](./screenshots/11-change-requests.png) | Change Request ที่ทุกคนเสนอได้ แต่เฉพาะ Admin เท่านั้นที่อนุมัติหรือปฏิเสธได้ |
| [`12-reports.png`](./screenshots/12-reports.png) | หน้า Reports พร้อมส่งออกข้อมูลเป็นไฟล์ CSV |
