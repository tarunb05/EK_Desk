import type { BalanceResult, Payment } from "./types";

export function calculateBalance(
  totalReceivablePaise: bigint,
  payments: Payment[],
): BalanceResult {
  const validPayments = payments.filter((payment) => payment.voidedAt === null);

  const collectedPaise = validPayments.reduce(
    (sum, payment) => sum + payment.amountPaise,
    0n,
  );

  const lastPaidOn = validPayments.reduce<Date | null>((latest, payment) => {
    if (latest === null || payment.paidOn > latest) {
      return payment.paidOn;
    }
    return latest;
  }, null);

  return {
    collectedPaise,
    pendingPaise: totalReceivablePaise - collectedPaise,
    lastPaidOn,
  };
}
