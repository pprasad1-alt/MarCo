"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Starts a re-audit of the same questions. Secondary action on the report. */
export function ReauditButton({ auditId, label = "Run a re-audit" }: { auditId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/audits/${auditId}/reaudit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.auditId) throw new Error(body.error ?? "We couldn't start the re-audit. Please try again.");
      router.push(`/audit/${body.auditId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the re-audit. Please try again.");
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="outline" onClick={start} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
