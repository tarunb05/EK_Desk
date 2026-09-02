import { ContainerScroll, CardSticky } from "@/components/ui/cards-stack";

// A real sequence, unlike the feature grid above it -- each step in this
// list only makes sense after the one before it (you add a student before
// you can record a payment against them; pending only recalculates once a
// payment exists to recalculate from), which is exactly the condition
// frontend-design's own numbered-marker guidance asks for before reaching
// for 01/02/03/04 at all. The copy is drawn from CLAUDE.md's own domain
// rules (payment is append-only and voids rather than edits; pending is
// never stored, only computed at read time) rather than invented -- those
// are genuinely distinctive, true things about how this app behaves.
const STEPS: { title: string; body: string }[] = [
  {
    title: "Add a student, open a fee account",
    body: "A transport or daycare account carries its own receivable, due date, and route or slot — set once when the student enrolls.",
  },
  {
    title: "Record each payment as it lands",
    body: "Cash, UPI, cheque, or bank transfer. A correction voids the original entry and leaves both visible — nothing is ever quietly edited or deleted.",
  },
  {
    title: "Pending and overdue, computed live",
    body: "Never a stored figure that can go stale: what's owed and what's late is worked out the moment the page loads, from the payments actually on file.",
  },
  {
    title: "It rolls up the moment it happens",
    body: "Transport, daycare, and expense dashboards update instantly, split by branch and academic year — and every change lands in the activity log automatically.",
  },
];

export function HowItWorks() {
  return (
    <section className="scroll-reveal border-b border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid md:grid-cols-2 md:gap-12">
          <div className="md:sticky md:top-24 md:h-fit">
            <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
              How it works
            </h2>
            <p className="mt-4 max-w-sm text-base text-ink-secondary">
              Four steps, in this order, every time a fee gets tracked from
              enrollment to reconciled.
            </p>
          </div>

          {/* Tuned down twice from a first pass at 220vh/16px increments --
              these are short text cards, not full-screen panels, so that
              much scroll room left a long stretch of empty canvas after
              the 4th card finished stacking and before the next section
              began. 115vh keeps every card's "hang time" readable without
              the dead air once the sequence is done. */}
          <ContainerScroll className="mt-12 min-h-[115vh] space-y-6 md:mt-0">
            {STEPS.map((step, index) => (
              <CardSticky
                key={step.title}
                index={index}
                incrementY={16}
                incrementZ={10}
                className="rounded-md border border-hairline bg-canvas p-8 shadow-xs md:p-10"
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-2xl font-medium tabular-nums text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base font-medium text-ink">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-ink-secondary">{step.body}</p>
              </CardSticky>
            ))}
          </ContainerScroll>
        </div>
      </div>
    </section>
  );
}
