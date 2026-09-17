import { describe, expect, it } from "vitest";
import {
  buildPaymentReminderMessage,
  buildPaymentRequestMessage,
} from "./payment-request-message";

const base = {
  branchName: "Kothanur",
  serviceLabel: "Transport",
  childFirstName: "Aarav",
  amountDisplay: "₹4,000",
  dueDateDisplay: "01 Jun 2026",
  referenceCode: "EK-7F3KQ",
  payPageUrl: "https://ekdesk.app/p/abc123",
};

describe("buildPaymentRequestMessage", () => {
  it("includes only the UPI block when bank is not selected", () => {
    const message = buildPaymentRequestMessage({
      ...base,
      upi: { upiId: "school@upi", payeeName: "EuroKids Kothanur" },
      bank: null,
    });
    expect(message).toContain("Pay by UPI: school@upi");
    expect(message).toContain("Payee name shown: EuroKids Kothanur");
    expect(message).toContain(`QR code and pay button: ${base.payPageUrl}`);
    expect(message).not.toContain("Bank transfer:");
  });

  it("includes only the bank block when UPI is not selected, and still surfaces the link", () => {
    const message = buildPaymentRequestMessage({
      ...base,
      upi: null,
      bank: {
        accountHolder: "EuroKids Kothanur",
        bankName: "HDFC Bank",
        accountNumber: "123456789012",
        ifsc: "HDFC0001234",
      },
    });
    expect(message).toContain("Bank transfer:");
    expect(message).toContain("EuroKids Kothanur, HDFC Bank");
    expect(message).toContain("A/c 123456789012, IFSC HDFC0001234");
    expect(message).not.toContain("Pay by UPI:");
    expect(message).toContain(base.payPageUrl);
  });

  it("includes both blocks when both are selected", () => {
    const message = buildPaymentRequestMessage({
      ...base,
      upi: { upiId: "school@upi", payeeName: "EuroKids Kothanur" },
      bank: {
        accountHolder: "EuroKids Kothanur",
        bankName: "HDFC Bank",
        accountNumber: "123456789012",
        ifsc: "HDFC0001234",
      },
    });
    expect(message).toContain("Pay by UPI:");
    expect(message).toContain("Bank transfer:");
  });

  it("always includes the reference code, amount, due date, and safety line", () => {
    const message = buildPaymentRequestMessage({
      ...base,
      upi: { upiId: "school@upi", payeeName: "EuroKids Kothanur" },
      bank: null,
    });
    expect(message).toContain("Reference: EK-7F3KQ");
    expect(message).toContain("Amount: ₹4,000");
    expect(message).toContain("Pay by: 01 Jun 2026");
    expect(message).toContain("will never ask for your UPI PIN, OTP or card details");
  });

  it("never contains an emoji or the child's full name", () => {
    const message = buildPaymentRequestMessage({
      ...base,
      upi: { upiId: "school@upi", payeeName: "EuroKids Kothanur" },
      bank: null,
    });
    expect(message).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    );
  });
});

describe("buildPaymentReminderMessage", () => {
  it("is shorter than the full request message and carries the essentials", () => {
    const full = buildPaymentRequestMessage({
      ...base,
      upi: { upiId: "school@upi", payeeName: "EuroKids Kothanur" },
      bank: null,
    });
    const reminder = buildPaymentReminderMessage(base);
    expect(reminder.length).toBeLessThan(full.length);
    expect(reminder).toContain("₹4,000");
    expect(reminder).toContain("EK-7F3KQ");
    expect(reminder).toContain("01 Jun 2026");
    expect(reminder).toContain(base.payPageUrl);
  });
});
