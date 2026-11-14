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
    body: "A transport or daycare account carries its own receivable, due date, and route or slot, set once when the student enrolls.",
  },
  {
    title: "Record each payment as it lands",
    body: "Cash, UPI, cheque, or bank transfer. A correction voids the original entry and leaves both visible. Nothing is ever quietly edited or deleted.",
  },
  {
    title: "Pending and overdue, computed live",
    body: "Never a stored figure that can go stale: what's owed and what's late is worked out the moment the page loads, from the payments actually on file.",
  },
  {
    title: "It rolls up the moment it happens",
    body: "Transport, daycare, and expense dashboards update instantly, split by branch and academic year. Every change lands in the activity log automatically.",
  },
];

// One flat palette block per step, in the same order the stat tiles and the
// feature grid use them; the slate one needs light text, the rest take ink.
const STEP_BLOCKS = [
  { block: "bg-sand", text: "text-ink", muted: "text-ink-secondary" },
  { block: "bg-accent-fill", text: "text-ink", muted: "text-ink" },
  { block: "bg-surface", text: "text-ink", muted: "text-ink-secondary" },
  { block: "bg-accent", text: "text-canvas", muted: "text-canvas" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-reveal scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid-rule" />
        <div className="grid py-20 md:grid-cols-2 md:gap-12 md:py-28">
          <div className="md:sticky md:top-28 md:h-fit">
            <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-secondary">
              How it works
            </p>
            <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-[1.05] text-ink md:text-4xl">
              Four steps, always in this order.
            </h2>
            <p className="mt-4 max-w-sm text-base text-ink-secondary">
              Every time a fee gets tracked, from enrollment to reconciled.
            </p>
          </div>

          {/* Tuned down twice from a first pass at 220vh/16px increments --
              these are short text cards, not full-screen panels, so that
              much scroll room left a long stretch of empty canvas after
              the 4th card finished stacking and before the next section
              began. 115vh keeps every card's "hang time" readable without
              the dead air once the sequence is done. */}
          {/* top offset clears the floating nav pill (56px + its 12px
              inset) so the first stuck card doesn't slide under it. */}
          <ContainerScroll className="mt-12 min-h-[115vh] space-y-6 md:mt-0">
            {STEPS.map((step, index) => {
              const tone = STEP_BLOCKS[index % STEP_BLOCKS.length];
              return (
                <CardSticky
                  key={step.title}
                  index={index}
                  incrementY={16}
                  incrementZ={10}
                  style={{ top: 96 + index * 16 }}
                  className={`rounded-xl p-8 md:p-10 ${tone.block} ${tone.text}`}
                >
                  <span className="block text-5xl font-semibold leading-none tracking-[-0.04em] tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-8 text-xl font-semibold leading-tight tracking-[-0.02em]">
                    {step.title}
                  </h3>
                  <p className={`mt-2 text-base ${tone.muted}`}>{step.body}</p>
                </CardSticky>
              );
            })}
          </ContainerScroll>
        </div>
      </div>
    </section>
  );
}
