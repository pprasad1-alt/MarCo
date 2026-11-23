"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Copy, Download, Link2, Loader2, Send, TriangleAlert } from "lucide-react";
import { StatusPill } from "@/components/marco/status-pill";
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
import { checkDraftClaims, type ClaimLink } from "@/lib/drafts";
import type { Action, Draft, Fact } from "@/lib/types";

type Props = {
  actionId: string;
  initialAction: Action;
  initialDraft: Draft;
  facts: Fact[];
  brandName: string;
};

function fmt(ts: string | null) {
  return ts ? new Date(ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : null;
}

function linksFrom(draft: Draft): ClaimLink[] {
  return draft.claimChecks.filter((c) => c.factId || c.sourceUrl).map((c) => ({ claimText: c.claimText, factId: c.factId, sourceUrl: c.sourceUrl }));
}

/** Link one unsupported sentence to a confirmed fact or a source URL. */
function LinkControls({ facts, onLink }: { facts: Fact[]; onLink: (link: { factId?: string; sourceUrl?: string }) => void }) {
  const [factId, setFactId] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-2 space-y-2 rounded-md bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Link to a confirmed fact"
          value={factId}
          onChange={(e) => setFactId(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm"
        >
          <option value="">Link to a confirmed fact…</option>
          {facts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.value}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={!factId} onClick={() => onLink({ factId })}>
          <Link2 aria-hidden="true" /> Link fact
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Or link a source URL"
          placeholder="Or a source URL, e.g. https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setErr(null);
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!url.trim()}
          onClick={() => {
            try {
              const u = new URL(url.trim());
              if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
              onLink({ sourceUrl: u.toString() });
            } catch {
              setErr("Enter a full web address starting with http:// or https://");
            }
          }}
        >
          <Link2 aria-hidden="true" /> Link source
        </Button>
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}

export function DraftEditor({ actionId, initialAction, initialDraft, facts, brandName }: Props) {
  const router = useRouter();
  const [action, setAction] = useState(initialAction);
  const [draft, setDraft] = useState(initialDraft);
  const [text, setText] = useState(initialDraft.text);
  const [links, setLinks] = useState<ClaimLink[]>(() => linksFrom(initialDraft));
  const [busy, setBusy] = useState<null | "save" | "approve" | "export" | "publish">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const confirmed = useMemo(() => facts.filter((f) => f.confirmed && !f.rejected), [facts]);
  const checks = useMemo(() => checkDraftClaims(text, facts, links), [text, facts, links]);
  const unsupported = checks.filter((c) => !c.supported).length;
  const dirty = text.trim() !== draft.text || JSON.stringify(links) !== JSON.stringify(linksFrom(draft));
  const factById = new Map(facts.map((f) => [f.id, f]));

  async function call(op: "save" | "approve" | "export" | "publish") {
    const res = await fetch(`/api/actions/${actionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op === "save" ? { op, text: text.trim(), links: checks.filter((c) => c.supported).map((c) => ({ claimText: c.claimText, factId: c.factId, sourceUrl: c.sourceUrl })) } : { op }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
    setAction(body.action);
    setDraft(body.draft);
    setLinks(linksFrom(body.draft));
    return body as { action: Action; draft: Draft };
  }

  async function run(op: "save" | "approve" | "export" | "publish") {
    setBusy(op);
    setError(null);
    try {
      if (op === "approve" && dirty) await call("save");
      const result = await call(op);
      if (op === "export") download(result.draft);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function exportText(d: Draft) {
    const lines = [
      `# Correction draft for ${brandName}`,
      "",
      `Destination: ${action.destination}`,
      `Revision ${d.revisionNumber}, approved ${fmt(d.approvedAt) ?? ""}`,
      "",
      d.text,
      "",
      "## Where each sentence comes from",
      "",
      ...d.claimChecks.map((c) => {
        const f = c.factId ? factById.get(c.factId) : undefined;
        return `- “${c.claimText}” → ${f ? `confirmed fact: ${f.value} (${f.sourceUrl})` : c.sourceUrl ?? "unlinked"}`;
      }),
      "",
      "Exported from MarCo. MarCo never publishes anything; publish this yourself, then mark it as published.",
    ];
    return lines.join("\n");
  }

  function download(d: Draft) {
    const blob = new Blob([exportText(d)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-correction-r${d.revisionNumber}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  const approved = Boolean(draft.approvedAt) && !dirty;
  const exported = Boolean(draft.exportedAt) && !dirty;
  const published = action.status === "Published";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={dirty && action.status !== "Draft" ? "In review" : action.status} />
          <span className="text-sm text-slate-500">Revision {draft.revisionNumber}</span>
        </div>
        {dirty && <span className="text-sm text-amber-800">Unsaved changes</span>}
      </div>

      <div className="space-y-1">
        <label htmlFor="draft-text" className="text-sm font-medium text-slate-700">
          Draft text
        </label>
        <Textarea
          id="draft-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={5000}
          disabled={published}
          className="text-base"
        />
        <p className="text-sm text-slate-500">Plain text. Every sentence must link to a confirmed fact or a source before you can approve it.</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">
          Claim check: {checks.length - unsupported} of {checks.length} sentences linked
        </h3>
        <ul className="space-y-2">
          {checks.map((c, i) => {
            const fact = c.factId ? factById.get(c.factId) : undefined;
            return (
              <li key={`${i}-${c.claimText}`} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-2">
                  {c.supported ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="text-slate-900">{c.claimText}</p>
                    <p className={c.supported ? "text-slate-500" : "font-medium text-red-700"}>
                      {c.supported
                        ? fact
                          ? `Linked to confirmed fact: ${fact.value}`
                          : `Linked to source: ${c.sourceUrl}`
                        : "Not linked yet: link it, or remove it from the draft."}
                    </p>
                    {c.supported && links.some((l) => l.claimText === c.claimText) && !published && (
                      <button
                        type="button"
                        className="text-sm text-indigo-600 hover:underline"
                        onClick={() => setLinks((ls) => ls.filter((l) => l.claimText !== c.claimText))}
                      >
                        Remove link
                      </button>
                    )}
                  </div>
                </div>
                {!c.supported && !published && (
                  <LinkControls
                    facts={confirmed}
                    onLink={(l) => setLinks((ls) => [...ls.filter((x) => x.claimText !== c.claimText), { claimText: c.claimText, ...l }])}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        {!approved && (
          <>
            <Button onClick={() => run("approve")} disabled={busy !== null || unsupported > 0 || !text.trim()}>
              {busy === "approve" && <Loader2 className="animate-spin" aria-hidden="true" />}
              Approve draft
            </Button>
            <Button variant="outline" onClick={() => run("save")} disabled={busy !== null || !dirty || !text.trim()}>
              {busy === "save" && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save draft
            </Button>
            {unsupported > 0 && (
              <span className="text-sm text-slate-600">
                Approval is blocked: {unsupported} {unsupported === 1 ? "sentence isn't" : "sentences aren't"} linked yet.
              </span>
            )}
          </>
        )}

        {approved && !exported && (
          <>
            <Button onClick={() => run("export")} disabled={busy !== null}>
              {busy === "export" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
              Export draft
            </Button>
            <Button variant="outline" onClick={copy}>
              <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy text"}
            </Button>
          </>
        )}

        {exported && !published && (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button disabled={busy !== null}>
                  <Send aria-hidden="true" /> Mark as published
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark as published?</DialogTitle>
                  <DialogDescription>
                    Only do this after you have published the change on your {action.destination.toLowerCase()} yourself.
                    MarCo never publishes anything for you. A re-audit can then check whether AI answers change.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Not yet</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => run("publish")}>Yes, I published it</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => download(draft)}>
              <Download aria-hidden="true" /> Download again
            </Button>
          </>
        )}

        {published && (
          <p className="flex items-center gap-2 text-sm text-green-800">
            <CircleCheck className="size-4" aria-hidden="true" />
            You marked this as published on {fmt(draft.publishedAt)}.
          </p>
        )}
      </div>

      <dl className="grid gap-1 text-sm text-slate-500 sm:grid-cols-3">
        <div>
          <dt className="inline">Approved: </dt>
          <dd className="inline">{fmt(draft.approvedAt) ?? "Not yet"}</dd>
        </div>
        <div>
          <dt className="inline">Exported: </dt>
          <dd className="inline">{fmt(draft.exportedAt) ?? "Not yet"}</dd>
        </div>
        <div>
          <dt className="inline">Published: </dt>
          <dd className="inline">{fmt(draft.publishedAt) ?? "Not yet"}</dd>
        </div>
      </dl>
    </div>
  );
}
