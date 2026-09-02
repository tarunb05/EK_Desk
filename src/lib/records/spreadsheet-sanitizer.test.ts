import { describe, expect, it } from "vitest";
import { sanitizeForSpreadsheet } from "./spreadsheet-sanitizer";

describe("sanitizeForSpreadsheet", () => {
  it("prefixes a formula-injection payload with a single quote", () => {
    expect(sanitizeForSpreadsheet("=cmd|'/c calc'!A1")).toBe(
      "'=cmd|'/c calc'!A1",
    );
  });

  it("prefixes every other formula-trigger character too", () => {
    expect(sanitizeForSpreadsheet("+1+1")).toBe("'+1+1");
    expect(sanitizeForSpreadsheet("-1-1")).toBe("'-1-1");
    expect(sanitizeForSpreadsheet("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(sanitizeForSpreadsheet("\tsneaky")).toBe("'\tsneaky");
    expect(sanitizeForSpreadsheet("\rsneaky")).toBe("'\rsneaky");
  });

  it("leaves an ordinary name untouched", () => {
    expect(sanitizeForSpreadsheet("Aarav Sharma")).toBe("Aarav Sharma");
  });

  it("leaves an empty string untouched", () => {
    expect(sanitizeForSpreadsheet("")).toBe("");
  });

  it("doesn't flag a hyphen or plus sign in the middle of a name", () => {
    expect(sanitizeForSpreadsheet("Anna-Marie")).toBe("Anna-Marie");
  });
});
