import type { Metadata } from "next";
import Image from "next/image";
import {
  ActivityLogIcon,
  ApprovalsIcon,
  StatusIcon,
  StudentsIcon,
  WalletIcon,
} from "@/components/shell/nav-icons";
import { IrisCurtainLink } from "@/components/shell/iris-curtain-link";

export const metadata: Metadata = {
  title: "EK Desk — Fee tracking for EuroKids transport & daycare",
};

const FEATURES: {
  title: string;
  body: string;
  Icon: typeof WalletIcon;
}[] = [
  {
    title: "Every fee account, one place",
    body: "Receivable, collected, pending, and overdue — for transport and daycare, per branch and academic year, updated the moment a payment is recorded.",
    Icon: WalletIcon,
  },
  {
    title: "A directory that spans both services",
    body: "Search and filter every student across transport and daycare together, with each one's own payment history and fee accounts a click away.",
    Icon: StudentsIcon,
  },
  {
    title: "Teacher submissions, admin approval",
    body: "A teacher can add a student or propose an edit from their own branch; nothing takes effect until an admin reviews and approves it.",
    Icon: ApprovalsIcon,
  },
  {
    title: "Office expenses, tracked the same way",
    body: "Record what the office spends — salaries, fuel, repairs, supplies — with a category breakdown and the same per-branch, per-year scoping.",
    Icon: StatusIcon,
  },
  {
    title: "Every change, logged automatically",
    body: "Every student, fee account, payment, and expense edit is captured the moment it happens — who did it, what changed, and when — with nobody able to forget or bypass it.",
    Icon: ActivityLogIcon,
  },
];

const SCREENSHOTS: { src: string; alt: string; caption: string }[] = [
  {
    src: "/screenshots/transport.png",
    alt: "Transport dashboard showing total receivable, collected, pending, and overdue figures, plus a by-branch split",
    caption: "The Transport dashboard — receivable, collected, pending, and overdue, per branch",
  },
  {
    src: "/screenshots/students.png",
    alt: "Student directory listing students across both branches with payment status and per-row actions",
    caption: "The student directory — every student, both services, searchable and filterable",
  },
  {
    src: "/screenshots/expenses.png",
    alt: "Expenses dashboard showing a total, a category breakdown chart, and a filterable expense list",
    caption: "Expense tracking — a category breakdown and the full, filterable record",
  },
  {
    src: "/screenshots/logs.png",
    alt: "Activity log listing every create, edit, and delete across the app with who did it and when",
    caption: "The activity log — an unforgeable audit trail of every change, admin-only",
  },
];

export default function LandingPage() {
  const ctaHref = "/login";
  const ctaLabel = "Sign in";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
          <span className="text-lg font-bold text-ink">EK Desk</span>
          <IrisCurtainLink
            href={ctaHref}
            className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
          >
            {ctaLabel}
          </IrisCurtainLink>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
          <h1 className="animate-hero-in max-w-2xl text-3xl font-bold leading-tight text-ink md:text-4xl">
            Fee tracking for EuroKids transport &amp; daycare, in one place.
          </h1>
          <p
            className="animate-hero-in mt-4 max-w-xl text-base text-ink-secondary"
            style={{ animationDelay: "60ms" }}
          >
            Record payments, see who&apos;s paid, who&apos;s pending, and
            who&apos;s overdue, and track office expenses — across every
            branch and academic year, with an approval workflow for what
            teachers submit.
          </p>
        </section>

        <section className="border-y border-hairline bg-surface">
          {/* Five roughly-equal facets of one product, not a hierarchy --
              a plain grid rather than a bento layout that would imply one
              of them matters more than the others (it doesn't). 3-up at
              the widest point so five items settle 3-then-2 instead of an
              awkward 4-then-1. */}
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="scroll-reveal rounded-md border border-hairline bg-canvas p-5 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-accent"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-accent text-accent">
                  <feature.Icon size={18} />
                </span>
                <h2 className="mt-3 text-sm font-medium text-ink">
                  {feature.title}
                </h2>
                <p className="mt-1.5 text-sm text-ink-secondary">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            What it looks like
          </h2>
          {/* A gallery, not a scrolling list of full-size shots -- these are
              previews meant to be scanned at a glance (every real number is
              a click away once signed in), so two per row reads as "here's
              the product" the way a single column reading top to bottom
              like an article doesn't. */}
          <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
            {SCREENSHOTS.map((shot) => (
              <figure
                key={shot.src}
                className="gallery-reveal cv-auto-screenshot"
              >
                <div className="overflow-hidden rounded-md border border-hairline shadow-xs transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-accent">
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={1440}
                    height={900}
                    className="w-full"
                  />
                </div>
                <figcaption className="mt-2 text-sm text-ink-secondary">
                  {shot.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink-muted md:px-6">
          EK Desk — internal fee and expense management.
        </div>
      </footer>
    </div>
  );
}
