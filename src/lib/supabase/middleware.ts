import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { sessionOnlyCookieOptions } from "@/lib/supabase/session-only-cookie";
import { defaultRouteFor, isRouteAllowed, type Role } from "@/lib/auth/routes";

// Next.js's own framework-injected inline scripts (the `self.__next_f.push(...)`
// RSC-hydration payload) have no `src` — a `script-src 'self'` CSP with no
// 'unsafe-inline' blocks them outright and silently kills hydration (dead
// forms, no interactivity). The documented fix is a per-request nonce: it
// goes on both the request (so the App Router's renderer picks it up and
// stamps it onto those scripts automatically) and the response's CSP header.
// https://nextjs.org/docs/app/guides/content-security-policy
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Per Next.js's documented pattern: pass the nonce header through via
  // NextResponse.next({ request: { headers } }), not by constructing a new
  // NextRequest — the original `request` object is still what every
  // `.cookies`/`.nextUrl` read below uses.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Rebuild from the just-mutated `request.headers` (not the
          // `requestHeaders` snapshot taken before this rotation) so a
          // refreshed auth cookie is actually part of what gets forwarded
          // to the page render — otherwise this response carries the
          // pre-rotation Cookie header even though the browser gets the
          // new one via Set-Cookie.
          const rotatedHeaders = new Headers(request.headers);
          rotatedHeaders.set("x-nonce", nonce);
          supabaseResponse = NextResponse.next({
            request: { headers: rotatedHeaders },
          });
          // A session-only sign-in (login/actions.ts) leaves this marker so
          // a token refresh here doesn't silently restore @supabase/ssr's
          // own 400-day default persistence on the cookies it rewrites.
          const remembered =
            request.cookies.get("remember_me")?.value !== "0";
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(
              name,
              value,
              remembered ? options : sessionOnlyCookieOptions(options),
            );
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // A role is resolved via the auth_role() RPC (security definer, reads
  // `profile`, returns nothing for a deactivated user) rather than reading
  // `profile` directly — no policy grants a non-admin session read access
  // to profile rows at all, including their own.
  let role: Role | null = null;
  if (user) {
    const { data } = await supabase.rpc("auth_role");
    role = (data as Role | null) ?? null;
  }

  // Authenticated but no resolvable role: a deactivated user, or a stale
  // session that predates their profile row. Treat identically to
  // unauthenticated rather than letting them through with no route check.
  if (user && !role && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  if (user && role && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = defaultRouteFor(role);
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  if (
    user &&
    role &&
    !isLoginRoute &&
    !isRouteAllowed(request.nextUrl.pathname, role)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = defaultRouteFor(role);
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    // One-shot flash cookie: the shared app layout reads this client-side
    // to show "that page isn't available for your account" once, then
    // deletes it. A 10s expiry means it's harmless even if never read.
    response.cookies.set("route_restricted_notice", "1", {
      maxAge: 10,
      path: "/",
    });
    return response;
  }

  supabaseResponse.headers.set("Content-Security-Policy", csp);
  return supabaseResponse;
}
