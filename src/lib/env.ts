import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(
    `Missing or invalid environment variables: ${missing}. Copy .env.example to .env.local and fill them in.`,
  );
}

export const env = parsed.data;
