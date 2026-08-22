import { describe, expect, it } from "vitest";
import { escapePostgrestFilterValue } from "./student-directory";

describe("escapePostgrestFilterValue", () => {
  it("leaves plain search terms unchanged", () => {
    expect(escapePostgrestFilterValue("Sharma")).toBe("Sharma");
  });

  it("escapes a double quote so it can't close the quoted value early", () => {
    expect(escapePostgrestFilterValue('a"b')).toBe('a\\"b');
  });

  it("escapes a backslash so it can't be used to unescape a following quote", () => {
    expect(escapePostgrestFilterValue("a\\b")).toBe("a\\\\b");
  });

  it("neutralizes an attempted filter-injection payload", () => {
    // Before this fix, a search term like this closed the ilike clause via
    // the comma and appended an unrelated filter condition of the
    // attacker's choosing to the .or() expression.
    const payload = 'x",total_pending_paise.lt.0,full_name.ilike."%';
    const escaped = escapePostgrestFilterValue(payload);
    // The only quotes/backslashes present are the escaped ones we inserted
    // — no unescaped '"' survives to prematurely close the wrapping quotes.
    expect(escaped.match(/(?<!\\)"/g)).toBeNull();
  });
});
