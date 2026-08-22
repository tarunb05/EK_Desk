import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Applies to every route — this is a back-office admin tool with no
        // public pages, so a single strict policy for the whole app is
        // simpler and safer than trying to scope it per-route.
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
    ];
  },
};

export default nextConfig;
