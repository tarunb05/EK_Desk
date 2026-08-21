import { describe, expect, it } from "vitest";
import {
  createStudentWithFeeAccountSchema,
  recordPaymentSchema,
  updateFeeAccountSchema,
  voidPaymentSchema,
} from "./schemas";

const validTransportStudent = {
  branchId: "11111111-1111-4111-8111-111111111111",
  admissionNo: "BR-A-0001",
  fullName: "Aarav Sharma",
  guardianName: "Priya Sharma",
  phone: "9876543210",
  classSection: "Nursery",
  academicYearId: "22222222-2222-4222-8222-222222222222",
  serviceType: "transport" as const,
  totalReceivable: "12000",
  dueDate: "2026-06-01",
  startsOn: "2026-04-01",
  endsOn: "2027-03-31",
  routeName: "Route 1",
  pickupPoint: "Main Gate",
};

describe("createStudentWithFeeAccountSchema", () => {
  it("accepts a valid transport submission and converts rupees to paise", () => {
    const result = createStudentWithFeeAccountSchema.parse(
      validTransportStudent,
    );
    expect(result.totalReceivable).toBe(1_200_000n);
  });

  it("accepts a valid daycare submission with a slot instead of a route", () => {
    const result = createStudentWithFeeAccountSchema.parse({
      ...validTransportStudent,
      serviceType: "daycare",
      routeName: undefined,
      pickupPoint: undefined,
      slot: "Morning (8-1)",
    });
    expect(result.slot).toBe("Morning (8-1)");
  });

  it("rejects a transport submission missing a route", () => {
    const result = createStudentWithFeeAccountSchema.safeParse({
      ...validTransportStudent,
      routeName: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a daycare submission missing a slot", () => {
    const result = createStudentWithFeeAccountSchema.safeParse({
      ...validTransportStudent,
      serviceType: "daycare",
      routeName: undefined,
      pickupPoint: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative receivable amount", () => {
    const result = createStudentWithFeeAccountSchema.safeParse({
      ...validTransportStudent,
      totalReceivable: "-100",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing student name", () => {
    const result = createStudentWithFeeAccountSchema.safeParse({
      ...validTransportStudent,
      fullName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFeeAccountSchema", () => {
  it("accepts a valid update", () => {
    const result = updateFeeAccountSchema.parse({
      feeAccountId: "33333333-3333-4333-8333-333333333333",
      totalReceivable: "15000",
      dueDate: "2026-07-01",
      startsOn: "2026-04-01",
      endsOn: "2027-03-31",
      status: "active",
    });
    expect(result.totalReceivable).toBe(1_500_000n);
  });

  it("rejects an invalid status", () => {
    const result = updateFeeAccountSchema.safeParse({
      feeAccountId: "33333333-3333-4333-8333-333333333333",
      totalReceivable: "15000",
      dueDate: "2026-07-01",
      startsOn: "2026-04-01",
      endsOn: "2027-03-31",
      status: "bogus",
    });
    expect(result.success).toBe(false);
  });
});

describe("recordPaymentSchema", () => {
  it("accepts a valid payment and converts rupees to paise", () => {
    const result = recordPaymentSchema.parse({
      feeAccountId: "33333333-3333-4333-8333-333333333333",
      amount: "5000",
      paidOn: "2026-06-01",
      method: "upi",
      recordedBy: "front_office",
    });
    expect(result.amount).toBe(500_000n);
  });

  it("rejects a missing recordedBy", () => {
    const result = recordPaymentSchema.safeParse({
      feeAccountId: "33333333-3333-4333-8333-333333333333",
      amount: "5000",
      paidOn: "2026-06-01",
      method: "upi",
      recordedBy: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid payment method", () => {
    const result = recordPaymentSchema.safeParse({
      feeAccountId: "33333333-3333-4333-8333-333333333333",
      amount: "5000",
      paidOn: "2026-06-01",
      method: "bitcoin",
      recordedBy: "front_office",
    });
    expect(result.success).toBe(false);
  });
});

describe("voidPaymentSchema", () => {
  it("accepts a valid void request", () => {
    const result = voidPaymentSchema.parse({
      paymentId: "44444444-4444-4444-8444-444444444444",
      voidReason: "Recorded against the wrong student",
    });
    expect(result.voidReason).toBe("Recorded against the wrong student");
  });

  it("rejects an empty void reason", () => {
    const result = voidPaymentSchema.safeParse({
      paymentId: "44444444-4444-4444-8444-444444444444",
      voidReason: "",
    });
    expect(result.success).toBe(false);
  });
});
