import { z } from "zod";

// Next.js page searchParams can carry a repeated key as string[]; only the
// first value is meaningful for year/branch, so flatten it here.
const singleParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (Array.isArray(value) ? value[0] : value));

export const shellSearchParamsSchema = z.object({
  year: singleParam,
  branch: singleParam,
});

export type ShellSearchParams = z.infer<typeof shellSearchParamsSchema>;
