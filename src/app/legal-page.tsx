import Link from "next/link";
import { Wordmark } from "@/components/shell/brand";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

// One contact address for both documents, in one place.
export const CONTACT_EMAIL = "tarunbasavaraju25@gmail.com";

// The shared frame for the Privacy Policy and the Terms: the landing page's
// floating nav pill, a large title, a contents list that stays in view on
// wide screens, and numbered sections separated by the same square-ended
// hairline the landing page uses. Both documents used to be a single narrow
// column of same-sized headings with no way to see what was in them without
// scrolling the whole thing.
//
// Each page supplies only its words (a `sections` array), so the two can
// never drift apart in layout, and the contents list is built from the same
// array the sections render from -- it cannot fall out of step with them.
export function LegalPage({
  title,
  updated,
  intro,
  sections,
  other,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  // The sibling document, linked from the footer of this one.
  other: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-canvas"
      >
        Skip to content
      </a>

      <header className="sticky top-3 z-40 px-4 md:px-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-ink/25 bg-canvas pl-5 pr-2">
          <Link
            href="/"
            aria-label="EK Desk home"
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="lift inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-16 md:px-6 md:pb-28 md:pt-24"
      >
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-secondary">
          Last updated {updated}
        </p>
        <h1 className="animate-hero-in mt-3 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-ink md:text-5xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-snug text-ink-secondary">
          {intro}
        </p>

        <div className="mt-14 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
          <nav
            aria-label="On this page"
            className="lg:sticky lg:top-24 lg:h-fit"
          >
            <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-secondary">
              On this page
            </p>
            <ol className="mt-3 flex flex-col gap-1 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="group flex gap-2.5 rounded-sm py-1 text-ink-secondary transition-colors duration-150 hover:text-ink"
                  >
                    <span className="w-5 shrink-0 tabular-nums text-ink-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="underline decoration-transparent underline-offset-4 transition-colors duration-150 group-hover:decoration-ink/40">
                      {section.title}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex min-w-0 flex-col">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-reveal scroll-mt-24"
              >
                <div className="grid-rule" />
                <div className="grid gap-x-8 gap-y-3 py-8 md:grid-cols-[3.5rem_minmax(0,1fr)] md:py-10">
                  <span className="text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-accent-fill">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold leading-tight text-ink">
                      {section.title}
                    </h2>
                    <div className="legal-prose mt-3 max-w-prose text-base text-ink-secondary">
                      {section.body}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 md:px-6">
        <div className="grid-rule" />
        <div className="flex flex-col gap-3 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} EK Desk. For preschool staff use only.
          </p>
          <Link href={other.href} className="hover:text-ink hover:underline">
            {other.label}
          </Link>
        </div>
      </footer>
    </div>
  );
}
