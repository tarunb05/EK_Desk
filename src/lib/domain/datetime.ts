// The one place a timestamptz (as opposed to the plain `date` columns
// everywhere else in this app) gets formatted for display -- the activity
// log is the first screen that needs to show *when* something happened,
// not just *what day*. Explicit Asia/Kolkata rather than the server's own
// timezone: this app runs for one Indian office, and a server that happens
// to run in UTC (the default almost everywhere it's hosted) would
// otherwise show a payment recorded at 2:30pm as having happened at 9:00am.
const LOG_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "29-Aug-2026 14:30" -- the exact shape the activity log's row asks for.
export function formatLogTimestamp(iso: string): string {
  const parts = LOG_TIMESTAMP_FORMATTER.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}

const LOG_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// Date only, no time -- for the empty state's "This log starts from ..."
// sentence, which names a day, not a moment.
export function formatLogDate(iso: string): string {
  const parts = LOG_DATE_FORMATTER.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`;
}

// "en-CA" formats as YYYY-MM-DD by locale convention -- the one built-in
// Intl locale that happens to match Postgres's own `date` column format,
// so no manual part-reassembly is needed the way the two formatters above
// need it for their en-GB display order.
const IST_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// For stamping a `date` column (payment.paid_on) from a gateway's UTC
// instant (Phase 15's webhook) -- a payment at 23:50 UTC has already
// crossed into the next calendar day in India (UTC+5:30), and storing the
// UTC calendar day instead would silently attribute it to the wrong day's
// collections.
export function toISTDateString(iso: string): string {
  return IST_DATE_KEY_FORMATTER.format(new Date(iso));
}
