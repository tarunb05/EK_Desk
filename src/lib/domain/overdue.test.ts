import { describe, expect, it } from "vitest";
import { ageingBucket, isOverdue } from "./overdue";

const asOf = new Date(Date.UTC(2026, 5, 15));
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (n: number) => new Date(asOf.getTime() - n * DAY_MS);
const daysAfter = (n: number) => new Date(asOf.getTime() + n * DAY_MS);

describe("isOverdue", () => {
  it("is not overdue when due today", () => {
    expect(isOverdue(5_000n, asOf, asOf)).toBe(false);
  });

  it("is overdue when due yesterday", () => {
    expect(isOverdue(5_000n, daysBefore(1), asOf)).toBe(true);
  });

  it("is not overdue when due tomorrow", () => {
    expect(isOverdue(5_000n, daysAfter(1), asOf)).toBe(false);
  });

  it("is not overdue when nothing is pending, even if the due date passed", () => {
    expect(isOverdue(0n, daysBefore(10), asOf)).toBe(false);
  });

  it("is not overdue when pending is negative (overpayment)", () => {
    expect(isOverdue(-1_000n, daysBefore(10), asOf)).toBe(false);
  });
});

describe("ageingBucket", () => {
  it("buckets a future due date as not yet due", () => {
    expect(ageingBucket(5_000n, daysAfter(5), asOf)).toBe("not_yet_due");
  });

  it("buckets a due-today account as not yet due", () => {
    expect(ageingBucket(5_000n, asOf, asOf)).toBe("not_yet_due");
  });

  it("buckets an account with nothing pending as not yet due regardless of date", () => {
    expect(ageingBucket(0n, daysBefore(90), asOf)).toBe("not_yet_due");
  });

  it("buckets 1 day overdue as 1-30", () => {
    expect(ageingBucket(5_000n, daysBefore(1), asOf)).toBe("1-30");
  });

  it("buckets 30 days overdue as 1-30", () => {
    expect(ageingBucket(5_000n, daysBefore(30), asOf)).toBe("1-30");
  });

  it("buckets 31 days overdue as 31-60", () => {
    expect(ageingBucket(5_000n, daysBefore(31), asOf)).toBe("31-60");
  });

  it("buckets 60 days overdue as 31-60", () => {
    expect(ageingBucket(5_000n, daysBefore(60), asOf)).toBe("31-60");
  });

  it("buckets 61 days overdue as 60+", () => {
    expect(ageingBucket(5_000n, daysBefore(61), asOf)).toBe("60+");
  });
});
