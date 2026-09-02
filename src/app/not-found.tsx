import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/shell/nav-icons";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm animate-pop-in rounded-md border border-border bg-surface p-8 text-center">
        <p className="text-5xl font-semibold text-accent">404</p>
        <h1 className="mt-3 text-lg font-medium text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          That page doesn&apos;t exist — check the link, or head back to the
          dashboard.
        </p>
        <Link
          href="/transport"
          className="mt-6 inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
        >
          <ArrowLeftIcon size={16} />
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
