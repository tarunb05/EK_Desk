import { describe, expect, it } from "vitest";
import { decodeActivityLogCursor, encodeActivityLogCursor } from "./keyset-cursor";

describe("activity log keyset cursor", () => {
  it("round-trips through encode and decode", () => {
    const cursor = { occurredAt: "2026-08-29T10:13:18.805Z", id: 236 };
    const encoded = encodeActivityLogCursor(cursor);
    expect(decodeActivityLogCursor(encoded)).toEqual(cursor);
  });

  it("returns null for an undefined or empty cursor, without throwing", () => {
    expect(decodeActivityLogCursor(undefined)).toBeNull();
    expect(decodeActivityLogCursor("")).toBeNull();
  });

  it("returns null for a malformed cursor -- garbage base64, valid base64 that isn't JSON, and JSON missing a field -- never throws", () => {
    expect(decodeActivityLogCursor("not-valid-base64url-!!!")).toBeNull();
    expect(
      decodeActivityLogCursor(Buffer.from("not json").toString("base64url")),
    ).toBeNull();
    expect(
      decodeActivityLogCursor(
        Buffer.from(JSON.stringify({ occurredAt: "2026-08-29" })).toString(
          "base64url",
        ),
      ),
    ).toBeNull();
    expect(
      decodeActivityLogCursor(
        Buffer.from(JSON.stringify({ id: "not-a-number" })).toString(
          "base64url",
        ),
      ),
    ).toBeNull();
  });

  it("returns null for an array value (a repeated ?cursor= query param)", () => {
    expect(decodeActivityLogCursor(["a", "b"])).toBeNull();
  });
});
