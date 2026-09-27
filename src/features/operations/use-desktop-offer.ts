"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The browser's notification permission, and whether the reader has stopped
 * being offered desktop alerts.
 *
 * Both are external state, not React state: one lives in the browser, the other
 * in localStorage. Reading them with useSyncExternalStore rather than an effect
 * is what makes them correct. An effect that copies a browser value into state
 * cannot be trusted on the server, has to be re-run to stay in step, and
 * duplicates a value the browser will happily keep for us. The store is also
 * what makes the dismissal survive a reload and update in every open tab.
 *
 * The two halves of the feature share this module so the key name and the
 * behaviour cannot drift apart between the bell and the Settings page.
 */

const KEY = "forgeops-desktop-offer-dismissed";
/** Same-tab writes raise no storage event, so this stands in for one. */
const LOCAL_CHANGE = "forgeops:desktop-offer";

export const OFFER_DISMISSED = KEY;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    // Some private browsing modes throw on any storage access. Treating the
    // offer as still standing is the safe answer: the reader sees the one-line
    // offer rather than losing the ability to turn alerts on from the bell.
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_CHANGE, onChange);
  };
}

/** True once the reader has refused the offer. False on the server render. */
export function useDesktopOfferDismissed(): boolean {
  return useSyncExternalStore(subscribe, readDismissed, () => false);
}

/** Refuses the offer for good. The reader can restore it from Settings. */
export function dismissDesktopOffer(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch { /* nothing to store, the offer simply returns next time */ }
  window.dispatchEvent(new Event(LOCAL_CHANGE));
}

/** Puts the offer back, so refusing it in the bell is not a one-way door. */
export function restoreDesktopOffer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing to clear */ }
  window.dispatchEvent(new Event(LOCAL_CHANGE));
}

/**
 * The current permission, or "unsupported" where the browser has no Notification
 * API.
 *
 * "default" is the server snapshot, which is what React uses for the first
 * client render during hydration; the real value arrives immediately after,
 * without a mismatch warning.
 *
 * The subscribe function is a no-op because the browser fires no event when the
 * permission changes: a page can only change it by asking, and every caller here
 * asks from a click, which re-renders anyway. This reads the current value
 * rather than tracking it.
 */
function subscribeToNothing(): () => void {
  return () => {};
}

export function useDesktopPermission(): NotificationPermission | "unsupported" {
  const getSnapshot = useCallback(
    () => ("Notification" in window ? Notification.permission : "unsupported"),
    [],
  );
  return useSyncExternalStore(subscribeToNothing, getSnapshot, () => "default");
}
