"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ModuleHeader } from "@/features/operations/module-header";
import {
  eyebrow,
  eyebrowAccent,
  heading,
  headingCopy,
  headingLead,
  headingTitle,
  moduleEmpty,
  moduleError,
  moduleFootnote,
  rowStrong,
  select,
  shell,
  tableCard,
  tableHead,
  tableRow,
} from "@/features/operations/module-styles";
import { APP_ROLE_LABELS, APP_ROLES, type AppRole } from "@/lib/operations/types";

type Profile = { id: string; display_name: string; role: AppRole | string };

export default function UsersPage() {
  const { user, role, loading: userLoading } = useCurrentUser();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) {
        if (active) setLoading(false);
        return;
      }
      if (role !== "admin") {
        if (active) { setError("Only Admin can view user management."); setLoading(false); }
        return;
      }
      try {
        const result = await createClient().from("profiles").select("id, display_name, role").order("display_name");
        if (result.error) throw result.error;
        if (active) setProfiles((result.data ?? []) as Profile[]);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [role, user]);

  async function updateRole(profile: Profile, nextRole: AppRole) {
    setError("");
    try {
      const result = await createClient().from("profiles").update({ role: nextRole }).eq("id", profile.id).select("id, display_name, role").single();
      if (result.error) throw result.error;
      setProfiles((current) => current.map((item) => item.id === profile.id ? result.data as Profile : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update role.");
    }
  }

  return (
    <main className={shell}>
      <ModuleHeader role={role} />
      <div className={heading}><div className={headingCopy}><p className={`${eyebrow} ${eyebrowAccent}`}>CONTROL / USERS</p><h1 className={headingTitle}>User management</h1><p className={headingLead}>Review profiles and assign Admin or Technician access.</p></div></div>
      {error && <div className={moduleError} role="alert">{error}</div>}
      {userLoading || loading ? <div className={moduleEmpty}>Loading users...</div> : role !== "admin" ? <div className={moduleEmpty}><ShieldCheck size={20} />You do not have permission to manage users.</div> : <div className={tableCard}><div className={tableHead}><span>Name</span><span>User ID</span><span>Role</span><span>Access</span></div>{profiles.map((profile) => <div className={tableRow} key={profile.id}><strong className={rowStrong}>{profile.display_name}</strong><span className="truncate text-[10px] text-[color:var(--color-faint)]">{profile.id}</span><select className={select} value={profile.role} onChange={(event) => void updateRole(profile, event.target.value as AppRole)} aria-label={`Role for ${profile.display_name}`}>{APP_ROLES.map((role) => <option value={role} key={role}>{APP_ROLE_LABELS[role]}</option>)}</select><span className="text-[10px] text-[color:var(--color-faint)]">Protected by RLS</span></div>)}{profiles.length === 0 && <div className={moduleEmpty}>No profiles found.</div>}</div>}
      <p className={moduleFootnote}>Role changes are protected by Supabase Row Level Security. Never expose a Service Role Key in the browser.</p>
    </main>
  );
}
