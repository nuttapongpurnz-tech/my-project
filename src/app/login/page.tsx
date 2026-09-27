"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, LoaderCircle, ShieldCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { ThemeToggle } from "@/features/operations/theme-toggle";
import type { AppRole } from "@/lib/operations/types";

type AuthMode = "login" | "signup";

type AuthMessage = { th: string; en: string };

const EMAIL_FORMAT_MESSAGE: AuthMessage = {
  th: "Supabase ไม่ยอมรับรูปแบบอีเมลนี้ — พิมพ์ใหม่โดยไม่มีช่องว่าง และตรวจให้เป็นรูปแบบ name@example.com",
  en: "Supabase rejected this email address format. Retype it without spaces and check that it looks like name@example.com.",
};

const CONFIRM_EMAIL_HINT: AuthMessage = {
  th: "ให้ไป Supabase Dashboard → Authentication → Sign In / Providers → Email แล้วปิด \"Confirm email\" จะสมัครและเข้าใช้งานได้ทันที",
  en: "Turn off \"Confirm email\" in Supabase Dashboard → Authentication → Sign In / Providers → Email to sign up and sign in immediately.",
};

function withHint(base: AuthMessage, hint: AuthMessage): AuthMessage {
  return { th: `${base.th} — ${hint.th}`, en: `${base.en} ${hint.en}` };
}

