"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";
import { sessionOnlyCookieOptions } from "@/lib/supabase/session-only-cookie";
import { usernameToInternalEmail } from "@/lib/auth/username";
import { defaultRouteFor, type Role } from "@/lib/auth/routes";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

// Read by middleware.ts on a later token refresh, not just here — see the
// comment on the client below for why this exists at all.
const REMEMBER_ME_COOKIE = "remember_me";

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

  const rememberMe = formData.get("rememberMe") === "on";
  const cookieStore = await cookies();

  // A dedicated client instead of the shared createClient() helper — this
  // is the one call site where cookie persistence is a per-request choice
  // (the checkbox), not the app-wide default every other caller gets.
  // @supabase/ssr's own default cookie maxAge is 400 days (the maximum
  // Chrome allows), which is why every sign-in already survives closing
  // the browser today with no code here at all — unchecking "Remember me"
  // is what strips that back to a plain session cookie.
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(
              name,
              value,
              rememberMe ? options : sessionOnlyCookieOptions(options),
            );
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToInternalEmail(parsed.data.username),
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Incorrect username or password." };
  }

  // The access-token cookie is short-lived and middleware.ts silently
  // refreshes it on a later request once it expires -- that refresh writes
  // fresh cookies with @supabase/ssr's own defaults again, which would
  // quietly restore the 400-day persistence on the next page load after an
  // hour. This marker is what tells middleware.ts to keep stripping
  // maxAge on every later refresh too, not just this first write. Always
  // written explicitly either way, so a stale marker from a previous,
  // differently-answered login on this browser can never leak into this
  // one.
  if (rememberMe) {
    cookieStore.delete(REMEMBER_ME_COOKIE);
  } else {
    cookieStore.set(REMEMBER_ME_COOKIE, "0", { path: "/" });
  }

  const { data: role } = await supabase.rpc("auth_role");

  // auth_role() reads profile and filters on is_active -- a deactivated
  // login (Settings' "Delete" on a teacher archives them rather than
  // removing their auth.users row) still passes the password check above,
  // since that row is untouched. Without this, they'd see what looks like
  // a successful sign-in only to be bounced straight back to /login by
  // middleware on the next request, with no explanation. Sign back out
  // rather than leaving a live-but-useless session cookie in the browser.
  if (!role) {
    await supabase.auth.signOut();
    return {
      error: "This login has been disabled. Contact an administrator.",
    };
  }

  // redirect() from a Server Action resolves client-side rather than as a
  // fresh top-level navigation, so it doesn't necessarily re-run
  // middleware's own role check on the way there — this has to send each
  // role to a route they can actually reach itself, not rely on middleware
  // to catch a wrong guess afterward.
  redirect(defaultRouteFor(role as Role));
}
