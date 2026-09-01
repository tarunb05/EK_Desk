import type { Metadata } from "next";
import {
  ActivityLogIcon,
  ApprovalsIcon,
  StatusIcon,
  StudentsIcon,
  WalletIcon,
} from "@/components/shell/nav-icons";
import { IrisCurtainLink } from "@/components/shell/iris-curtain-link";
import {
  CoverflowCarousel,
  type CoverflowSlide,
} from "@/components/ui/coverflow-carousel";

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

const SCREENSHOTS: CoverflowSlide[] = [
  {
    src: "/screenshots/transport.png",
    alt: "Transport dashboard showing total receivable, collected, pending, and overdue figures, plus a by-branch split",
    title: "Transport",
    subtitle: "Receivable, collected, pending, and overdue, per branch",
  },
  {
    src: "/screenshots/students.png",
    alt: "Student directory listing students across both branches with payment status and per-row actions",
    title: "Students",
    subtitle: "Every student, both services, searchable and filterable",
  },
  {
    src: "/screenshots/expenses.png",
    alt: "Expenses dashboard showing a total, a category breakdown chart, and a filterable expense list",
    title: "Expenses",
    subtitle: "A category breakdown and the full, filterable record",
  },
  {
    src: "/screenshots/logs.png",
    alt: "Activity log listing every create, edit, and delete across the app with who did it and when",
    title: "Activity log",
    subtitle: "An unforgeable audit trail of every change, admin-only",
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

        <section id="features" className="border-y border-hairline bg-surface">
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

        <section
          id="screenshots"
          className="scroll-reveal mx-auto max-w-5xl px-4 py-16 md:px-6"
        >
          <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            What it looks like
          </h2>
          {/* Drag, arrow keys, or the dots move between screens -- one at a
              time and full-size, rather than four thumbnails competing for
              attention in a grid. Tilt/depth are dialled back from a typical
              coverflow (rotate 30° not 44°, shallower recession) so the
              neighbours stay a still-readable preview of "there's more
              here," not a spinning flourish. */}
          <CoverflowCarousel
            slides={SCREENSHOTS}
            label="Product screenshots"
            cardWidth="clamp(220px, 34vw, 420px)"
            cardClassName="aspect-[8/5]"
            rotate={30}
            depth={0.5}
            gap={0.08}
            showCaption
            showNavigation
            showPagination
            className="mt-6"
          />
        </section>
      </main>

      {/* Every link here is a real, working destination on this exact
          page/route -- no invented "Resources"/"Company" columns or social
          icons a checked-out-24/7 back-office tool for two preschool
          branches has no business pretending to have. Structure borrowed
          from a standard marketing-site footer shape (brand block, a
          nav column, a copyright rule below both), content kept entirely
          honest to what this actually is. */}
      <footer className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-sm font-medium text-ink">EK Desk</span>
              <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
                Internal fee and expense management for EuroKids transport
                and daycare.
              </p>
            </div>

            <nav
              aria-label="Footer"
              className="flex gap-x-6 gap-y-2 text-sm text-ink-secondary"
            >
              <a href="#features" className="hover:text-ink hover:underline">
                Features
              </a>
              <a href="#screenshots" className="hover:text-ink hover:underline">
                Screenshots
              </a>
              <IrisCurtainLink href={ctaHref} className="hover:text-ink hover:underline">
                {ctaLabel}
              </IrisCurtainLink>
            </nav>
          </div>

          <div className="mt-8 border-t border-hairline pt-6 text-xs text-ink-muted">
            © {new Date().getFullYear()} EK Desk. For EuroKids staff use only.
          </div>
        </div>
      </footer>
    </div>
  );
}
