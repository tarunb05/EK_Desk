import { z } from "zod";
import {
  isValidAccountNumber,
  isValidIfsc,
  isValidUpiId,
} from "@/lib/domain/collection-account-validation";

export const createAcademicYearSchema = z
  .object({
    label: z.string().trim().min(1, "Enter a label."),
    startsOn: z.string().min(1, "Choose a start date."),
    endsOn: z.string().min(1, "Choose an end date."),
    isCurrent: z
      .string()
      .optional()
      .transform((value) => value === "on"),
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "End date must be after the start date.",
    path: ["endsOn"],
  });

export const updateAcademicYearSchema = z
  .object({
    yearId: z.string().uuid(),
    label: z.string().trim().min(1, "Enter a label."),
    startsOn: z.string().min(1, "Choose a start date."),
    endsOn: z.string().min(1, "Choose an end date."),
    isCurrent: z
      .string()
      .optional()
      .transform((value) => value === "on"),
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "End date must be after the start date.",
    path: ["endsOn"],
  });

export const createBranchSchema = z.object({
  code: z.string().trim().min(1, "Enter a branch code."),
  name: z.string().trim().min(1, "Enter a branch name."),
});

export const updateBranchSchema = z.object({
  branchId: z.string().uuid(),
  code: z.string().trim().min(1, "Enter a branch code."),
  name: z.string().trim().min(1, "Enter a branch name."),
  isActive: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

const usernameField = z
  .string()
  .trim()
  .min(1, "Enter a username.")
  .regex(
    /^[a-z0-9._-]+$/i,
    "Use only letters, numbers, dots, dashes, or underscores.",
  );

// Blank means "leave the password unchanged" on an edit -- only a non-empty
// value is validated against Supabase Auth's own minimum.
const optionalNewPassword = z
  .string()
  .refine((value) => value === "" || value.length >= 6, {
    message: "Password must be at least 6 characters.",
  })
  .optional();

export const createTeacherSchema = z.object({
  username: usernameField,
  password: z.string().min(6, "Password must be at least 6 characters."),
  fullName: z.string().trim().min(1, "Enter the teacher's name."),
  branchId: z.string().uuid("Choose a branch."),
});

export const updateTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Enter the teacher's name."),
  username: usernameField,
  branchId: z.string().uuid("Choose a branch."),
  newPassword: optionalNewPassword,
});

export const deactivateTeacherSchema = z.object({
  teacherId: z.string().uuid(),
});

export const reactivateTeacherSchema = z.object({
  teacherId: z.string().uuid(),
});

export const hideTeacherSchema = z.object({
  teacherId: z.string().uuid(),
});

export const updateOwnCredentialsSchema = z.object({
  username: usernameField,
  newPassword: optionalNewPassword,
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, "Enter a category name."),
});

export const renameExpenseCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1, "Enter a category name."),
});

export const setExpenseCategoryActiveSchema = z.object({
  categoryId: z.string().uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const reorderExpenseCategorySchema = z.object({
  categoryId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const deleteExpenseCategorySchema = z.object({
  categoryId: z.string().uuid(),
});

// Shared shape for create and edit -- id is only present on an edit
// (createCollectionAccount/updateCollectionAccount branch on that, same
// convention this file uses elsewhere for optional trailing id fields).
const collectionAccountFields = {
  branchId: z.string().uuid("Choose a branch."),
  label: z.string().trim().min(1, "Enter a label."),
  upiId: z.string().trim().optional(),
  payeeName: z.string().trim().min(1, "Enter the payee name."),
  bankName: z.string().trim().optional(),
  accountHolder: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  confirmAccountNumber: z.string().trim().optional(),
  ifsc: z.string().trim().optional(),
  // A checkbox with no explicit value submits "on" when checked and is
  // simply absent from FormData when unchecked -- same convention as
  // updateBranchSchema's isActive, not setExpenseCategoryActiveSchema's
  // (that one's driven by a <Select>, which always sends an explicit value).
  isActive: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  // Re-authentication (Phase 15.2) -- checked server-side against
  // auth.users.encrypted_password via verify_current_password, never
  // against a client-supplied claim.
  currentPassword: z
    .string()
    .min(1, "Enter your password to confirm this change."),
};

// A shared generic helper over Zod's own .refine() loses enough type
// information that every callback's parameter collapses to `unknown` --
// a known rough edge in Zod's generics, not worth fighting for five small
// checks. Written out on each concrete schema instead.
type CollectionAccountFieldsInput = {
  upiId?: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  ifsc?: string;
};

function refineCollectionAccountFields<
  T extends z.ZodObject<z.ZodRawShape>,
>(schema: T) {
  return schema
    .refine(
      (v: CollectionAccountFieldsInput) =>
        Boolean(v.upiId) || Boolean(v.accountNumber),
      { message: "Enter a UPI ID or bank account details.", path: ["upiId"] },
    )
    .refine((v: CollectionAccountFieldsInput) => !v.upiId || isValidUpiId(v.upiId), {
      message: "Enter a valid UPI ID.",
      path: ["upiId"],
    })
    .refine((v: CollectionAccountFieldsInput) => !v.ifsc || isValidIfsc(v.ifsc), {
      message: "Enter a valid IFSC code.",
      path: ["ifsc"],
    })
    .refine(
      (v: CollectionAccountFieldsInput) =>
        !v.accountNumber || isValidAccountNumber(v.accountNumber),
      { message: "Enter a valid account number.", path: ["accountNumber"] },
    )
    .refine(
      (v: CollectionAccountFieldsInput) =>
        (v.accountNumber ?? "") === (v.confirmAccountNumber ?? ""),
      {
        message: "Account numbers don't match.",
        path: ["confirmAccountNumber"],
      },
    );
}

export const createCollectionAccountSchema = refineCollectionAccountFields(
  z.object(collectionAccountFields),
);

export const updateCollectionAccountSchema = refineCollectionAccountFields(
  z.object({ ...collectionAccountFields, accountId: z.string().uuid() }),
);

export const setDefaultCollectionAccountSchema = z.object({
  accountId: z.string().uuid(),
});
