"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4" role="alert">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-slate-600">This page didn&apos;t load. Your saved progress isn&apos;t lost.</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </div>
  );
}
