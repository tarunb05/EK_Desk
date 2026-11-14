import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage, type LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal data EK Desk holds, why it holds it, who can see it and how long it is kept.",
};

// Plain statements of what the app actually does, in the order a parent
// would ask them: what do you hold, why, who sees it, where is it, how long
// for, and how do I get it fixed. Every claim here matches a rule the
// database enforces (branch-scoped access, append-only payments, the
// admin-only activity log); if one of those rules changes, this page has to
// change with it.
const SECTIONS: LegalSection[] = [
  {
    id: "what-is-stored",
    title: "What is stored",
    body: (
      <ul>
        <li>
          <strong>Student records.</strong> Full name, guardian name, phone
          number, an optional WhatsApp number, class, admission number and
          enrollment status.
        </li>
        <li>
          <strong>Fee and payment records.</strong> The transport or daycare
          account (route and pickup point, or daycare slot, the amount
          receivable and the due date) and every payment recorded against it.
        </li>
        <li>
          <strong>Expense records.</strong> What the office spent, by category,
          branch and date. These do not identify any student or family.
        </li>
        <li>
          <strong>Staff logins.</strong> A username and a securely hashed
          password for each admin or teacher, and the branch a teacher belongs
          to.
        </li>
        <li>
          <strong>Activity log.</strong> Who created, edited or deleted a
          student, fee account, payment or expense, and when. It is an internal
          audit trail that only admins can read.
        </li>
      </ul>
    ),
  },
  {
    id: "why",
    title: "Why it is collected",
    body: (
      <p>
        Only to run the transport and daycare fee accounts these records belong
        to: tracking what is owed, what has been paid, what is overdue and what
        the office has spent. Nothing here is used for advertising or profiling,
        and nothing is sold or rented to anyone.
      </p>
    ),
  },
  {
    id: "who-can-see-it",
    title: "Who can see it",
    body: (
      <>
        <p>
          Access depends on role and branch, and it is enforced in the database
          itself, not only in what the screens show.
        </p>
        <ul>
          <li>An admin can see the records of every branch.</li>
          <li>
            A teacher can see only the students, fee accounts and payments of
            their own branch.
          </li>
          <li>
            A teacher can delete a student only after an admin approves it, and
            every change anyone makes is logged.
          </li>
          <li>
            Nobody outside the school&apos;s own admin and teaching staff has an
            account or any access.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "payment-requests",
    title: "Payment requests by WhatsApp and SMS",
    body: (
      <>
        <p>
          When the school asks for a fee payment, the message goes from the
          school&apos;s own phone to the guardian&apos;s number, over WhatsApp
          or, as a fallback, the mobile carrier&apos;s SMS service. It contains
          the amount due, a payment link and a reference code.
        </p>
        <p>
          WhatsApp and the carrier deliver that message the way they deliver any
          other. EK Desk records only that a message was sent, through which
          channel and to which number. It does not record whether it was
          delivered or read.
        </p>
      </>
    ),
  },
  {
    id: "pay-page",
    title: "The pay page",
    body: (
      <>
        <p>
          The link in a payment message opens a page showing the amount due and
          the school&apos;s payment details, and nothing else about the student
          or family. The link stops working after a short period, or as soon as
          the school confirms the payment.
        </p>
        <p>
          If a guardian reports having paid, the page collects only the payment
          reference (UTR or bank reference), the amount and the date they enter.
          There is no tracking, analytics or advertising script on that page.
        </p>
      </>
    ),
  },
  {
    id: "how-payments-work",
    title: "How payments are made and confirmed",
    body: (
      <>
        <p>
          A payment always goes straight to the school account shown in the
          message or on the pay page. It never passes through EK Desk and never
          through a third-party payment gateway.
        </p>
        <p>
          A guardian reporting a payment creates a claim only. It counts as a
          payment once a member of staff has checked the bank account and
          confirmed it.
        </p>
        <p>
          The school will never ask for a UPI PIN, a one-time password, an
          account password or card details over WhatsApp, SMS or this site. Card
          payments are taken only in person at the office, on a card machine the
          school controls.
        </p>
      </>
    ),
  },
  {
    id: "where-it-is-stored",
    title: "Where it is stored",
    body: (
      <p>
        Data is held in a managed Postgres database provided by{" "}
        <a href="https://supabase.com" target="_blank" rel="noreferrer">
          Supabase
        </a>
        , and the application is hosted on{" "}
        <a href="https://vercel.com" target="_blank" rel="noreferrer">
          Vercel
        </a>
        . They are the only third parties with technical access to this data,
        purely as infrastructure providers, and neither uses it for its own
        purposes. All traffic to and from EK Desk is encrypted in transit
        (HTTPS).
      </p>
    ),
  },
  {
    id: "how-long",
    title: "How long it is kept",
    body: (
      <>
        <p>
          Student, fee and payment records are kept for as long as the school
          needs them for its financial and enrollment record-keeping. Payment
          references and the school&apos;s own confirmation records (who checked
          the bank, when, and what was received) are kept as financial records
          on the same basis.
        </p>
        <p>
          A payment is never edited or deleted once entered. A correction is
          recorded as a separate, linked entry so the original stays visible,
          the way a bank statement shows a reversal.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "A child's data and the DPDP Act, 2023",
    body: (
      <>
        <p>
          Some of the information above is a child&apos;s personal data,
          provided by a parent or guardian. The school operating EK Desk is the
          data fiduciary for it. Supabase and Vercel act as data processors on
          the school&apos;s behalf, only to provide the infrastructure described
          above.
        </p>
        <p>
          A parent or guardian may ask to see what is held about their child, to
          have it corrected, or to have it erased where the school is not
          required to keep it. EK Desk makes no claim of certification under the
          Act.
        </p>
      </>
    ),
  },
  {
    id: "corrections-and-refunds",
    title: "Corrections and refunds",
    body: (
      <>
        <p>
          A parent or guardian who believes their child&apos;s information is
          wrong, or wants to know what is on file, should contact their branch
          office. EK Desk has no parent login, so corrections go through school
          staff.
        </p>
        <p>
          Refunds and corrections to a payment are also handled by the branch
          office, by bank transfer.
        </p>
      </>
    ),
  },
  {
    id: "questions",
    title: "Questions",
    body: (
      <p>
        For anything else about this policy or how EK Desk handles data, write
        to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="November 2026"
      intro={
        <>
          EK Desk is an internal fee and expense tool used by a preschool&apos;s
          transport and daycare staff. It has no public sign-up and is not a
          consumer product. This page says what personal data it holds, why, and
          who can see it.
        </>
      }
      sections={SECTIONS}
      other={{ href: "/terms", label: "Terms and conditions" }}
    />
  );
}
