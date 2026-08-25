import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — EuroKids Fee Tracker",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-8 shadow-xs">
        {/* shadow-xs (0 1px 2px rgba(0,0,0,.05)) is the exact boundary
            CLAUDE.md allows -- the login card is the one place in the app
            that leans on it instead of a hairline alone, for the lifted
            "card" look asked for here; still capped at the same value
            every other surface would be if it used a shadow at all. */}
        {/* Scoped CLAUDE.md exception: the login page is the one screen with
            no data on it, so its wordmark can carry the brand at a size the
            dashboards can't afford. Font-family is font-sans (Inter),
            overriding the global h1->serif rule for this element only, at
            bold weight -- matching the "Sign In" header treatment from the
            pasted card reference. Nowhere else in the app sets an h1 to
            Inter or to bold; the sidebar/top bar wordmark stays on Source
            Serif 4. Color stays --ink. */}
        <h1 className="text-login-wordmark font-sans font-bold mb-6 tracking-[-0.02em] text-ink">
          EuroKids Fee Tracker
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
