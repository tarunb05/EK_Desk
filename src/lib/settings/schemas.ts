import { z } from "zod";

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

export const createBranchSchema = z.object({
  code: z.string().trim().min(1, "Enter a branch code."),
  name: z.string().trim().min(1, "Enter a branch name."),
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

export const deleteTeacherSchema = z.object({
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
