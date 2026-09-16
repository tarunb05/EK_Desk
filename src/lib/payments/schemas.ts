import { z } from "zod";
import { parseRupeesToPaise } from "@/lib/domain/money";
import { PAYMENT_LINK_EXPIRY_DAYS } from "@/lib/domain/payment-request";

// The stricter regex-based parser (money.ts), not recordPaymentSchema's
// looser Number()-based one -- this is a second real-money entry point
// that ends with a live Razorpay charge, matching expenseRupeesAmount's
// own precedent of "new code, not a weaker copy of the pattern payment
// already uses" (see that field's own comment).
const paymentLinkRupeesAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .transform((value, ctx) => {
    const paise = parseRupeesToPaise(value);
    if (paise === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid amount, like 1234.50.",
      });
      return z.NEVER;
    }
    return paise;
  });

export const createPaymentLinkSchema = z.object({
  feeAccountId: z.string().uuid(),
  amount: paymentLinkRupeesAmount,
  expiryDays: z
    .enum(PAYMENT_LINK_EXPIRY_DAYS.map(String) as [string, ...string[]])
    .transform((value) => Number(value) as (typeof PAYMENT_LINK_EXPIRY_DAYS)[number]),
});

export const cancelPaymentLinkSchema = z.object({
  paymentRequestId: z.string().uuid(),
});
