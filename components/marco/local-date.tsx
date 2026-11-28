"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Shows a date in the viewer's own time zone. The server doesn't know the
 * viewer's time zone (it runs on UTC), so the date is filled in by the browser.
 */
export function LocalDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const text = useSyncExternalStore(
    noop,
    () => formatLocal(iso, withTime),
    () => "", // server render: left blank, filled in right after the page loads
  );
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}

export function formatLocal(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return withTime
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}
