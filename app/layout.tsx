import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { LiveModeBanner } from "@/components/marco/live-mode";
import { Logo } from "@/components/marco/logo";
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
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Mode is read on the server per request; only the label goes to the page, never keys. */}
        <Suspense fallback={<div className="h-[37px] border-b bg-slate-50" aria-hidden="true" />}>
          <LiveModeBanner />
        </Suspense>
        <header className="border-b">
          <div className="mx-auto flex max-w-[960px] items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" aria-label="MarCo home">
              <Logo />
            </Link>
            <nav aria-label="Main" className="text-sm">
              {/* Plain link (no prefetch): opening it may start a sample run. */}
              <a href="/sample" className="font-medium text-slate-600 hover:text-indigo-600">
                Sample report
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-10 sm:px-6">{children}</main>
        <footer className="border-t">
          <div className="mx-auto flex max-w-[960px] flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>MarCo prototype · AI answers are samples, and improvements are not guaranteed.</span>
            <Link href="/styleguide" className="hover:text-slate-700 hover:underline">
              Style guide
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
