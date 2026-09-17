export interface PaymentRequestMessageInput {
  branchName: string;
  serviceLabel: string;
  childFirstName: string;
  amountDisplay: string;
  dueDateDisplay: string;
  referenceCode: string;
  payPageUrl: string;
  upi: { upiId: string; payeeName: string } | null;
  bank: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
  } | null;
}

// The brief's own template puts the pay-page URL only inside the UPI block
// ("QR code and pay button: <url>") -- but the closing line ("tap 'I've
// paid' on the link above") applies regardless of which method was
// offered, so a bank-only request still needs the link surfaced somewhere.
// Handled here with its own line in that case, rather than silently
// dropping the link a bank-only parent would need to report their payment.
export function buildPaymentRequestMessage(
  input: PaymentRequestMessageInput,
): string {
  const blocks: string[] = [
    [
      `EuroKids ${input.branchName} – ${input.serviceLabel} fee`,
      `For: ${input.childFirstName}`,
      `Amount: ${input.amountDisplay}   Pay by: ${input.dueDateDisplay}`,
      `Reference: ${input.referenceCode}  (please add this in the payment note)`,
    ].join("\n"),
  ];

  if (input.upi) {
    blocks.push(
      [
        `Pay by UPI: ${input.upi.upiId}`,
        `Payee name shown: ${input.upi.payeeName}`,
        `QR code and pay button: ${input.payPageUrl}`,
      ].join("\n"),
    );
  }

  if (input.bank) {
    blocks.push(
      [
        "Bank transfer:",
        `${input.bank.accountHolder}, ${input.bank.bankName}`,
        `A/c ${input.bank.accountNumber}, IFSC ${input.bank.ifsc}`,
      ].join("\n"),
    );
  }

  if (!input.upi) {
    blocks.push(`Report your payment here once paid: ${input.payPageUrl}`);
  }

  blocks.push(
    [
      `After paying, tap "I've paid" on the link above, or reply here with the UTR number.`,
      "The school will never ask for your UPI PIN, OTP or card details.",
    ].join("\n"),
  );

  return blocks.join("\n\n");
}

export interface PaymentReminderMessageInput {
  amountDisplay: string;
  dueDateDisplay: string;
  referenceCode: string;
  payPageUrl: string;
}

// Shorter by design (brief: "the amount, reference, due date and link"),
// not because sms:'s length limit forces it here -- the SMS builder handles
// that separately.
export function buildPaymentReminderMessage(
  input: PaymentReminderMessageInput,
): string {
  return [
    "Reminder: fee payment pending",
    `Amount: ${input.amountDisplay}   Pay by: ${input.dueDateDisplay}`,
    `Reference: ${input.referenceCode}`,
    input.payPageUrl,
  ].join("\n");
}
