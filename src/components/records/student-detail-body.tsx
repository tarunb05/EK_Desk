import { formatMethod, formatPaise } from "@/lib/domain/money";
import type { StudentDetail } from "@/lib/records/student-detail";
import type { Role } from "@/lib/auth/routes";
import { formatDisplayDate, todayInIndia } from "@/lib/domain/datetime";
import { collectionRate } from "@/lib/domain/collection-rate";
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
  const today = todayInIndia();
  const facts: { label: string; value: string }[] = [
    { label: "Admission no.", value: detail.student.admissionNo },
    { label: "Class", value: detail.student.classSection },
    { label: "Branch", value: detail.student.branchName },
    { label: "Guardian", value: detail.student.guardianName },
    { label: "Phone", value: detail.student.phone },
    {
      label: "WhatsApp number",
      value: detail.student.whatsappPhone || "-",
    },
  ];

  return (
    <>
      {/* Label over value, three across -- six short facts read faster as
          a block than as a two-column list running down the page. */}
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-hairline bg-surface p-4 sm:grid-cols-3 md:p-5">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
              {fact.label}
            </dt>
            <dd className="mt-1 truncate text-sm text-ink tabular-nums">
              {fact.value}
            </dd>
          </div>
        ))}
        {detail.student.notes ? (
          <div className="col-span-full">
            <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
              Notes
            </dt>
            <dd className="mt-1 text-sm text-ink">{detail.student.notes}</dd>
          </div>
        ) : null}
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
        <DaycareHistory accounts={daycareAccounts} today={today} />
      ) : null}

      {detail.feeAccounts.length === 0 ? (
        <p className="text-sm text-ink-muted">
          This student has no fee accounts yet.
        </p>
      ) : (
        detail.feeAccounts.map((account) => {
          const rate = collectionRate(
            account.totalReceivablePaise,
            account.collectedPaise,
          );
          const isOverdue =
            account.pendingPaise > 0n && account.dueDate < today;
          return (
            <section
              key={account.feeAccountId}
              className="hover-card scroll-reveal mb-5 rounded-lg border border-hairline bg-surface p-4 md:p-5"
            >
              <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-medium text-ink">
                  <span className="rounded-full bg-sand px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.06em] text-ink">
                    {account.serviceType}
                  </span>
                  {/* A daycare student can have several stints, so name each
                    by its dates; transport has one per year. */}
                  {account.serviceType === "daycare" ? (
                    <span className="text-sm font-normal text-ink-secondary">
                      {formatDateRange(account.startsOn, account.endsOn)}
                    </span>
                  ) : null}
                </h3>
                {account.pendingPaise <= 0n ? (
                  <span className="text-sm text-positive">Paid in full</span>
                ) : (
                  <span
                    className={`text-sm ${isOverdue ? "font-medium text-attention" : "text-ink-secondary"}`}
                  >
                    {isOverdue ? "Overdue · was due " : "Due "}
                    {formatDisplayDate(account.dueDate)}
                  </span>
                )}
              </header>

              {/* The account at a glance: the three amounts, and how far
                along collection is as one bar. The payment rows below are
                the detail behind these. */}
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
                    Receivable
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                    {formatPaise(account.totalReceivablePaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
                    Collected
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-positive">
                    {formatPaise(account.collectedPaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
                    Pending
                  </dt>
                  <dd
                    className={`mt-1 text-lg font-semibold tabular-nums ${account.pendingPaise > 0n ? "text-attention" : "text-ink"}`}
                  >
                    {/* "pending ₹x" kept as one phrase for screen readers
                      and for anything matching on the old heading text. */}
                    <span className="sr-only">pending </span>
                    {formatPaise(account.pendingPaise)}
                  </dd>
                </div>
              </dl>
              <div
                role="img"
                aria-label={`${rate.toFixed(0)}% of this fee collected`}
                className="mb-5 mt-3 flex items-center gap-3"
              >
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                    className="h-full rounded-full bg-accent"
                  />
                </div>
                <span className="w-10 text-right text-sm tabular-nums text-ink-secondary">
                  {rate.toFixed(0)}%
                </span>
              </div>

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
                        <td className="tabular-nums">
                          {formatDisplayDate(payment.paidOn)}
                        </td>
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
                              : "-"}
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
            </section>
          );
        })
      )}
    </>
  );
}
