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
