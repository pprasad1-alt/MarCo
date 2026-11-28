"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Developer links (style guide), shown only when the URL has ?debug=1. */
export function DebugLinks() {
  const params = useSearchParams();
  if (params.get("debug") !== "1") return null;
  return (
    <Link href="/styleguide?debug=1" className="hover:text-slate-700 hover:underline">
      Style guide
    </Link>
  );
}
