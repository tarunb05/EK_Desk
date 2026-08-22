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
