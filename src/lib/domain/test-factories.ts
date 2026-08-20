import type { AcademicYearRange, AgeingInput, Payment } from "./types";

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    amountPaise: 10_000n,
    paidOn: new Date(Date.UTC(2026, 0, 15)),
    voidedAt: null,
    ...overrides,
  };
}

export function makeAgeingInput(
  overrides: Partial<AgeingInput> = {},
): AgeingInput {
  return {
    pendingPaise: 5_000n,
    dueDate: new Date(Date.UTC(2026, 0, 10)),
    ...overrides,
  };
}

export function makeAcademicYear(
  overrides: Partial<AcademicYearRange> = {},
): AcademicYearRange {
  return {
    startsOn: new Date(Date.UTC(2026, 3, 1)),
    endsOn: new Date(Date.UTC(2027, 2, 31)),
    ...overrides,
  };
}
