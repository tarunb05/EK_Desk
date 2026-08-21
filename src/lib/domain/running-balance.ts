import type { Payment } from "./types";

export interface RunningBalanceEntry<T extends Payment> {
  payment: T;
  runningPendingPaise: bigint | null;
}

export function computeRunningBalances<T extends Payment>(
  totalReceivablePaise: bigint,
  payments: T[],
): RunningBalanceEntry<T>[] {
  const sorted = [...payments].sort(
    (a, b) => a.paidOn.getTime() - b.paidOn.getTime(),
  );

  let collected = 0n;
  return sorted.map((payment) => {
    if (payment.voidedAt !== null) {
      return { payment, runningPendingPaise: null };
    }
    collected += payment.amountPaise;
    return { payment, runningPendingPaise: totalReceivablePaise - collected };
  });
}
