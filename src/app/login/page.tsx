import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/brand";
import { Mosaic } from "@/components/ui/mosaic";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
};

// Two panels: the form on the canvas, and beside it one large slate block
// carrying the headline and the same tile mosaic the landing page runs
// under its hero -- so signing in feels like the next screen of the same
// site, not a different product. The block is decoration plus one line of
// copy; on phones it drops away entirely and the form is the whole page.
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-canvas p-3 md:grid-cols-2 md:p-4">
      <div className="flex flex-col px-4 py-6 md:px-10 md:py-8">
        <Link
          href="/"
          aria-label="EK Desk home"
          className="self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <Wordmark size="lg" />
        </Link>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-4xl font-semibold leading-none tracking-[-0.03em] text-ink">
              Log in
            </h1>
            <p className="mb-8 mt-3 text-base text-ink-secondary">
              Use the username the office gave you.
            </p>
            <LoginForm />
          </div>
        </div>

        <p className="text-xs text-ink-muted">For preschool staff use only.</p>
      </div>

      <div
        aria-hidden="true"
        className="hidden flex-col justify-between overflow-hidden rounded-xl bg-accent md:flex"
      >
        <p className="max-w-md p-10 text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-canvas lg:p-12 lg:text-5xl">
          Who&apos;s paid, who&apos;s pending, who&apos;s overdue.
        </p>
        <Mosaic rows={2} />
      </div>
    </main>
  );
}
