"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateUrl } from "@/lib/url";

/** URL input + the page's single primary button. Validates instantly, then again on the server. */
export function UrlForm() {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const checked = validateUrl(value);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: checked.url }),
      });
      const body = (await res.json().catch(() => ({}))) as { auditId?: string; error?: string };
      if (!res.ok || !body.auditId) {
        setError(body.error ?? "We couldn't start your snapshot. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/snapshot/${body.auditId}`);
    } catch {
      setError("We couldn't reach MarCo. Check your internet connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        Your company website
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="acme.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-11 w-full min-w-0 rounded-md sm:flex-1 border border-input bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none aria-invalid:border-red-500"
        />
        <Button type="submit" size="lg" className="h-11 px-5" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {submitting ? "Starting…" : "Run free snapshot"}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </form>
  );
}
