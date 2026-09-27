/**
 * The machine id rule, as a pattern source string rather than a RegExp.
 *
 * It has to be a string because the same text is handed to the browser as an
 * HTML `pattern` attribute, and the hyphen is escaped on purpose: browsers
 * compile that attribute with the RegExp `v` flag, where a bare "-" inside a
 * character class is a syntax error. Chrome does not report the error, it
 * silently drops the constraint, so the field would accept anything at all.
 * Keeping one source means the attribute and the JavaScript cannot drift.
 */
export const MACHINE_ID_PATTERN_SOURCE = "[A-Za-z0-9][A-Za-z0-9._\\-]{1,31}";

export const MACHINE_ID_PATTERN = new RegExp(`^${MACHINE_ID_PATTERN_SOURCE}$`);

/**
 * Validation messages are Thai first, then English.
 *
 * The forms set noValidate, so these are the messages the user actually sees
 * rather than the browser's built-in tooltip, which is English only. Keeping
 * both languages means the message is readable for whoever submitted the form.
 */
const msg = (thai: string, english: string) => `${thai} / ${english}`;

export { msg };

export function requiredText(value: FormDataEntryValue | null, label: string, maxLength = 255): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(msg(`กรอก ${label}`, `${label} is required.`));
  if (text.length > maxLength) throw new Error(msg(`${label} ต้องไม่เกิน ${maxLength} ตัวอักษร`, `${label} must be ${maxLength} characters or fewer.`));
  return text;
}

export function optionalText(value: FormDataEntryValue | null, maxLength = 2000): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maxLength) throw new Error(msg(`ช่องนี้ต้องไม่เกิน ${maxLength} ตัวอักษร`, `This field must be ${maxLength} characters or fewer.`));
  return text;
}

export function requiredDate(value: FormDataEntryValue | null, label: string): string {
  const text = String(value ?? "").trim();
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) {
    throw new Error(msg(`กรอก ${label} เป็นวันและเวลาที่ถูกต้อง`, `${label} is required and must be a valid date/time.`));
  }
  return date.toISOString();
}

export function machineId(value: FormDataEntryValue | null): string {
  const text = requiredText(value, "Machine ID", 32);
  if (!MACHINE_ID_PATTERN.test(text)) {
    throw new Error(msg(
      "Machine ID ต้องยาว 2-32 ตัวอักษร และใช้ได้เฉพาะ ตัวอักษร ตัวเลข จุด ขีดกลาง และขีดล่าง",
      "Machine ID must be 2-32 characters and use only letters, numbers, dot, underscore or hyphen.",
    ));
  }
  return text.toUpperCase();
}

export function isOneOf<T extends string>(value: string, values: readonly T[]): value is T {
  return values.includes(value as T);
}

export function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** The record a failed write was about, which decides how the error reads. */
export type WriteContext = "machine" | "alarm" | "maintenance";

function errorDetail(error: unknown): { code?: string; message?: string } {
  return error && typeof error === "object" ? (error as { code?: string; message?: string }) : {};
}

/**
 * Turns a Supabase/PostgREST failure into a sentence the user can act on.
 *
 * Without this the raw driver text reaches the screen, for example
 * `null value in column "cause" violates not-null constraint`, which tells the
 * user nothing about what to change. Every console routes its write errors
 * through here so the wording is consistent across the system.
 */
