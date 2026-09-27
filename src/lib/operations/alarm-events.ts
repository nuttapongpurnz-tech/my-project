"use client";

/**
 * A one-line bus so a write in one place invalidates the alarm list everywhere
 * else.
 *
 * The notification bell and the dashboard queue are separate components with
 * separate copies of the alarm list. Without a signal, closing an alarm on the
 * Alarms page leaves it sitting in the bell on that same page, because the bell
 * fetched its own copy once and had no reason to fetch again. The symptom is
 * worse than a stale number: the bell says an alarm is still open after you have
 * closed it, so it cannot be trusted.
 *
 * There is no polling here on purpose. A write is the only moment the data can
 * have changed underneath a reader, and a write is exactly when a signal can be
 * sent. `focus` covers the other case, a change made in another tab.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to "an alarm was created, edited, closed or deleted". */
export function onAlarmsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell every reader that its copy of the alarm list is out of date. */
export function emitAlarmsChanged(): void {
  // Copied first, because a listener may unsubscribe while being called, and
  // iterating the live set would then skip the entry after it.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // One broken subscriber must not stop the others from refreshing.
    }
  }
}
