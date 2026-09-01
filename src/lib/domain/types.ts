export interface Payment {
  amountPaise: bigint;
  paidOn: Date;
  voidedAt: Date | null;
}

export type AgeingBucket = "not_yet_due" | "1-30" | "31-60" | "60+";

export interface AcademicYearRange {
  startsOn: Date;
  endsOn: Date;
}

export interface BalanceResult {
  collectedPaise: bigint;
  pendingPaise: bigint;
  lastPaidOn: Date | null;
}
