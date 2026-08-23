import type { z } from "zod";

// Zod's own .flatten().fieldErrors keeps every message per field; forms here
// only ever show one message per field (next to that field's label), so
// this keeps just the first issue per top-level field name instead.
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) {
      result[key] = issue.message;
    }
  }
  return result;
}
