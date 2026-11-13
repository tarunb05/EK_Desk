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

// Today's date as "YYYY-MM-DD" in India, for comparing against the plain
// calendar dates (enrollment starts/ends) the app stores. Explicit
// Asia/Kolkata for the same reason as the log formatters above: a server
// running in UTC would otherwise call a stint "current" or "past" up to
// 5½ hours early or late. "en-CA" is just the locale that prints ISO order.
export function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
