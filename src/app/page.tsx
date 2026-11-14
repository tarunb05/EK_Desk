import type { Metadata } from "next";
import Link from "next/link";
import {
  ChartColumn,
  Check,
  FileSpreadsheet,
  History,
  IndianRupee,
  MessageCircle,
  ReceiptIndianRupee,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/shell/brand";
import { IrisCurtainLink } from "@/components/shell/iris-curtain-link";
import {
  CoverflowCarousel,
  type CoverflowSlide,
} from "@/components/ui/coverflow-carousel";
import { Mosaic } from "@/components/ui/mosaic";
// Imported, not referenced by URL: a static import gets a content hash in
// its served path, so a recaptured screenshot is a new URL and can never
// be answered from a cached copy of the old image.
import transportShot from "../../public/screenshots/transport.png";
import studentsShot from "../../public/screenshots/students.png";
import expensesShot from "../../public/screenshots/expenses.png";
import logsShot from "../../public/screenshots/logs.png";
import { HowItWorks } from "./how-it-works";
import { LandingPreview } from "./landing-preview";

export const metadata: Metadata = {
  title: "EK Desk · Fee tracking for preschool transport and daycare",
};

// Everything the app does, one tile each -- and only things it really does:
// each line below describes a screen or a behaviour that exists, in the
// words the office would use for it.
//
// `block`/`text`/`muted` are the tile's fill and the two text colours that
// clear 4.5:1 on it. `span` is the tile's width on the 6-column desktop
// grid: two wide tiles on the first row, then two rows of three, so eight
// items fill the grid with no orphan.
const CAPABILITIES: {
  tag: string;
  title: string;
  body: string;
  points: string[];
  Icon: LucideIcon;
  block: string;
  text: string;
  muted: string;
  span: string;
}[] = [
  {
    tag: "Fees",
    title: "Every fee account, one place",
    body: "Transport and daycare fees for every student, per branch and academic year, updated the moment a payment is recorded.",
    points: [
      "Receivable, collected, pending and overdue at a glance",
      "Overdue worked out from the due date, never typed in",
      "A wrong payment is voided, not erased. Both stay on record",
    ],
    Icon: IndianRupee,
    block: "bg-sand",
    text: "text-ink",
    muted: "text-ink-secondary",
    span: "lg:col-span-3",
  },
  {
    tag: "Charts",
    title: "The usual questions, already answered",
    body: "Each dashboard draws the figures the office asks about most, from the same records as the tables.",
    points: [
      "How much came in each month",
      "How old the pending money is: 30, 60, over 60 days",
      "Which class, route or daycare slot is behind",
    ],
    Icon: ChartColumn,
    block: "bg-accent-fill",
    text: "text-ink",
    muted: "text-ink",
    span: "lg:col-span-3",
  },
  {
    tag: "Payment requests",
    title: "Ask a parent to pay, over WhatsApp",
    body: "Send a ready-written message with a pay link by WhatsApp or SMS. The parent pays by UPI or bank transfer and reports it; the office confirms it before it counts.",
    points: [],
    Icon: MessageCircle,
    block: "bg-accent",
    text: "text-canvas",
    muted: "text-canvas",
    span: "lg:col-span-2",
  },
  {
    tag: "Students",
    title: "One directory for both services",
    body: "Search by name, filter by class, status, service or year, and open any student to see every fee account and payment they have ever had. Re-enroll for a new year in one step.",
    points: [],
    Icon: Users,
    block: "bg-surface",
    text: "text-ink",
    muted: "text-ink-secondary",
    span: "lg:col-span-2",
  },
  {
    tag: "Expenses",
    title: "What the office spends, too",
    body: "Salaries, fuel, repairs and supplies, recorded by category, charted by month, and filtered by branch, method or any date range.",
    points: [],
    Icon: ReceiptIndianRupee,
    block: "bg-sand",
    text: "text-ink",
    muted: "text-ink-secondary",
    span: "lg:col-span-2",
  },
  {
    tag: "Roles",
    title: "Teachers see their own branch",
    body: "A teacher adds students and records payments for their branch only. Deleting a student goes to an admin for approval first.",
    points: [],
    Icon: ShieldCheck,
    block: "bg-surface",
    text: "text-ink",
    muted: "text-ink-secondary",
    span: "lg:col-span-2",
  },
  {
    tag: "Audit",
    title: "Every change, logged by itself",
    body: "Who did what, to which record, and when. Written by the database as it happens, so nobody can forget to log a change or skip it.",
    points: [],
    Icon: History,
    block: "bg-accent-fill",
    text: "text-ink",
    muted: "text-ink",
    span: "lg:col-span-2",
  },
  {
    tag: "Exports",
    title: "Excel when you need it",
    body: "Click a figure to download the rows behind it as a spreadsheet, with the same filters applied: pending fees, a month of expenses, the activity log.",
    points: [],
    Icon: FileSpreadsheet,
    block: "bg-sand",
    text: "text-ink",
    muted: "text-ink-secondary",
    span: "lg:col-span-2",
  },
];

// The two logins, side by side. Taken from the access rules the database
// itself enforces (row-level security by role and branch), not a wish list.
const ROLES: {
  name: string;
  summary: string;
  can: string[];
  block: string;
  text: string;
  rule: string;
}[] = [
  {
    name: "Admin",
    summary: "Runs the office. Sees every branch.",
    can: [
      "Transport and daycare dashboards for all branches",
      "Confirms or rejects payments parents report",
      "Approves a teacher's request to delete a student",
      "Sets up branches, years, teacher logins and collection accounts",
      "Reads the full activity log and downloads it",
    ],
    block: "bg-accent",
    text: "text-canvas",
    rule: "border-canvas/25",
  },
  {
    name: "Teacher",
    summary: "Works one branch. Sees only that branch.",
    can: [
      "Adds and edits students, and re-enrolls them",
      "Records payments and voids a mistaken one",
      "Sends a parent a payment request",
      "Records the branch's expenses",
      "Messages an admin for help from any screen",
    ],
    block: "bg-surface",
    text: "text-ink",
    rule: "border-hairline",
  },
];

const SCREENSHOTS: CoverflowSlide[] = [
  {
    src: transportShot.src,
    alt: "Transport dashboard with stat tiles, a collection progress bar, a monthly collections chart and an ageing chart",
    title: "Transport",
    subtitle: "Receivable, collected, pending and overdue, with charts",
  },
  {
    src: studentsShot.src,
    alt: "Student directory listing students across both branches with payment status chips and per-row actions",
    title: "Students",
    subtitle: "Every student, both services, searchable and filterable",
  },
  {
    src: expensesShot.src,
    alt: "Expenses page with a total, a spend-by-month chart, a category breakdown and the expense list",
    title: "Expenses",
    subtitle: "Spend by month and by category, over the full record",
  },
  {
    src: logsShot.src,
    alt: "Activity log listing every create, edit, and delete across the app with who did it and when",
    title: "Activity log",
    subtitle: "A complete trail of every change, for admins",
  },
];

const pillButton =
  "inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The small uppercase caption pinned to each corner of the mosaic and above
// each section -- the reference's "EDITS / TIME MANAGEMENT" labels.
const tag =
  "text-2xs font-medium uppercase tracking-[0.08em] text-ink-secondary";

const sectionHeading =
  "mt-3 max-w-2xl text-3xl font-semibold leading-[1.05] text-ink md:text-4xl";

export default function LandingPage() {
  const ctaHref = "/login";
  const ctaLabel = "Log in";

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-canvas"
      >
        Skip to content
      </a>

      {/* A floating pill, not a full-width bar -- stays put while the page
          scrolls under it, the way the reference's nav does. The canvas fill
          is opaque on purpose: no backdrop blur anywhere in this app. */}
      <header className="sticky top-3 z-40 px-4 md:px-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-ink/25 bg-canvas pl-5 pr-2">
          <Wordmark />
          <nav
            aria-label="Sections"
            className="hidden items-center gap-7 text-sm text-ink-secondary md:flex"
          >
            <a href="#preview" className="transition-colors hover:text-ink">
              Dashboard
            </a>
            <a href="#features" className="transition-colors hover:text-ink">
              What it does
            </a>
            <a href="#roles" className="transition-colors hover:text-ink">
              Who uses it
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-ink"
            >
              How it works
            </a>
          </nav>
          <IrisCurtainLink href={ctaHref} className={pillButton}>
            {ctaLabel}
          </IrisCurtainLink>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Headline bottom-left, supporting sentence bottom-right, sharing a
            baseline -- the reference's hero split. Stacks on phones. */}
        <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 pt-16 md:grid-cols-12 md:items-end md:px-6 md:pb-16 md:pt-24">
          <h1 className="animate-hero-in text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-ink md:col-span-7 md:text-6xl">
            One desk for every fee.
          </h1>
          <div
            className="animate-hero-in max-w-md md:col-span-5 md:justify-self-end md:pb-2"
            style={{ animationDelay: "60ms" }}
          >
            <p className="text-lg leading-snug text-ink-secondary">
              EK Desk is the fee register for a preschool&apos;s transport and
              daycare: who has paid, who is pending, who is overdue, and what
              the office has spent, across every branch and year.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                href="#features"
                className="text-sm font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink"
              >
                See what it does
              </a>
            </div>
          </div>
        </section>

        <section
          aria-hidden="true"
          className="animate-hero-in mx-auto max-w-6xl px-4 md:px-6"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex justify-between pb-2">
            <span className={tag}>Transport</span>
            <span className={tag}>Daycare</span>
          </div>
          <div className="grid-rule" />
          <Mosaic />
          <div className="grid-rule" />
          <div className="flex justify-between pt-2">
            <span className={tag}>Expenses</span>
            <span className={tag}>Activity log</span>
          </div>
        </section>

        {/* The product itself, before any description of it: the real
            dashboard components, fed sample figures (see landing-preview). */}
        <section
          id="preview"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-20 md:px-6 md:pt-28"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className={tag}>The dashboard</p>
              <h2 className={sectionHeading}>See where every rupee stands.</h2>
            </div>
            <p className="max-w-sm text-base text-ink-secondary">
              One screen per service. The figures on top, and under them the
              charts that explain the figures.
            </p>
          </div>
          <div className="scroll-reveal-scale mt-10">
            <LandingPreview />
            <p className="mt-3 text-xs text-ink-muted">
              Sample figures, shown in the same components the signed-in
              dashboard uses.
            </p>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 md:px-6 md:py-28"
        >
          <p className={tag}>What it does</p>
          <h2 className={sectionHeading}>
            Everything the office tracks, in the same place.
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {CAPABILITIES.map((item) => (
              <article
                key={item.title}
                className={`hover-tile scroll-reveal flex min-h-64 flex-col justify-between gap-8 rounded-xl p-6 md:p-7 ${item.block} ${item.text} ${item.span}`}
              >
                <div>
                  <p className="text-2xs font-medium uppercase tracking-[0.08em]">
                    {item.tag}
                  </p>
                  <h3 className="mt-3 max-w-sm text-xl font-semibold leading-tight tracking-[-0.02em]">
                    {item.title}
                  </h3>
                  <p className={`mt-2 max-w-md text-base ${item.muted}`}>
                    {item.body}
                  </p>
                  {item.points.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-1.5">
                      {item.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check
                            size={15}
                            strokeWidth={2}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <item.Icon size={40} strokeWidth={1.25} aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>

        <section
          id="roles"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 md:px-6 md:pb-28"
        >
          <div className="grid-rule" />
          <div className="pt-20 md:pt-28">
            <p className={tag}>Who uses it</p>
            <h2 className={sectionHeading}>Two logins, two jobs.</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {ROLES.map((role) => (
                <article
                  key={role.name}
                  className={`hover-tile scroll-reveal rounded-xl p-6 md:p-8 ${role.block} ${role.text}`}
                >
                  <h3 className="text-3xl font-semibold leading-none tracking-[-0.03em]">
                    {role.name}
                  </h3>
                  <p className="mt-2 text-base">{role.summary}</p>
                  <ul className={`mt-6 border-t ${role.rule}`}>
                    {role.can.map((line) => (
                      <li
                        key={line}
                        className={`flex items-start gap-2.5 border-b py-3 text-sm ${role.rule}`}
                      >
                        <Check
                          size={15}
                          strokeWidth={2}
                          aria-hidden="true"
                          className="mt-0.5 shrink-0"
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />

        <section
          id="screenshots"
          className="scroll-reveal mx-auto max-w-7xl scroll-mt-24 px-4 py-20 md:px-6 md:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <p className={tag}>What it looks like</p>
            <h2 className={sectionHeading}>
              Four screens do most of the work.
            </h2>
          </div>
          {/* Drag, a trackpad swipe, arrow keys, or the dots move between
              screens -- one at a time and full-size, rather than four
              thumbnails competing for attention in a grid. Tilt/depth are
              dialled back from a typical coverflow (rotate 30° not 44°,
              shallower recession) so the neighbours stay a still-readable
              preview of "there's more here," not a spinning flourish. The
              selected card is always exactly centred in the frame (it's a
              translateX(-50%) off the frame's own midpoint) -- max-w-7xl
              here just gives that centred card more room to grow into. */}
          <CoverflowCarousel
            slides={SCREENSHOTS}
            label="Product screenshots"
            cardWidth="clamp(360px, 50vw, 760px)"
            cardAspectRatio={8 / 5}
            imageSizes="(min-width: 1520px) 760px, (min-width: 768px) 50vw, 90vw"
            rotate={30}
            depth={0.5}
            gap={0.08}
            showCaption
            showNavigation
            showPagination
            className="mt-10"
          />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6 md:pb-28">
          <div className="scroll-reveal flex flex-col gap-8 rounded-xl bg-accent p-8 text-canvas md:flex-row md:items-end md:justify-between md:p-12">
            <h2 className="max-w-xl text-3xl font-semibold leading-[1.05] md:text-4xl">
              The register is where you left it.
            </h2>
          </div>
        </section>
      </main>

      {/* Every link here is a real, working destination on this exact
          page/route -- no invented "Resources"/"Company" columns or social
          icons a back-office tool for two preschool branches has no
          business pretending to have. */}
      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 md:px-6">
        <div className="grid-rule" />
        <div className="flex flex-col gap-8 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 max-w-xs text-sm text-ink-secondary">
              Internal fee and expense management for preschool transport and
              daycare.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-secondary"
          >
            <a href="#features" className="hover:text-ink hover:underline">
              What it does
            </a>
            <a href="#roles" className="hover:text-ink hover:underline">
              Who uses it
            </a>
            <a href="#screenshots" className="hover:text-ink hover:underline">
              Screens
            </a>
            <IrisCurtainLink
              href={ctaHref}
              className="hover:text-ink hover:underline"
            >
              {ctaLabel}
            </IrisCurtainLink>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            © {new Date().getFullYear()} EK Desk. For preschool staff use only.
          </p>
          <nav
            aria-label="Legal"
            className="flex gap-x-4 gap-y-2 text-xs text-ink-muted"
          >
            <Link href="/privacy" className="hover:text-ink hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink hover:underline">
              Terms &amp; Conditions
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
