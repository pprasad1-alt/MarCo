import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder until the free snapshot flow is built (Prompt 1B).
export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">See how AI represents your brand. Know what to improve.</h1>
      <p className="text-slate-600">The free snapshot is coming next. For now, you can review the design system.</p>
      <Button asChild>
        <Link href="/styleguide">View the style guide</Link>
      </Button>
    </div>
  );
}
