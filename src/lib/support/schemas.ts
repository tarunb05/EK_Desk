import { z } from "zod";

export const submitSupportRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Enter a message.")
    .max(2000, "Keep it under 2000 characters."),
});

export const resolveSupportRequestSchema = z.object({
  requestId: z.string().uuid(),
});