function authErrorMessage(error: unknown): AuthMessage {
  const detail = (error && typeof error === "object" ? error : {}) as {
    code?: string;
    status?: number;
    message?: string;
  };
  const code = detail.code ?? "";
  const status = detail.status ?? 0;
  const mentionsEmail = (detail.message ?? "").toLowerCase().includes("email");

  switch (code) {
    case "over_email_send_rate_limit":
      return withHint(
        {
          th: "Supabase ส่งอีเมลเกินโควตาของโปรเจกต์ (429) จึงสมัครสมาชิกไม่ได้",
          en: "Supabase has hit this project's email send limit (429), so sign-up is blocked.",
        },
        CONFIRM_EMAIL_HINT,
      );
    case "over_request_rate_limit":
    case "over_confirmation_rate_limit":
      return {
        th: "ส่งคำขอถี่เกินไป — กรุณารอประมาณ 1 นาทีแล้วลองใหม่",
        en: "Too many requests. Please wait about a minute and try again.",
      };
    case "email_address_invalid":
    case "email_address_not_valid":
      return EMAIL_FORMAT_MESSAGE;
    case "validation_failed":
      return mentionsEmail
        ? EMAIL_FORMAT_MESSAGE
        : {
            th: "ข้อมูลที่กรอกไม่ผ่านการตรวจสอบของ Supabase — กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง",
            en: "Supabase rejected the submitted details. Please check your email and password again.",
          };
    case "email_exists":
    case "user_already_exists":
      return {
        th: "อีเมลนี้ถูกใช้สมัครไว้แล้ว — กรุณาลองเข้าสู่ระบบ หรือสมัครด้วยอีเมลอื่น",
        en: "This email is already registered. Try signing in instead, or sign up with another email.",
      };
    case "email_not_confirmed":
      return withHint(
        {
          th: "อีเมลนี้ยังไม่ได้ยืนยัน — ให้กดลิงก์ยืนยันในอีเมลที่ส่งมา หรือ",
          en: "This email is not confirmed yet. Open the confirmation link that was sent, or",
        },
        CONFIRM_EMAIL_HINT,
      );
    case "invalid_credentials":
      return withHint(
        {
          th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง — หากเพิ่งสมัครแล้วยังเข้าไม่ได้ แปลว่าอีเมลยังไม่ได้ยืนยัน",
          en: "Incorrect email or password. If you just signed up and cannot get in, the address is most likely still unconfirmed.",
        },
        CONFIRM_EMAIL_HINT,
      );
    case "weak_password":
      return {
        th: "รหัสผ่านอ่อนแอเกินไป — กรุณาใช้อย่างน้อย 6 ตัวอักษร",
        en: "Password is too weak. Please use at least 6 characters.",
      };
    case "signup_disabled":
      return {
        th: "การสมัครสมาชิกถูกปิดใช้งานอยู่ — กรุณาให้ผู้ดูแลระบบเปิด Sign up",
        en: "Sign-up is currently disabled in Supabase. Ask an administrator to enable it.",
      };
    case "session_not_verified":
      return {
        th: "เข้าสู่ระบบแล้วแต่ยืนยัน session ไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง",
        en: "Signed in, but Supabase did not return a valid session. Please try again.",
      };
    default:
      break;
  }

  if (status === 429) {
    return {
      th: "ระบบตอบกลับว่าส่งคำขอถี่เกินไป (429) — กรุณารอสักครู่แล้วลองใหม่",
      en: "The server reported too many requests (429). Please wait a moment and try again.",
    };
  }
  if (status >= 500) {
    return {
      th: `Supabase มีปัญหาชั่วคราว (${status}) — กรุณาลองใหม่อีกครั้ง`,
      en: `Supabase is temporarily unavailable (${status}). Please try again.`,
    };
  }
  if (status === 0) {
    return {
      th: "เชื่อมต่อ Supabase ไม่สำเร็จ — กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
      en: "Could not reach Supabase. Check your internet connection and try again.",
    };
  }

  return {
    th: "เข้าสู่ระบบไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง",
    en: "Sign-in failed. Please try again.",
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [selectedRole, setSelectedRole] = useState<AppRole>("technician");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<AuthMessage | null>(null);
  const [notice, setNotice] = useState<AuthMessage | null>(null);
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && displayName.trim().length < 2) {
      setError({ th: "กรุณากรอกชื่อ-นามสกุลของคุณ", en: "Please enter your name." });
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError({ th: "รหัสผ่านทั้งสองช่องไม่ตรงกัน", en: "Passwords do not match." });
      return;
    }

    const normalizedEmail = email.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
      setError({ th: "กรุณากรอกอีเมลให้ถูกต้อง เช่น name@gmail.com", en: "Please enter a valid email address, for example name@gmail.com." });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { display_name: displayName.trim(), role: selectedRole } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice({
            th: "สมัครสมาชิกแล้ว แต่ระบบยังไม่ให้เข้าสู่ระบบเพราะต้องยืนยันอีเมลก่อน — กรุณากดลิงก์ยืนยันในอีเมลที่ได้รับ หรือปิด \"Confirm email\" ใน Supabase Dashboard → Authentication → Sign In / Providers → Email แล้วสมัครใหม่",
            en: "Account created, but sign-in still requires email confirmation. Open the confirmation link in your inbox, or turn off \"Confirm email\" in Supabase Dashboard → Authentication → Sign In / Providers → Email and sign up again.",
          });
          return;
        }
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInError) throw signInError;
      if (!signInData.session) throw { code: "session_not_verified" };

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw { code: "session_not_verified" };

      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch (submitError) {
      setError(authErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  const fieldClass =
    "w-full rounded-[7px] border border-line bg-surface px-3 py-[11px] text-xs text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3px_#3478f615]";

  const labelClass = "grid gap-2 text-[11px] font-bold text-muted";

  return (
    <main className="grid min-h-screen grid-cols-[1.05fr_.95fr] bg-surface max-[760px]:grid-cols-1">
      {/*
        The brand panel keeps its own fixed navy palette in both themes, so the
        hex values below are deliberate and are not theme tokens. It has to stay
        dark: swapping it for bg-surface would turn the panel white in light mode
        and lose the two-column contrast the login page is built around.
      */}
      <section className="relative flex flex-col overflow-hidden bg-[#102d4d] px-[8vw] py-[46px] text-white max-[760px]:min-h-[310px] max-[760px]:px-6 max-[760px]:py-7 after:absolute after:right-[-210px] after:bottom-[-150px] after:h-[480px] after:w-[480px] after:rounded-full after:border after:border-white/12 after:shadow-[0_0_0_80px_#ffffff08,0_0_0_160px_#ffffff05]">
        <div className="flex items-center gap-2.5 text-sm tracking-[1.8px]"><span className="grid h-[31px] w-[31px] place-items-center rounded-[9px] bg-brand text-white shadow-[0_5px_12px_#3478f633]"><Activity size={19} /></span><strong>FORGE<span className="text-[#65a0ff]">OPS</span></strong></div>
        <div className="relative z-1 my-auto max-[760px]:mt-[42px] max-[760px]:mb-5">
          <p className="mb-[3px] text-[9px] font-bold tracking-[1.4px] text-brand">PLANT 01 · OPERATIONS CONTROL</p>
          <h1 className="my-[19px] text-[clamp(38px,4vw,62px)] leading-[1.05] tracking-[-2px]">Keep every line<br /><em className="text-[#78aaff] not-italic">in motion.</em></h1>
          <p className="max-w-[360px] text-[13px] leading-[1.7] text-[#b9cbe0]">One workspace for machine health, alarms and the work that keeps production moving.</p>
        </div>
        <div className="relative z-1 flex items-center gap-2 text-[10px] text-[#abc2db] max-[760px]:hidden"><ShieldCheck size={17} /><span>Role-based access · Secured by Supabase</span></div>
      </section>
      <section className="relative flex flex-col items-center justify-center p-[34px] max-[760px]:min-h-[calc(100vh-310px)] max-[760px]:px-6 max-[760px]:pb-[60px]">
        {/* The theme is chosen before signing in, so the toggle belongs here as
            well as in the app header. */}
        <div className="absolute top-[18px] right-[18px]">
          <ThemeToggle className="grid h-9 w-9 place-items-center rounded-[9px] border border-line bg-surface text-muted transition hover:bg-brand-soft hover:text-ink" />
        </div>
        <div className="w-[min(100%,360px)]">
          <p className="mb-[3px] text-[9px] font-bold tracking-[1px] text-[color:var(--color-faint)]">{isSignup ? "CREATE ACCOUNT" : "WELCOME BACK"}</p>
          <h2 className="my-2 text-[26px]">{isSignup ? "Create your account" : "Sign in to ForgeOps"}</h2>
          <p className="mb-8 text-xs text-muted">{isSignup ? "Choose the role for this workspace account." : "Enter your workspace credentials to continue."}</p>
          <form onSubmit={handleSubmit} className="grid gap-[18px]">
            {isSignup && <label className={labelClass}>Full name<input className={fieldClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" autoComplete="name" minLength={2} maxLength={120} required /></label>}
            {isSignup && <label className={labelClass}>Role <span className="text-ink/40">/ Role</span><select className={fieldClass} value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as AppRole)}><option value="technician">Technician</option><option value="admin">Admin</option><option value="viewer">Viewer (read-only)</option></select></label>}
            <label className={labelClass}>Email address<input className={fieldClass} type="email" inputMode="email" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
            <label className={labelClass}>Password<input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete={isSignup ? "new-password" : "current-password"} minLength={6} required /></label>
            {isSignup && selectedRole === "admin" && <p className="mt-[14px] text-[10px] text-muted">Admin accounts can manage all system records. Use this role only for authorized administrators.</p>}
            {isSignup && <label className={labelClass}>Confirm password<input className={fieldClass} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" minLength={6} required /></label>}
            {error && <div role="alert" className="-my-[3px] rounded-[5px] bg-danger-soft p-2 text-[10px] text-danger"><p>{error.th}</p><p className="mt-1 text-[9px] leading-[1.5] opacity-70">{error.en}</p></div>}
            {notice && <div role="status" className="-my-[3px] text-[11px] leading-[1.5] text-[color:var(--color-on-success-soft)]"><p>{notice.th}</p><p className="mt-1 text-[9px] leading-[1.5] opacity-70">{notice.en}</p></div>}
            <button className="mt-[5px] flex w-full items-center justify-center gap-[7px] rounded-[7px] border border-brand bg-brand px-3 py-3 text-[11px] font-bold text-white shadow-[0_4px_10px_#3478f633] disabled:cursor-wait disabled:opacity-70" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : isSignup ? <UserPlus size={16} /> : <ArrowRight size={16} />}
              {loading ? "Please wait..." : isSignup ? "Sign up" : "Sign in"}
            </button>
          </form>
          <button className="mt-4 w-full border-0 bg-transparent text-[11px] font-bold text-brand hover:underline" type="button" onClick={() => changeMode(isSignup ? "login" : "signup")}>
            {isSignup ? "Already have an account? Sign in" : "Sign up / สมัครสมาชิก"}
          </button>
          <p className="mt-[22px] text-center text-[10px] text-faint">Access is managed by your system administrator.</p>
        </div>
        <span className="absolute bottom-[30px] text-[8px] tracking-[1.1px] text-faint max-[760px]:bottom-5">FORGEOPS · ALARM &amp; MAINTENANCE MANAGEMENT</span>
      </section>
    </main>
  );
}
