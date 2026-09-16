import { z } from "zod";

// Separate from src/lib/env.ts on purpose: that file's exports include the
// two NEXT_PUBLIC_ vars, and while nothing there is client-bundled today,
// keeping every Razorpay secret in its own module makes "does this ever
// reach a client bundle" a one-file question, not a whole-app one.
const razorpayEnvSchema = z.object({
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = razorpayEnvSchema.safeParse({
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
});

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(
    `Missing or invalid Razorpay environment variables: ${missing}. Copy .env.example to .env.local and fill them in.`,
  );
}

export const razorpayEnv = parsed.data;
