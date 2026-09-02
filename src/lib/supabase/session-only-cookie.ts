import type { CookieOptions } from "@supabase/ssr";

// @supabase/ssr's own default cookie maxAge is 400 days (the maximum
// Chrome allows) -- this is what turns one of its persistent cookies into
// a plain session cookie, cleared when the browser actually closes.
// Shared by login/actions.ts (the original "Remember me" unchecked write)
// and middleware.ts (every later token refresh has to keep making the
// same choice, or the next refresh silently restores persistence).
export function sessionOnlyCookieOptions(
  options: CookieOptions,
): CookieOptions {
  const stripped = { ...options };
  delete stripped.maxAge;
  delete stripped.expires;
  return stripped;
}
