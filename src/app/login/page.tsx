import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — EuroKids Fee Tracker",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-8">
        <h1 className="mb-6 text-lg font-medium text-ink">
          EuroKids Fee Tracker
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
