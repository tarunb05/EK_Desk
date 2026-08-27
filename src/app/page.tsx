import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ApprovalsIcon,
  StatusIcon,
  StudentsIcon,
  WalletIcon,
} from "@/components/shell/nav-icons";

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
];

export default function LandingPage() {
  const ctaHref = "/login";
  const ctaLabel = "Sign in";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
          <span className="text-lg font-bold text-ink">EK Desk</span>
          <Link
            href={ctaHref}
            className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
          >
            {ctaLabel}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-ink md:text-4xl">
            Fee tracking for EuroKids transport &amp; daycare, in one place.
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-secondary">
            Record payments, see who&apos;s paid, who&apos;s pending, and
            who&apos;s overdue, and track office expenses — across every
            branch and academic year, with an approval workflow for what
            teachers submit.
          </p>
        </section>

        <section className="border-y border-hairline bg-surface">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-16 sm:grid-cols-2 md:px-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-accent">
                  <feature.Icon size={20} />
                </span>
                <div>
                  <h2 className="text-sm font-medium text-ink">
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            What it looks like
          </h2>
          <div className="mt-6 flex flex-col gap-10">
            {SCREENSHOTS.map((shot) => (
              <figure key={shot.src}>
                <div className="overflow-hidden rounded-md border border-hairline shadow-xs">
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
