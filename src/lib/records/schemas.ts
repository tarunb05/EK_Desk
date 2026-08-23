import { z } from "zod";
import { rupeesToPaise } from "@/lib/domain/money";
import { CLASS_SECTIONS } from "@/lib/records/class-sections";

const rupeesAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
    message: "Enter a valid, non-negative amount.",
  })
  .transform((value) => rupeesToPaise(Number(value)));

const dateField = z.string().min(1, "Choose a date.");

export const createStudentWithFeeAccountSchema = z
  .object({
    branchId: z.string().uuid("Choose a branch."),
    admissionNo: z.string().trim().min(1, "Enter an admission number."),
    fullName: z.string().trim().min(1, "Enter the student's name."),
    guardianName: z.string().trim().min(1, "Enter the guardian's name."),
    phone: z.string().trim().min(1, "Enter a phone number."),
    classSection: z.enum(CLASS_SECTIONS, "Choose a grade."),
    academicYearId: z.string().uuid(),
    serviceType: z.enum(["transport", "daycare"]),
    totalReceivable: rupeesAmount,
    dueDate: dateField,
    startsOn: dateField,
    endsOn: dateField,
    routeName: z.string().trim().optional(),
    pickupPoint: z.string().trim().optional(),
    slot: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.serviceType === "transport") {
      if (!value.pickupPoint) {
        ctx.addIssue({
          code: "custom",
          path: ["pickupPoint"],
          message: "Enter a pickup point.",
        });
      }
    } else {
      if (!value.slot) {
        ctx.addIssue({
          code: "custom",
          path: ["slot"],
          message: "Choose a slot.",
        });
      }
    }
  });

// Covers both the student's own details and the fee-account terms in one
// form/schema -- there was no student-detail edit UI at all before this,
// only fee-account terms; teacher edit-submissions and the admin's direct
// edit both need the full set, so one shared shape rather than two forks.
export const updateFeeAccountSchema = z.object({
  feeAccountId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Enter the student's name."),
  guardianName: z.string().trim().min(1, "Enter the guardian's name."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  classSection: z.enum(CLASS_SECTIONS, "Choose a grade."),
  notes: z.string().trim().optional(),
  totalReceivable: rupeesAmount,
  dueDate: dateField,
  startsOn: dateField,
  endsOn: dateField,
  status: z.enum(["active", "discontinued"]),
  routeName: z.string().trim().optional(),
  pickupPoint: z.string().trim().optional(),
  slot: z.string().trim().optional(),
});

export const recordPaymentSchema = z.object({
  feeAccountId: z.string().uuid(),
  amount: rupeesAmount,
  paidOn: dateField,
  method: z.enum(["cash", "upi", "cheque", "bank_transfer"]),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
  recordedBy: z.string().trim().min(1, "Enter who recorded this payment."),
});

export const voidPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  voidReason: z
    .string()
    .trim()
    .min(1, "Enter a reason for voiding this payment."),
});

export const archiveStudentSchema = z.object({
  studentId: z.string().uuid(),
  redirectTo: z.enum(["/transport", "/daycare"]),
});

export const SUBMISSION_TABLES = [
  "student_submission",
  "student_edit_submission",
  "payment_submission",
] as const;

export const approveSubmissionSchema = z.object({
  submissionTable: z.enum(SUBMISSION_TABLES),
  submissionId: z.string().uuid(),
});

export const rejectSubmissionSchema = z.object({
  submissionTable: z.enum(SUBMISSION_TABLES),
  submissionId: z.string().uuid(),
  reviewNote: z.string().trim().min(1, "Enter a reason for rejecting this."),
});
