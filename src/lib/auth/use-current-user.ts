"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/operations/types";

/**
 * Roles that may change data. A `viewer` is read-only, so every write control
 * must be hidden for that role. Row Level Security is still the real boundary;
 * this only keeps the interface honest.
 */
export function canWrite(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "technician";
}

type CurrentUserState = {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  error: string;
};

export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ user: null, role: null, loading: true, error: "" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          if (active) setState({ user: null, role: null, loading: false, error: "" });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (active) setState({ user, role: (profile?.role as AppRole | undefined) ?? null, loading: false, error: "" });
      } catch (error) {
        if (active) setState({ user: null, role: null, loading: false, error: error instanceof Error ? error.message : "Unable to load the current user." });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
