"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export interface SignInState {
  error: string | null;
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Check your details and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect("/transport");
}
