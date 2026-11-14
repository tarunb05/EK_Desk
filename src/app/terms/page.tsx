import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage, type LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description:
    "The terms a member of staff agrees to by using an EK Desk login.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "who-this-is-for",
    title: "Who this is for",
    body: (
      <>
        <p>
          Access is limited to the school&apos;s own admin and teaching staff.
          Every account is created by an administrator for a named person. There
          is no self-service sign-up.
        </p>
        <p>
          An account is for the person it was created for. Sharing a username
          and password with anyone else, including a colleague, is not allowed.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <ul>
        <li>
          Use EK Desk only for school business: managing students, fee accounts,
          payments and expenses.
        </li>
        <li>
          Do not export, copy, photograph or otherwise take student or family
          information out of the tool beyond what your role requires.
        </li>
        <li>
          Do not try to reach another branch&apos;s records or another
          person&apos;s account.
        </li>
        <li>
          Tell an administrator straight away if you think a login has been
          compromised, or if you can see data you should not be able to see.
        </li>
      </ul>
    ),
  },
  {
    id: "accuracy",
    title: "Accuracy of records",
    body: (
      <>
        <p>
          The figures in EK Desk are only as accurate as what staff enter.
          Students, fee accounts, payments and expenses are recorded directly by
          whoever enters them and are expected to reflect real transactions.
        </p>
        <p>
          A payment cannot be edited or deleted. A mistake is corrected by
          voiding the entry with a reason, and both stay on record. Deleting a
          student needs an administrator&apos;s approval.
        </p>
      </>
    ),
  },
  {
    id: "activity-log",
    title: "Your actions are logged",
    body: (
      <p>
        Every change to a student, fee account, payment or expense is recorded
        automatically with the name of the person who made it and the time.
        Administrators can read this log. It cannot be switched off or edited.
      </p>
    ),
  },
  {
    id: "payment-requests",
    title: "Payment requests and confirmation",
    body: (
      <>
        <p>
          A payment request sent to a guardian, and anything they report through
          the pay page or WhatsApp, is a claim only. It becomes a recorded
          payment once a member of staff has checked the bank account and
          confirmed it.
        </p>
        <p>
          Money always moves directly between the guardian and the school&apos;s
          own account. EK Desk never handles or holds funds. Card payments are
          accepted in person at the office only, never online or through this
          tool.
        </p>
      </>
    ),
  },
  {
    id: "no-warranty",
    title: "Provided as it is",
    body: (
      <p>
        EK Desk is an internal working tool. It comes with no warranty of
        uninterrupted availability or of fitness for any purpose beyond what it
        is built to do. Treat it as a record-keeping aid, not as a substitute
        for the school&apos;s own financial controls and judgement.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        These terms may be updated as the tool changes. Continuing to use a
        login after an update means accepting the current version, shown here
        with the date it was last updated.
      </p>
    ),
  },
  {
    id: "questions",
    title: "Questions",
    body: (
      <p>
        For anything about these terms, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. How personal
        data is handled is covered in the{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and conditions"
      updated="November 2026"
      intro={
        <>
          EK Desk is an internal tool built for one preschool&apos;s transport
          and daycare fee management. It is not a public service. Using a login
          means agreeing to the terms below.
        </>
      }
      sections={SECTIONS}
      other={{ href: "/privacy", label: "Privacy policy" }}
    />
  );
}
