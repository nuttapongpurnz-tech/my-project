"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

const STORAGE_KEY = "forgeops-theme";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Match system", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * The choice on its own is not enough to draw anything, because "system" has to
 * be resolved against the operating system before it means light or dark. Both
 * facts live in the browser, so they are read as one external store and joined
 * into a single string, which keeps the snapshot comparable by value.
 */
type ThemeSnapshot = `${ThemeChoice}:${"light" | "dark"}`;

const SERVER_SNAPSHOT: ThemeSnapshot = "system:light";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function readSnapshot(): ThemeSnapshot {
  let choice: ThemeChoice = "system";
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") choice = value;
  } catch {
    // Private browsing can refuse localStorage; the default still works.
  }
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return `${choice}:${dark ? "dark" : "light"}`;
}

/**
 * The store moves when the choice is changed in this tab, when another tab
 * changes it, and when the operating system flips while the choice is
 * "system".
 */
function subscribe(listener: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  listeners.add(listener);
  query.addEventListener("change", listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Applies the resolved theme to <html>.
 *
 * Only the `dark` class changes, and every colour in the interface resolves
 * through a CSS variable, so a re-theme needs no re-render and no component
 * knows which theme is active. The inline script in layout.tsx does the same
 * thing before first paint, which is what stops a flash of the wrong theme.
 */
function apply(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

const ThemeContext = createContext<{ theme: ThemeChoice; resolved: "light" | "dark"; setTheme: (choice: ThemeChoice) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The server can read neither the stored choice nor the operating system
  // preference, so it is given a snapshot it could plausibly have drawn.
  // useSyncExternalStore then hydrates against that snapshot and re-renders
  // with the real one, which is what keeps a dark-mode visitor from getting a
  // hydration mismatch on the theme control.
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => SERVER_SNAPSHOT);
  const [choice, resolved] = snapshot.split(":") as [ThemeChoice, "light" | "dark"];

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse localStorage; the toggle still works for
      // this page view.
    }
    apply(next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
    notify();
  }, []);

  useEffect(() => {
    apply(resolved);
  }, [resolved]);

  const value = useMemo(() => ({ theme: choice, resolved, setTheme }), [choice, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider.");
  return context;
}

/** The button in a header, which is a plain two-way toggle rather than a picker. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === "dark";

  const toggle = useCallback(() => {
    setTheme(dark ? "light" : "dark");
  }, [dark, setTheme]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={className || "grid h-8 w-8 place-items-center rounded-[7px] border-0 bg-transparent text-muted transition hover:bg-brand-soft hover:text-ink"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
