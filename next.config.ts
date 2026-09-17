import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Applies to every route. Most of this app is a back-office admin
        // tool behind a login, but a handful of routes (/, /login,
        // /privacy, /terms, and Phase 15's /p/[token] pay page) are
        // genuinely public -- this base policy is still the right default
        // for all of them, with /p/ layering stricter values below.
        //
        // Content-Security-Policy is deliberately NOT set here: it needs a
        // fresh nonce every request (for Next.js's own inline hydration
        // scripts), which a static config value can't provide. It's built
        // per-request in src/lib/supabase/middleware.ts instead.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // The pay page (brief section 4): never cached (it shows a live
        // status -- open/closed/expired -- that a stale cached copy would
        // get wrong) and never sends a Referer header onward (the URL
        // itself is a bearer credential; leaking it to whatever the parent
        // clicks next, even same-origin, is exactly the kind of exposure
        // the hash-only token storage is otherwise careful to avoid).
        // Placed after the block above so these two keys win here; noindex
        // /nofollow goes through the page's own metadata.robots instead of
        // a header.
        source: "/p/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
