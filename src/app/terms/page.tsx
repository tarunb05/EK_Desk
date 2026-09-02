import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold text-ink">
            EK Desk
          </Link>
          <Link
            href="/"
            className="text-sm text-ink-secondary hover:text-ink hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
        <h1 className="text-2xl font-medium text-ink">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated: September 2026</p>

        <p className="mt-6 text-sm text-ink-secondary">
          EK Desk is an internal tool built for a specific preschool&apos;s
          transport and daycare fee management. It isn&apos;t a public
          service, and there&apos;s no self-service sign-up — every account
          is created by an administrator for a named member of staff. Using a
          login means agreeing to the terms below.
        </p>

        <div className="mt-10 flex flex-col gap-8">
          <section>
            <h2 className="text-lg font-medium text-ink">Who this is for</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Access is limited to the school&apos;s own admin and teaching
              staff, each with their own login. An account is for the named
              person it was created for — sharing a username and password
              with anyone else, including a colleague, isn&apos;t permitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Acceptable use</h2>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-secondary">
              <li>
                Use EK Desk only for genuine school business: managing
                students, fee accounts, payments, and expenses.
              </li>
              <li>
                Don&apos;t export, copy, photograph, or otherwise remove
                student or family information from the tool except as your
                role actually requires.
              </li>
              <li>
                Don&apos;t attempt to access another branch&apos;s records, or
                another staff member&apos;s account, beyond what your own role
                already grants.
              </li>
              <li>
                Report a suspected compromised login, or any data you believe
                shouldn&apos;t have been visible to you, to an administrator
                right away.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              Accuracy of records
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Fee accounts, payments, and expenses recorded in EK Desk are
              only as accurate as what staff enter. A teacher&apos;s addition
              or edit to a student or fee account is reviewed and approved by
              an admin before it takes effect; payments and expenses are
              recorded directly by whoever enters them and are expected to
              reflect real transactions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              No warranty, provided as-is
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              EK Desk is provided as an internal working tool, without any
              warranty of uninterrupted availability or fitness for any
              purpose beyond what it&apos;s actually built to do. It should
              be treated as a record-keeping aid, not a substitute for the
              school&apos;s own financial controls and judgment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Changes</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              These terms may be updated as the tool changes. Continuing to
              use a login after an update means accepting the current
              version, shown here with its last-updated date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Questions</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              For anything about these terms, contact{" "}
              <a
                href="mailto:tarunb013254@gmail.com"
                className="text-accent hover:underline"
              >
                tarunb013254@gmail.com
              </a>
              . See also the{" "}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-ink-muted md:px-6">
          © {new Date().getFullYear()} EK Desk. For preschool staff use only.
        </div>
      </footer>
    </div>
  );
}
