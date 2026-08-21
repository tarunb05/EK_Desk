import { formatPaise } from "@/lib/domain/money";
import type { StudentDetail } from "@/lib/records/student-detail";

export function StudentDetailBody({ detail }: { detail: StudentDetail }) {
  return (
    <>
      <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Admission no.</dt>
        <dd className="text-ink">{detail.student.admissionNo}</dd>
        <dt className="text-ink-muted">Guardian</dt>
        <dd className="text-ink">{detail.student.guardianName}</dd>
        <dt className="text-ink-muted">Phone</dt>
        <dd className="text-ink">{detail.student.phone}</dd>
        <dt className="text-ink-muted">Class</dt>
        <dd className="text-ink">{detail.student.classSection}</dd>
        <dt className="text-ink-muted">Branch</dt>
        <dd className="text-ink">{detail.student.branchName}</dd>
      </dl>

      {detail.feeAccounts.length === 0 ? (
        <p className="text-sm text-ink-muted">
          This student has no fee accounts yet.
        </p>
      ) : (
        detail.feeAccounts.map((account) => (
          <div key={account.feeAccountId} className="mb-6">
            <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
              {account.serviceType} — pending{" "}
              {formatPaise(account.pendingPaise)}
            </h3>
            {account.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No payments recorded yet.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="h-8 border-b border-hairline text-2xs uppercase tracking-wide text-ink-muted">
                    <th className="text-left">Date</th>
                    <th className="text-left">Method</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {account.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={`h-9 border-b border-hairline last:border-0 ${
                        payment.voidedAt ? "opacity-50" : ""
                      }`}
                    >
                      <td>{payment.paidOn}</td>
                      <td className="text-ink-secondary">{payment.method}</td>
                      <td className="text-right tabular-nums">
                        {formatPaise(payment.amountPaise)}
                      </td>
                      <td className="text-right tabular-nums">
                        {payment.voidedAt
                          ? "Voided"
                          : payment.runningPendingPaise !== null
                            ? formatPaise(payment.runningPendingPaise)
                            : "—"}
                      </td>
                      <td className="text-right">
                        {payment.voidedAt ? (
                          <span className="text-2xs text-ink-muted">
                            {payment.voidReason}
                          </span>
                        ) : (
                          // A plain anchor, not next/link's Link: this can be
                          // reached from inside the student drawer, and a
                          // client-side transition to a route the @drawer
                          // parallel slot doesn't intercept leaves the
                          // drawer's full-screen backdrop rendered on top of
                          // the void page. A full navigation resets it.
                          <a
                            href={`/${account.serviceType}/payment/${payment.id}/void`}
                            className="text-accent hover:underline"
                          >
                            Void
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </>
  );
}