export function describeWriteError(error: unknown, context: WriteContext, action: "save" | "delete" = "save"): string {
  const { code, message } = errorDetail(error);

  // A missing migration, rather than anything the user did.
  if (code === "42703" || (code === "42P01" && /is_archived|audit_log|change_requests/i.test(message ?? ""))) {
    return msg(
      "ฐานข้อมูลยังไม่ได้อัปเดต กรุณารันไฟล์ในโฟลเดอร์ supabase/migrations ตามลำดับใน Supabase SQL Editor แล้วโหลดหน้าใหม่",
      "The database is missing an update. Run the files in supabase/migrations in order in the Supabase SQL editor, then reload.",
    );
  }

  switch (code) {
    case "23505":
      return context === "machine"
        ? msg("Machine ID นี้ถูกใช้ไปแล้ว กรุณาใช้รหัสอื่น", "Machine ID already exists. Use a different ID.")
        : msg("มีรายการนี้อยู่แล้ว", "That record already exists.");
    case "23514":
      if (context === "alarm") {
        return msg(
          "ฐานข้อมูลปฏิเสธค่าเหล่านี้ การปิด Alarm ต้องระบุทั้งสาเหตุและการดำเนินการ",
          "The database rejected these values. A closed alarm needs both a cause and the action taken.",
        );
      }
      if (context === "maintenance") {
        return msg(
          "ฐานข้อมูลปฏิเสธค่าเหล่านี้ ตรวจสอบสถานะ ช่องข้อความทั้งสองช่อง เวลาปิดงานต้องไม่ก่อนเวลาเริ่ม และงานที่รออะไหล่ต้องไม่มีเวลาปิด",
          "The database rejected these values. Check that the status is valid, that both text fields are filled in, that the completion time is not before the start time, and that a job waiting for a part has not been given a completion time.",
        );
      }
      return msg(
        "มีค่าบางช่องไม่ผ่านการตรวจสอบของฐานข้อมูล กรุณาตรวจทานแล้วลองใหม่",
        "One of the fields failed a database validation check. Review the values and try again.",
      );
    case "42501":
      return context === "machine"
        ? msg("Role ของคุณไม่อนุญาตให้เปลี่ยนแปลงนี้ เฉพาะ Admin เท่านั้นที่จัดการเครื่องจักรได้", "Your role does not allow this change. Only Admin can manage machines.")
        : msg("Role ของคุณไม่อนุญาตให้เปลี่ยนแปลงนี้", "Your role does not allow this change.");
    case "23503":
      if (action !== "delete") {
        return msg("รายการนี้ยังถูกอ้างอิงโดยข้อมูลอื่นอยู่ จึงเปลี่ยนแปลงด้วยวิธีนี้ไม่ได้", "This record is still referenced by other data and cannot be changed this way.");
      }
      return context === "machine"
        ? msg(
            "เครื่องจักรนี้ถูก Alarm หรือ Maintenance อ้างอิงอยู่ จึงลบไม่ได้ กรุณาใช้ Archive แทน เครื่องจักรจะหายจากรายการหลักแต่ประวัติยังอยู่ครบ",
            "This machine is referenced by an alarm or maintenance record, so it cannot be deleted. Use Archive instead: the machine disappears from the active list while its history stays intact.",
          )
        : msg("รายการนี้ยังถูกอ้างอิงโดยข้อมูลอื่นอยู่ จึงลบไม่ได้", "This record is still referenced by other data, so it cannot be deleted.");
    default:
      break;
  }

  const text = message ?? "";
  if (/violates not-null constraint/i.test(text)) {
    return msg("มีช่องที่ต้องกรอกว่างอยู่ กรุณากรอกให้ครบทุกช่องแล้วลองใหม่", "A required field was empty. Fill in every required field and try again.");
  }
  if (/violates foreign key constraint/i.test(text)) {
    return msg("รายการที่อ้างอิงไม่มีอยู่แล้ว กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง", "A record this one points at no longer exists. Reload the page and try again.");
  }
  if (/duplicate key value/i.test(text)) return msg("มีรายการนี้อยู่แล้ว", "That record already exists.");
  if (/only update alarm workflow fields/i.test(text)) {
    return msg(
      "ช่างเทคนิคเปลี่ยนได้เฉพาะสาเหตุ การดำเนินการ และสถานะ หากต้องการแก้ฟิลด์อื่นกรุณาติดต่อ Admin",
      "Technicians may only change the cause, the action taken and the status. Ask an Admin to change the rest.",
    );
  }
  if (/cannot change maintenance ownership/i.test(text)) {
    return msg("เฉพาะ Admin เท่านั้นที่ย้ายงานบำรุงรักษาไปยังช่างหรือเครื่องอื่นได้", "Only an Admin can move a maintenance job to a different technician or machine.");
  }

  return text ? String(text) : msg("ไม่สามารถบันทึกการเปลี่ยนแปลงได้ กรุณาลองใหม่", "The change could not be saved. Try again.");
}
