import { connection } from "next/server";
import { ModeBanner } from "@/components/marco/mode-banner";
import { getMode } from "@/lib/mode";

/**
 * Reads the mode at request time (not build time), so adding API keys later
 * takes effect without a rebuild. Render inside <Suspense>.
 */
export async function LiveModeBanner() {
  await connection();
  return <ModeBanner mode={getMode()} />;
}

/** Renders children only in mock mode (checked at request time). */
export async function MockOnly({ children }: { children: React.ReactNode }) {
  await connection();
  return getMode().mode === "MOCK" ? <>{children}</> : null;
}
