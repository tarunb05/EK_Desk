import Link from "next/link";
import { formatPaise } from "@/lib/domain/money";
import type {
  AgeingBucket,
  AgeingBucketKey,
} from "@/lib/records/dashboard-queries";
import { ChartEmpty } from "./chart-card";

// The three overdue buckets are one hue stepping light to dark with age
// (the longer it has been owed, the heavier the bar); "not yet due" is the
// periwinkle the rest of the app uses for pending, since nothing in that
// bucket is late. Every bar has its name, its amount and its account count
// beside it, so the shade is reinforcement, never the only signal.
const BUCKETS: Record<AgeingBucketKey, { label: string; bar: string }> = {
  not_yet_due: { label: "Not yet due", bar: "bg-accent-fill" },
  "1-30": { label: "1–30 days late", bar: "bg-attention/45" },
  "31-60": { label: "31–60 days late", bar: "bg-attention/70" },
  "60+": { label: "Over 60 days late", bar: "bg-attention" },
};

// How old the pending money is. Always four rows in due-date order, even
// when a bucket is empty -- the order is the reading, and a row that
// disappears when it hits zero makes the chart mean something different
// from one week to the next.
//
// With hrefFor, each row that has accounts in it is a link to the list of
// those accounts (the dashboard passes it; the landing page's sample does
// not). An empty row stays plain text -- a link to an empty list is a dead
// end.
export function AgeingBars({
  buckets,
  hrefFor,
}: {
  buckets: AgeingBucket[];
  hrefFor?: (bucket: AgeingBucketKey) => string;
}) {
  const max = buckets.reduce(
    (m, b) => (b.pendingPaise > m ? b.pendingPaise : m),
    0n,
  );

  if (max === 0n) {
    return (
      <ChartEmpty>
        Nothing is pending in this scope. Every fee here is paid in full.
      </ChartEmpty>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {buckets.map((bucket) => {
        const config = BUCKETS[bucket.bucket];
        const widthPercent =
          bucket.pendingPaise > 0n
            ? Math.max((Number(bucket.pendingPaise) / Number(max)) * 100, 2)
            : 0;
        const href =
          hrefFor && bucket.accountCount > 0
            ? hrefFor(bucket.bucket)
            : undefined;
        const accounts = `${bucket.accountCount} ${bucket.accountCount === 1 ? "account" : "accounts"}`;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={`text-sm text-ink ${href ? "underline decoration-hairline underline-offset-4 transition-colors group-hover:decoration-accent" : ""}`}
              >
                {config.label}
              </span>
              <span className="whitespace-nowrap text-sm tabular-nums text-ink">
                {formatPaise(bucket.pendingPaise)}
                <span className="ml-2 text-xs text-ink-muted">{accounts}</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-canvas">
              {widthPercent > 0 ? (
                <div
                  style={{ width: `${widthPercent}%` }}
                  className={`h-full rounded-full ${config.bar}`}
                />
              ) : null}
            </div>
          </>
        );
        return (
          <li key={bucket.bucket}>
            {href ? (
              <Link
                href={href}
                aria-label={`${config.label}: ${formatPaise(bucket.pendingPaise)}, ${accounts}. Show these students`}
                className="group -mx-2 -my-1.5 flex flex-col gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {body}
              </Link>
            ) : (
              <div className="flex flex-col gap-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
