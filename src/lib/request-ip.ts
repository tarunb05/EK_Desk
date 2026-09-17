import { headers } from "next/headers";
import { createHash } from "node:crypto";

// Vercel (and most proxies) set x-forwarded-for to a comma-separated list
// with the real client first; local dev has no such header at all, so
// every request there hashes to the same fallback value -- fine for
// exercising the per-IP rate limit's shape without a real IP to test with.
export async function getClientIpHash(): Promise<Buffer> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(ip).digest();
}
