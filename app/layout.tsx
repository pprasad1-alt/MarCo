import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ModeBanner } from "@/components/marco/mode-banner";
import { getMode } from "@/lib/mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarCo",
  description: "See how AI represents your brand. Know what to improve.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server; only the label/banner text goes to the page, never keys.
  const mode = getMode();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ModeBanner mode={mode} />
        <header className="border-b">
          <div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
              MarCo
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-10 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
