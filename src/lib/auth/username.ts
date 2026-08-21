// Supabase Auth is email-based with no native username concept. Since this
// app has a single shared admin login (no public sign-up, no per-user
// accounts), the pragmatic fix is a fixed, non-routable internal domain —
// "nirmala" becomes "nirmala@login.internal" only for Supabase's own
// bookkeeping. Nothing is ever sent to that address; it's never shown to
// the user, who only ever sees/types the plain username.
const INTERNAL_EMAIL_DOMAIN = "login.internal";

export function usernameToInternalEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

// The inverse — for displaying who's signed in (e.g. next to Sign out)
// given the session's internal email.
export function internalEmailToUsername(email: string): string {
  return email.split("@")[0] ?? email;
}
