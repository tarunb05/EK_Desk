import { z } from "zod";
import { rupeesToPaise } from "@/lib/domain/money";

const rupeesAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
    message: "Enter a valid amount greater than zero.",
  })
  .transform((value) => rupeesToPaise(Number(value)));

const dateField = z.string().min(1, "Choose a date.");

export const confirmClaimSchema = z.object({
  claimId: z.string().uuid(),
  amount: rupeesAmount,
  paidOn: dateField,
  method: z.enum(["upi", "bank_transfer"]),
  checkedBank: z
    .string()
    .refine((value) => value === "on", {
      message: "Confirm you've checked this in the bank account.",
    }),
  closeRequest: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

export const rejectClaimSchema = z.object({
  claimId: z.string().uuid(),
  reason: z.string().trim().min(1, "Enter a reason for rejecting this claim."),
});

export const enterAndConfirmClaimSchema = z.object({
  paymentRequestId: z.string().uuid(),
  utr: z.string().trim().min(1, "Enter the UTR or bank reference.").max(50),
  claimedAmount: rupeesAmount,
  claimedPaidOn: dateField,
  amount: rupeesAmount,
  paidOn: dateField,
  method: z.enum(["upi", "bank_transfer"]),
  checkedBank: z
    .string()
    .refine((value) => value === "on", {
      message: "Confirm you've checked this in the bank account.",
    }),
  closeRequest: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});
