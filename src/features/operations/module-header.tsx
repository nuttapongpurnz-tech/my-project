"use client";

import Link from "next/link";
import { Activity, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/operations/types";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { useActiveAlarms } from "./use-active-alarms";
import {
  brandCaption,
  brandMark,
  brandName,
  button,
  buttonSecondary,
  buttonSmall,
  nav,
  navLink,
  rolePill,
  rolePillTone,
  topbar,
  topbarActions,
} from "./module-styles";

export function ModuleHeader({ role }: { role?: AppRole | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const active = useActiveAlarms();

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className={topbar}>
      <Link className="flex items-center gap-2 whitespace-nowrap text-ink no-underline" href="/dashboard" aria-label="Go to dashboard">
        <span className={brandMark}><Activity size={17} /></span>
        <span><strong className={brandName}>FORGE<span>OPS</span></strong><small className={brandCaption}>Factory command center</small></span>
      </Link>
      <nav className={nav} aria-label="Module navigation">
        <Link className={navLink} href="/dashboard">Overview</Link>
        <Link className={navLink} href="/machines">Machines</Link>
        <Link className={navLink} href="/alarms">Alarms</Link>
        <Link className={navLink} href="/maintenance">Maintenance</Link>
        <Link className={`${navLink} max-[760px]:hidden`} href="/audit">Audit</Link>
        <Link className={`${navLink} max-[760px]:hidden`} href="/requests">Requests</Link>
      </nav>
      <div className={topbarActions}>
        {/* The bell is here as well as on the dashboard, so an active alarm is
            visible from any module. It fetches its own short list of open alarms
            rather than the dashboard's full dataset. */}
        <NotificationBell alarms={active.alarms} machineName={active.machineName} />
        <ThemeToggle />
        {role && <span className={`${rolePill} ${rolePillTone[role] ?? ""}`}>{role}</span>}
        <button className={`${button} ${buttonSecondary} ${buttonSmall}`} type="button" onClick={() => void signOut()} disabled={signingOut}>
          <LogOut size={14} />{signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </header>
  );
}
