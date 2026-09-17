import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-2xl font-medium text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated: September 2026</p>

        <p className="mt-6 text-sm text-ink-secondary">
          EK Desk is an internal fee and expense management tool used by
          preschool transport and daycare staff. It has no public sign-up and
          isn&apos;t offered as a consumer product — this policy explains what
          personal data it holds, why, and who can see it, for the families
          and staff whose information passes through it.
        </p>

        <div className="mt-10 flex flex-col gap-8">
          <section>
            <h2 className="text-lg font-medium text-ink">
              What information is stored
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-secondary">
              <li>
                <span className="text-ink">Student records:</span> full name,
                guardian name, phone number, class/section, admission number,
                and enrollment status.
              </li>
              <li>
                <span className="text-ink">Fee and payment records:</span>{" "}
                transport or daycare account details (route, pickup point or
                slot, receivable amount, due date) and a history of payments
                recorded against them.
              </li>
              <li>
                <span className="text-ink">Expense records:</span> what the
                office spent, by category, branch, and date — this doesn&apos;t
                identify any student or family.
              </li>
              <li>
                <span className="text-ink">Staff login information:</span> a
                username and a securely hashed password for each admin or
                teacher account, plus a record of which branch a teacher
                belongs to.
              </li>
              <li>
                <span className="text-ink">Activity log:</span> a record of
                who created, edited, or deleted a student, fee account,
                payment, or expense, and when — kept as an internal audit
                trail, visible only to admins.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              Why this information is collected
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Solely to run the transport and daycare fee accounts these
              records belong to: tracking what&apos;s owed, what&apos;s been
              paid, what&apos;s overdue, and what the office has spent —
              nothing here is used for advertising, profiling, or sold or
              rented to anyone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Who can see it</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Access is role- and branch-scoped, enforced at the database
              level rather than only in the app&apos;s interface:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-secondary">
              <li>An admin can see every branch&apos;s records.</li>
              <li>
                A teacher can see only their own branch&apos;s students, fee
                accounts, and payments — never another branch&apos;s.
              </li>
              <li>
                A teacher&apos;s own additions or edits don&apos;t take effect
                until an admin reviews and approves them.
              </li>
              <li>
                Nobody outside the school&apos;s own admin/teacher staff has an
                account or any access at all.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              WhatsApp and SMS
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              When an admin asks for a fee payment, the message is sent from
              the school&apos;s own phone number to the guardian&apos;s
              number, over WhatsApp&apos;s own service (or, as a fallback,
              the guardian&apos;s mobile carrier&apos;s SMS service). The
              message contains the amount due, a payment link, and a
              reference code — WhatsApp and the carrier each handle delivery
              of that message the way they would for any other message sent
              through them; EK Desk itself only records that a message was
              sent, through which channel, and to which number, never its
              delivery or read status.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">The pay page</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              The link in a payment message opens a page showing the
              amount due and the school&apos;s payment details — nothing
              else about the student or family. It expires after a
              short period or once the school confirms the payment. If a
              guardian reports having paid, we collect only the reference
              number (UTR) or bank reference, the amount, and the date they
              enter — there is no tracking, analytics, or advertising script
              on this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">What we keep</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Payment reference numbers and the school&apos;s own
              confirmation records (who checked the bank, when, and what was
              received) are kept as financial records, the same way any
              other payment record is. The specific retention period for
              these is{" "}
              <span className="font-medium text-ink">
                [placeholder — to be set by the school&apos;s accountant]
              </span>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              Payments and confirmation
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              A payment always goes directly to the account shown in the
              message or on the pay page — never through EK Desk itself, and
              never through a third-party gateway. The school will never ask
              for a UPI PIN, one-time password, account password, or card
              details over WhatsApp, SMS, or this site. A guardian reporting
              a payment (by tapping &quot;I&apos;ve paid&quot; or replying on
              WhatsApp) creates a claim only — it counts as a payment only
              once a member of staff has checked the bank account and
              confirmed it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              Refunds and corrections
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Refunds and corrections to a payment are handled directly by
              the branch office, by bank transfer — contact{" "}
              <span className="font-medium text-ink">
                [placeholder — branch office contact details]
              </span>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Card payments</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Card payments are only ever taken in person at the office, on
              a card machine the school controls. EK Desk never asks for
              card details online, over WhatsApp, or by SMS, and a guardian
              should never send them through any of those channels even if
              asked.
            </p>
          </section>

          <section className="rounded-md border border-attention bg-attention-fill/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-attention">
              This section needs review by someone qualified in Indian
              data-protection law before this page is published externally —
              the DPDP Rules, 2025 commencement timeline should be confirmed
              at that time.
            </p>
            <h2 className="mt-3 text-lg font-medium text-ink">
              Your data under the DPDP Act, 2023
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Some of the information above is a child&apos;s personal data,
              provided by a parent or guardian. The school operating EK Desk
              is the data fiduciary for that information. Supabase (database
              hosting) and Vercel (application hosting) act as data
              processors on the school&apos;s behalf, solely to provide that
              infrastructure. A parent or guardian who wants to access,
              correct, or ask for erasure of their child&apos;s information
              should contact their branch office directly, as described
              under &quot;Requesting a correction&quot; below — EK Desk does
              not claim to be, and should not be described as, &quot;DPDP
              compliant.&quot;
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              Where it&apos;s stored
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Data is stored in a managed Postgres database provided by{" "}
              <a
                href="https://supabase.com"
                className="text-accent hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Supabase
              </a>
              , and the application itself is hosted on{" "}
              <a
                href="https://vercel.com"
                className="text-accent hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Vercel
              </a>
              . Both are the only third parties with any technical access to
              this data, solely as infrastructure providers — neither uses it
              for their own purposes. All traffic to and from EK Desk is
              encrypted in transit (HTTPS).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">How long it&apos;s kept</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Student and payment records are kept for as long as the school
              needs them for its own financial and enrollment record-keeping.
              Payment records are never edited or deleted once entered — a
              correction is recorded as a separate, linked entry so the
              original stays visible, the same way a bank statement handles a
              reversal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">
              Requesting a correction
            </h2>
            <p className="mt-3 text-sm text-ink-secondary">
              A parent or guardian who believes their child&apos;s information
              is incorrect, or wants to know what&apos;s on file, should
              contact their branch office directly rather than this tool
              itself — EK Desk has no parent-facing login, and corrections go
              through school staff.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Questions</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              For anything else about this policy or how EK Desk handles
              data, contact{" "}
              <a
                href="mailto:tarunb013254@gmail.com"
                className="text-accent hover:underline"
              >
                tarunb013254@gmail.com
              </a>
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
