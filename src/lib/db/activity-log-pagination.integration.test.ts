import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, withRollback } from "./test-helpers";

// Phase 12.2: the activity log's keyset pagination. Inserted directly as
// rows (bypassing log_activity(), which owns phase 12.1's capture
// correctness) with fully controlled occurred_at values, so the ordering
// and cursor math can be tested independent of whatever the trigger writes
// -- and so this test controls the exact "a new row arrives between the
// two requests" scenario the whole point of keyset over OFFSET rests on.
describe("activity log keyset pagination (phase 12.2)", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  async function insertRow(client: Client, occurredAt: string) {
    const result = await client.query<{ id: number; occurred_at: string }>(
      `insert into activity_log (occurred_at, actor_label, action, entity, entity_label, summary)
       values ($1, 'Test Admin', 'create', 'student', 'Pagination Test', 'test row')
       returning id, occurred_at`,
      [occurredAt],
    );
    return result.rows[0]!;
  }

  // The exact filter getActivityLogPage builds: (occurred_at, id) <
  // (cursor.occurred_at, cursor.id), expressed as PostgREST's .or() would,
  // but run here as plain SQL to isolate the ordering/cursor logic from
  // the HTTP layer.
  async function fetchPage(
    client: Client,
    cursor: { occurredAt: string; id: number } | null,
    limit: number,
  ) {
    // Scoped to this test's own rows -- the seeded data and every other
    // test's rows (running in the same, un-isolated table) share this
    // table, and a plain "top 3 overall" would just return whichever of
    // those happens to sort first instead of exercising this test's own
    // fixture.
    if (!cursor) {
      const result = await client.query<{ id: number }>(
        `select id from activity_log
         where entity_label = 'Pagination Test'
         order by occurred_at desc, id desc
         limit $1`,
        [limit],
      );
      return result.rows.map((r) => r.id);
    }
    const result = await client.query<{ id: number }>(
      `select id from activity_log
       where entity_label = 'Pagination Test'
         and (occurred_at < $1 or (occurred_at = $1 and id < $2))
       order by occurred_at desc, id desc
       limit $3`,
      [cursor.occurredAt, cursor.id, limit],
    );
    return result.rows.map((r) => r.id);
  }

  it("returns page 2 with no overlap and no gap when a new row is inserted between the two requests", async () => {
    await withRollback(client, async () => {
      const r1 = await insertRow(client, "2026-01-01T00:00:01Z");
      const r2 = await insertRow(client, "2026-01-01T00:00:02Z");
      const r3 = await insertRow(client, "2026-01-01T00:00:03Z");
      const r4 = await insertRow(client, "2026-01-01T00:00:04Z");
      const r5 = await insertRow(client, "2026-01-01T00:00:05Z");
      const r6 = await insertRow(client, "2026-01-01T00:00:06Z");

      const page1 = await fetchPage(client, null, 3);
      expect(page1).toEqual([r6.id, r5.id, r4.id]);

      const cursor = { occurredAt: r4.occurred_at, id: r4.id };

      // A new row arrives between the two requests -- newer than
      // everything already on page 1, so it belongs on page 1 (which has
      // already been shown), not page 2. An OFFSET-based page 2
      // (OFFSET 3 LIMIT 3, computed by position) would now return
      // [r4, r3, r2] -- r4 duplicated from page 1 -- because the new row
      // shifted everyone's position down by one. Keyset can't do that: the
      // cursor is a value, not a position.
      await insertRow(client, "2026-01-01T00:00:07Z");

      const page2 = await fetchPage(client, cursor, 3);
      expect(page2).toEqual([r3.id, r2.id, r1.id]);

      // No overlap with page 1, no gap between them.
      expect(page2).not.toContain(r4.id);
      const seen = new Set([...page1, ...page2]);
      expect(seen.size).toBe(page1.length + page2.length);
      expect(seen).toEqual(new Set([r1.id, r2.id, r3.id, r4.id, r5.id, r6.id]));
    });
  });

  it("orders (same occurred_at, higher id) first -- the tiebreak a cascade delete needs", async () => {
    await withRollback(client, async () => {
      const sameInstant = "2026-01-01T12:00:00Z";
      const a = await insertRow(client, sameInstant);
      const b = await insertRow(client, sameInstant);
      const c = await insertRow(client, sameInstant);

      const page = await fetchPage(client, null, 3);
      // Same timestamp for all three (one transaction's cascade, in
      // practice) -- id desc is the only thing making the order
      // deterministic instead of "whatever order Postgres feels like."
      expect(page).toEqual([c.id, b.id, a.id]);
    });
  });
});
