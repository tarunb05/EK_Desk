import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { WavesBackground } from "./waves-background";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas px-4">
      <WavesBackground />
      {/* Phase 14: login-glass-card supplies the light-frosted fill + blur
          (see globals.css) -- everything else about this card, including
          border-border and shadow-xs, is untouched from before this phase.
          At the fill's measured contrast, --ink (the wordmark below),
          --ink-secondary and --border all already clear their required
          ratios against the wave background's real extremes at their
          existing values -- no on-glass color variants needed for any of
          them. */}
      <div className="login-glass-card relative z-10 w-full max-w-md rounded-md border border-border p-8 shadow-xs">
        {/* Scoped CLAUDE.md exception: the login page is the one screen with
            no data on it, so its wordmark can carry the brand at a size the
            dashboards can't afford — still Inter (the app's one typeface),
            just bold, matching the "Sign In" header treatment from the
            pasted card reference. Nowhere else in the app sets an h1 to
            bold; every other page title keeps its own (lighter) weight.
            Color stays --ink, unchanged by Phase 14 -- see the glass card
            comment above. */}
        <h1 className="text-login-wordmark font-bold mb-6 tracking-[-0.02em] text-ink">
          EK Desk
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
