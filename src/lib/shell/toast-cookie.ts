import { cookies } from "next/headers";

// One-shot flash message for a Server Action that redirect()s on success --
// redirect() throws before any code after it runs (client-side included),
// so there's no state left to react to the normal way once navigation has
// already happened server-side. Mirrors the route_restricted_notice cookie
// in lib/supabase/middleware.ts: set here right before redirect(), read and
// cleared once by ToastProvider on whatever page the redirect lands on. A
// short expiry keeps a never-read cookie (e.g. the tab closed mid-redirect)
// harmless.
export const TOAST_COOKIE_NAME = "toast_notice";

export async function setToastNotice(message: string): Promise<void> {
  // No manual encodeURIComponent here -- next/headers' cookie serializer
  // already percent-encodes the value it writes into Set-Cookie, so this
  // pairs with a single decodeURIComponent on the read side (see
  // toast-notice-reader.tsx). Encoding it again here double-encodes it
  // (spaces would arrive as the literal text "%20").
  (await cookies()).set(TOAST_COOKIE_NAME, message, {
    maxAge: 10,
    path: "/",
  });
}
