import { formatMethod, formatPaise } from "@/lib/domain/money";
import type { StudentDetail } from "@/lib/records/student-detail";
import type { Role } from "@/lib/auth/routes";
import { todayInIndia } from "@/lib/domain/datetime";
import { formatDateRange } from "@/lib/domain/enrollment-label";
import { DaycareHistory } from "./daycare-history";
import { DeleteStudentButton } from "./delete-student-button";
import { RequestTimeline } from "./request-timeline";

export function StudentDetailBody({
  detail,
  redirectTo,
  role,
}: {
  detail: StudentDetail;
  redirectTo: "/transport" | "/daycare" | "/students";
  role: Role;
}) {
  const daycareAccounts = detail.feeAccounts.filter(
    (account) => account.serviceType === "daycare",
  );

  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Admission no.</dt>
        <dd className="text-ink">{detail.student.admissionNo}</dd>
        <dt className="text-ink-muted">Guardian</dt>
        <dd className="text-ink">{detail.student.guardianName}</dd>
        <dt className="text-ink-muted">Phone</dt>
        <dd className="text-ink">{detail.student.phone}</dd>
        <dt className="text-ink-muted">WhatsApp number</dt>
        <dd className="text-ink">{detail.student.whatsappPhone || "—"}</dd>
        <dt className="text-ink-muted">Class</dt>
        <dd className="text-ink">{detail.student.classSection}</dd>
        <dt className="text-ink-muted">Branch</dt>
        <dd className="text-ink">{detail.student.branchName}</dd>
        <dt className="text-ink-muted">Notes</dt>
        <dd className="text-ink">{detail.student.notes || "—"}</dd>
      </dl>

      {detail.student.status === "inactive" ? (
        <p className="mb-4 text-xs text-ink-muted">
          This student has been deleted. Their history stays visible here but
          they&rsquo;re excluded from dashboards and record tables.
        </p>
      ) : detail.student.status === "withdrawn" ? (
        <p className="mb-4 text-xs text-ink-muted">
          This student has withdrawn. Their history stays visible here but
          they&rsquo;re excluded from dashboards and record tables.
        </p>
      ) : role === "admin" ? (
        <div className="mb-6">
          <DeleteStudentButton
            studentId={detail.student.id}
            studentName={detail.student.fullName}
            redirectTo={redirectTo}
          />
        </div>
      ) : null}

      {daycareAccounts.length > 0 ? (
        <DaycareHistory accounts={daycareAccounts} today={todayInIndia()} />
      ) : null}

      {detail.feeAccounts.length === 0 ? (
        <p className="text-sm text-ink-muted">
          This student has no fee accounts yet.
        </p>
      ) : (
        detail.feeAccounts.map((account) => (
          <div key={account.feeAccountId} className="mb-6">
            <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
              {/* A daycare student can have several stints, so name each
                  by its dates; transport has one per year. */}
              {account.serviceType === "daycare"
                ? `daycare · ${formatDateRange(account.startsOn, account.endsOn)}`
                : account.serviceType}{" "}
              — pending {formatPaise(account.pendingPaise)}
            </h3>

            <RequestTimeline requests={account.paymentRequests} role={role} />

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
                      <td className="text-ink-secondary">
                        {payment.confirmedByLabel && payment.reference
                          ? `${formatMethod(payment.method)}, ref ending ${payment.reference.slice(-4)}, confirmed by ${payment.confirmedByLabel}`
                          : formatMethod(payment.method)}
                      </td>
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
                          // A teacher's copy of the page lives under
                          // /students, since /transport and /daycare are
                          // admin-only routes.
                          <a
                            href={
                              role === "admin"
                                ? `/${account.serviceType}/payment/${payment.id}/void`
                                : `/students/payment/${payment.id}/void`
                            }
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
