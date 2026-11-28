"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** "This isn't right": the customer rejects a finding, with an optional reason (and can undo it). */
export function DismissButton({ issueId, dismissed }: { issueId: string; dismissed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(nextDismissed: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: nextDismissed, reason: nextDismissed ? reason.trim() : undefined }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("That didn't save. Please try again.");
      return false;
    }
    setOpen(false);
    router.refresh();
    return true;
  }

  if (dismissed) {
    return (
      <span className="inline-flex flex-col">
        <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={busy}>
          Restore
        </Button>
        {error && (
          <span role="alert" className="text-sm text-red-700">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          This isn&apos;t right
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>This finding isn&apos;t right?</DialogTitle>
          <DialogDescription>
            MarCo will set it aside and won&apos;t recommend anything for it. You can restore it later.
          </DialogDescription>
        </DialogHeader>
        <label htmlFor={`reason-${issueId}`} className="text-sm font-medium text-slate-700">
          Why? (optional)
        </label>
        <Textarea
          id={`reason-${issueId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="For example: we changed this in October, or this question doesn't matter to our buyers."
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => save(true)} disabled={busy}>
            Set aside this finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
