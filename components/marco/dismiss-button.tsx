"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** "Not an issue": the customer can reject a finding (and undo it). */
export function DismissButton({ issueId, dismissed }: { issueId: string; dismissed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: !dismissed }),
    }).catch(() => null);
    if (!res?.ok) setError("That didn't save. Please try again.");
    else router.refresh();
    setBusy(false);
  }
  return (
    <span className="inline-flex flex-col">
      <Button variant="ghost" size="sm" onClick={toggle} disabled={busy}>
        {dismissed ? "Restore issue" : "Not an issue"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
