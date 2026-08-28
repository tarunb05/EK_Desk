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
      <div className="relative z-10 w-full max-w-md rounded-md border border-border bg-surface p-8 shadow-xs">
        {/* shadow-xs (0 1px 2px rgba(0,0,0,.05)) is the exact boundary
            CLAUDE.md allows -- the login card is the one place in the app
            that leans on it instead of a hairline alone, for the lifted
            "card" look asked for here; still capped at the same value
            every other surface would be if it used a shadow at all. */}
        {/* Scoped CLAUDE.md exception: the login page is the one screen with
            no data on it, so its wordmark can carry the brand at a size the
            dashboards can't afford — still Inter (the app's one typeface),
            just bold, matching the "Sign In" header treatment from the
            pasted card reference. Nowhere else in the app sets an h1 to
            bold; every other page title keeps its own (lighter) weight.
            Color stays --ink. */}
        <h1 className="text-login-wordmark font-bold mb-6 tracking-[-0.02em] text-ink">
          EK Desk
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
