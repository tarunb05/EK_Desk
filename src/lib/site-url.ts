// Needed the moment a Server Action has to embed an absolute URL in
// something sent outside the app (a WhatsApp/SMS message, here) -- every
// other redirect in this app uses a relative path, which is why nothing
// like this existed before Phase 15. NEXT_PUBLIC_SITE_URL is the explicit
// override for Production; VERCEL_URL (auto-injected, host only, no
// protocol) covers Preview without needing a var set per-deployment; local
// dev falls back to localhost.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
