import { z } from "zod";

// The activity log is the first list in this app to use keyset pagination
// instead of OFFSET (see Students/Expenses' PaginationControls) -- it has
// exactly one sort order, newest first, so a cursor on (occurred_at, id)
// composes perfectly where OFFSET's page-number model doesn't need to.
// Opaque to the URL on purpose: callers never construct or read the two
// fields themselves, only pass the encoded string through.
export interface ActivityLogCursor {
  occurredAt: string;
  id: number;
}

const cursorSchema = z.object({
  occurredAt: z.string().min(1),
  id: z.number().int(),
});

export function encodeActivityLogCursor(cursor: ActivityLogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

// Never throws -- a malformed or tampered ?cursor= value (a stale
// bookmark, a hand-edited URL) falls back to null (start from the top)
// rather than a 500, same convention as every other search param in this
// app falling back to its default on a bad value.
export function decodeActivityLogCursor(
  raw: string | string[] | undefined,
): ActivityLogCursor | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = cursorSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
