import { z } from "zod";
import { parseRupeesToPaise } from "@/lib/domain/money";
import { REQUEST_EXPIRY_DAYS } from "@/lib/domain/payment-request-expiry";

const rupeesAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .refine((value) => parseRupeesToPaise(value) !== null, {
    message: "Enter a valid amount.",
  });

const expiryDaysField = z
  .enum(REQUEST_EXPIRY_DAYS.map(String) as [string, ...string[]])
  .transform((value) => Number(value) as (typeof REQUEST_EXPIRY_DAYS)[number]);

export const createPaymentRequestSchema = z
  .object({
    feeAccountId: z.string().uuid(),
    collectionAccountId: z.string().uuid("Choose a collection account."),
    amount: rupeesAmount,
    // Checkboxes with no explicit value: "on" when checked, absent when
    // not -- same convention as collection_account's isActive field.
    includeUpi: z
      .string()
      .optional()
      .transform((value) => value === "on"),
    includeBank: z
      .string()
      .optional()
      .transform((value) => value === "on"),
    expiryDays: expiryDaysField,
    // Which of the student's two numbers (phone / whatsapp_phone) this
    // request goes to -- the dialog's radio picker, not a free-text field.
    phoneField: z.enum(["phone", "whatsappPhone"]),
  })
  .refine((v) => v.includeUpi || v.includeBank, {
    message: "Include at least one of UPI or bank details.",
    path: ["includeUpi"],
  });

export const sendReminderSchema = z.object({
  paymentRequestId: z.string().uuid(),
  phoneField: z.enum(["phone", "whatsappPhone"]),
});

export const markNumberUnreachableSchema = z.object({
  studentId: z.string().uuid(),
  phoneField: z.enum(["phone", "whatsappPhone"]),
});

export const recordShareChannelSchema = z.object({
  paymentRequestId: z.string().uuid(),
  sharedVia: z.enum(["whatsapp", "sms", "copied"]),
  sharedToLast4: z.string().max(4),
});

// The public pay page's claim form (Phase 15.4) -- token arrives as a
// hidden field (the page already has it in its own URL), not trusted from
// any session, since there is no session. Date bounds (no future, not
// before the request's own creation date) and the "already open" check
// both need server-side data this schema doesn't have, so they're enforced
// again in submit_payment_claim, not here -- this only rejects obviously
// malformed input before it reaches the database.
export const submitPaymentClaimSchema = z.object({
  token: z.string().min(1, "Missing token."),
  // A real UTR is 12 digits; a bank reference is rarely longer than a
  // couple dozen characters. This is the one field in the app an
  // unauthenticated visitor can write freely -- without a cap, a raw POST
  // (bypassing the input's own client-side limit entirely) could store an
  // arbitrarily large string here on every submission the rate limits
  // still allow through.
  utr: z
    .string()
    .trim()
    .min(1, "Enter the UTR or bank reference.")
    .max(50, "That doesn't look like a UTR or bank reference."),
  amount: rupeesAmount,
  paidOn: z.string().min(1, "Choose the date you paid."),
});
