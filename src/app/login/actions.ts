"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { usernameToInternalEmail } from "@/lib/auth/username";
import { defaultRouteFor, type Role } from "@/lib/auth/routes";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

export interface SignInState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToInternalEmail(parsed.data.username),
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Incorrect username or password." };
  }

  // redirect() from a Server Action resolves client-side rather than as a
  // fresh top-level navigation, so it doesn't necessarily re-run
  // middleware's own role check on the way there — this has to send each
  // role to a route they can actually reach itself, not rely on middleware
  // to catch a wrong guess afterward.
  const { data: role } = await supabase.rpc("auth_role");
  redirect(defaultRouteFor((role as Role | null) ?? "admin"));
}
