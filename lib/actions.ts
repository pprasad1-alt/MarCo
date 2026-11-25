/**
 * Corrective action lifecycle: Draft -> In review -> Approved -> Exported -> Published.
 *
 *  - Saving an edit creates a new draft revision and clears any approval.
 *  - Approval is blocked unless every sentence links to a confirmed fact or source
 *    (re-checked here on the server; the editor's check is only a preview).
 *  - Export never publishes anything. MarCo has no publishing, ever.
 *  - "Published" is set only when the customer says they published it themselves.
 */
import { z } from "zod";
import { checkDraftClaims, type ClaimLink } from "@/lib/drafts";
import { updateStore, type StoreData } from "@/lib/store";
import { canApproveDraft, type Action, type Draft } from "@/lib/types";

export const ActionOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    text: z.string().trim().min(1, "The draft can't be empty.").max(5000, "Keep the draft under 5,000 characters."),
    links: z
      .array(
        z.object({
          claimText: z.string().max(2000),
          factId: z.string().nullable().optional(),
          sourceUrl: z.string().max(2048).nullable().optional(),
        }),
      )
      .max(200)
      .default([]),
  }),
  z.object({ op: z.literal("approve") }),
  z.object({ op: z.literal("export") }),
  z.object({ op: z.literal("publish") }),
]);
export type ActionOp = z.infer<typeof ActionOp>;

export type ActionResult = { ok: true; action: Action; draft: Draft } | { ok: false; error: string; status?: number };

function now() {
  return new Date().toISOString();
}

function context(data: StoreData, actionId: string) {
  const action = data.actions.find((a) => a.id === actionId);
  const issue = action && data.issues.find((i) => i.id === action.issueId);
  const audit = issue && data.audits.find((a) => a.id === issue.auditId);
  const facts = audit ? data.facts.filter((f) => f.brandId === audit.brandId) : [];
  const drafts = data.drafts.filter((d) => d.actionId === actionId).sort((a, b) => a.revisionNumber - b.revisionNumber);
  return { action, facts, latest: drafts.at(-1) };
}

/** Links already on a draft (manual or automatic), reused when re-checking. */
function linksFrom(draft: Draft): ClaimLink[] {
  return draft.claimChecks.filter((c) => c.factId || c.sourceUrl).map((c) => ({ claimText: c.claimText, factId: c.factId, sourceUrl: c.sourceUrl }));
}

export function applyActionOp(actionId: string, input: ActionOp): Promise<ActionResult> {
  return updateStore({ actionId }, (data): ActionResult => {
    const { action, facts, latest } = context(data, actionId);
    if (!action) return { ok: false, error: "We couldn't find that action.", status: 404 };
    if (action.outcome !== "correction" || !latest) {
      return { ok: false, error: "This action doesn't have a draft. Its outcome is investigation, not new content.", status: 400 };
    }

    switch (input.op) {
      case "save": {
        if (input.text === latest.text && JSON.stringify(input.links) === JSON.stringify(linksFrom(latest))) {
          return { ok: true, action, draft: latest };
        }
        const draft: Draft = {
          id: `${action.id}-d${latest.revisionNumber + 1}`,
          actionId: action.id,
          revisionNumber: latest.revisionNumber + 1,
          text: input.text,
          claimChecks: checkDraftClaims(input.text, facts, input.links),
          approvedAt: null,
          exportedAt: null,
          publishedAt: null,
        };
        data.drafts.push(draft);
        action.status = "In review";
        return { ok: true, action, draft };
      }
      case "approve": {
        // Re-check against the facts as they are now, not as the browser saw them.
        const checks = checkDraftClaims(latest.text, facts, linksFrom(latest));
        latest.claimChecks = checks;
        if (!canApproveDraft({ claimChecks: checks })) {
          const n = checks.filter((c) => !c.supported).length;
          return {
            ok: false,
            error: `${n} ${n === 1 ? "sentence isn't" : "sentences aren't"} linked to a confirmed fact or source yet. Link or remove ${n === 1 ? "it" : "them"} before approving.`,
            status: 400,
          };
        }
        latest.approvedAt = latest.approvedAt ?? now();
        if (action.status !== "Exported" && action.status !== "Published") action.status = "Approved";
        return { ok: true, action, draft: latest };
      }
      case "export": {
        if (!latest.approvedAt) return { ok: false, error: "Approve the draft before exporting it.", status: 400 };
        latest.exportedAt = latest.exportedAt ?? now();
        if (action.status !== "Published") action.status = "Exported";
        return { ok: true, action, draft: latest };
      }
      case "publish": {
        if (!latest.exportedAt) return { ok: false, error: "Export the draft and publish it on your site first.", status: 400 };
        latest.publishedAt = latest.publishedAt ?? now();
        action.status = "Published";
        return { ok: true, action, draft: latest };
      }
    }
  });
}

/** The customer says an issue isn't a real problem (or undoes that). */
export function setIssueDismissed(issueId: string, dismissed: boolean): Promise<boolean> {
  return updateStore({ issueId }, (data) => {
    const issue = data.issues.find((i) => i.id === issueId);
    if (!issue) return false;
    issue.rejectedByUser = dismissed;
    return true;
  });
}

/**
 * A confirmed fact changed (edited, rejected or unconfirmed) after drafts were written.
 * Every draft that relies on one of those facts gets a new revision, re-checked
 * against the current facts, and goes back to "In review" (approval cleared).
 * Published drafts are left alone: only the customer changes that status.
 * Returns the ids of the actions sent back to review.
 */
export function reopenDraftsForChangedFacts(data: StoreData, brandId: string, changedFactIds: Set<string>): string[] {
  if (changedFactIds.size === 0) return [];
  const facts = data.facts.filter((f) => f.brandId === brandId);
  const auditIds = new Set(data.audits.filter((a) => a.brandId === brandId).map((a) => a.id));
  const reopened: string[] = [];
  for (const action of data.actions) {
    if (action.outcome !== "correction" || action.status === "Published") continue;
    const issue = data.issues.find((i) => i.id === action.issueId);
    if (!issue || !auditIds.has(issue.auditId)) continue;
    const drafts = data.drafts.filter((d) => d.actionId === action.id).sort((a, b) => a.revisionNumber - b.revisionNumber);
    const latest = drafts.at(-1);
    if (!latest || !latest.claimChecks.some((c) => c.factId && changedFactIds.has(c.factId))) continue;
    const links = linksFrom(latest).filter((l) => !(l.factId && changedFactIds.has(l.factId)));
    data.drafts.push({
      id: `${action.id}-d${latest.revisionNumber + 1}`,
      actionId: action.id,
      revisionNumber: latest.revisionNumber + 1,
      text: latest.text,
      claimChecks: checkDraftClaims(latest.text, facts, links),
      approvedAt: null,
      exportedAt: null,
      publishedAt: null,
    });
    action.status = "In review";
    reopened.push(action.id);
  }
  return reopened;
}
