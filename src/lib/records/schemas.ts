import { z } from "zod";
import { MONEY_METHODS, parseRupeesToPaise, rupeesToPaise } from "@/lib/domain/money";
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

// Stricter than rupeesAmount above on purpose (no Number()/parseFloat in the
// parse path -- see parseRupeesToPaise) -- new code, not a weaker copy of
// the pattern payment already uses.
const expenseRupeesAmount = z
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
    if (paise <= 0n) {
      ctx.addIssue({
        code: "custom",
        message: "Enter an amount greater than zero.",
      });
      return z.NEVER;
    }
    return paise;
  });

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
  method: z.enum(MONEY_METHODS),
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
  redirectTo: z.enum(["/transport", "/daycare", "/students"]),
});

export const updateStudentStatusSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["active", "inactive", "withdrawn"]),
});

export const permanentlyDeleteStudentSchema = z.object({
  studentId: z.string().uuid(),
});

export const requestStudentDeleteSchema = z.object({
  studentId: z.string().uuid(),
});

export const updateFeeAccountStatusSchema = z.object({
  feeAccountId: z.string().uuid(),
  status: z.enum(["active", "discontinued"]),
});

export const SUBMISSION_TABLES = [
  "student_submission",
  "student_edit_submission",
  "payment_submission",
  "student_delete_submission",
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

// branchId is optional here, not required -- a teacher's form never renders
// the field at all (formEntries() simply won't include the key), and an
// admin omitting it is a business-rule check the Server Action makes after
// resolving the caller's role, the same way createStudentWithFeeAccount
// checks branch ownership after parsing rather than branching the schema
// itself on role.
export const recordExpenseSchema = z.object({
  categoryId: z.string().uuid("Choose a category."),
  amount: expenseRupeesAmount,
  spentOn: dateField,
  method: z.enum(MONEY_METHODS),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
  branchId: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
  confirmed: z.enum(["true"]).optional(),
});

export const updateExpenseSchema = recordExpenseSchema.extend({
  expenseId: z.string().uuid(),
});
