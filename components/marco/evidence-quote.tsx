import { Link2Off, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type Source = { url: string; title?: string };

type Props = {
  /** The AI's exact words. Rendered as plain text, never as HTML. */
  quote: string;
  /** Who said it, e.g. "Gemini answer to: What are the best ...?" */
  attribution?: string;
  /** Sources the AI cited. Empty or missing = "Citation evidence unavailable". */
  sources?: Source[];
  /** One line on why this matters to the business. */
  whyItMatters?: string;
  className?: string;
};

/** Only http(s) links are clickable; anything else is shown as text (links are untrusted). */
function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

export function EvidenceQuote({ quote, attribution, sources, whyItMatters, className }: Props) {
  const hasSources = Boolean(sources && sources.length > 0);
  return (
    <figure className={cn("space-y-3", className)}>
      <blockquote className="relative rounded-lg border-l-4 border-slate-300 bg-slate-50 py-3 pr-4 pl-10 text-base text-slate-800">
        <Quote className="absolute top-3.5 left-3 size-4 text-slate-400" aria-hidden="true" />
        <p className="break-words whitespace-pre-line">{quote}</p>
      </blockquote>

      <figcaption className="space-y-1.5 text-sm text-slate-500">
        {attribution && <p>{attribution}</p>}

        {hasSources ? (
          <div>
            <span className="font-medium text-slate-600">Sources cited by the AI: </span>
            <ul className="mt-1 space-y-1">
              {sources!.map((s, i) => {
                const href = safeHref(s.url);
                const text = s.title || displayUrl(s.url);
                return (
                  <li key={`${s.url}-${i}`} className="break-all">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-indigo-600 underline-offset-4 hover:underline"
                      >
                        {text}
                      </a>
                    ) : (
                      <span>{text}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-1.5">
            <Link2Off className="size-4 shrink-0" aria-hidden="true" />
            Citation evidence unavailable
          </p>
        )}

        {whyItMatters && (
          <p className="text-slate-700">
            <span className="font-medium">Why it matters: </span>
            {whyItMatters}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
