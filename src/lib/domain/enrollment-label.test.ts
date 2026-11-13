import { describe, expect, it } from "vitest";
import { enrollmentLabel, formatDateRange } from "./enrollment-label";

describe("formatDateRange", () => {
  it("shows the year once when both ends share it", () => {
    expect(formatDateRange("2026-11-11", "2026-12-10")).toBe(
      "11 Nov – 10 Dec 2026",
    );
  });

  it("shows both years when the stint crosses a year end", () => {
    expect(formatDateRange("2026-12-20", "2027-01-19")).toBe(
      "20 Dec 2026 – 19 Jan 2027",
    );
  });

  it("is a single date for a one-day stint", () => {
    expect(formatDateRange("2026-11-11", "2026-11-11")).toBe("11 Nov 2026");
  });
});

describe("enrollmentLabel", () => {
  const daycare = {
    serviceType: "daycare",
    academicYearLabel: "2026-27",
    startsOn: "2026-11-11",
    endsOn: "2026-12-10",
    status: "active",
  };

  it("names a daycare stint by its dates", () => {
    expect(enrollmentLabel(daycare)).toBe("Daycare · 11 Nov – 10 Dec 2026");
  });

  it("tells two stints in the same year apart", () => {
    const other = { ...daycare, startsOn: "2026-12-15", endsOn: "2026-12-21" };
    expect(enrollmentLabel(daycare)).not.toBe(enrollmentLabel(other));
  });

  it("names transport by its academic year", () => {
    expect(
      enrollmentLabel({
        serviceType: "transport",
        academicYearLabel: "2026-27",
        startsOn: "2026-04-01",
        endsOn: "2027-03-31",
        status: "active",
      }),
    ).toBe("Transport · 2026-27");
  });

  it("marks a discontinued enrollment", () => {
    expect(enrollmentLabel({ ...daycare, status: "discontinued" })).toBe(
      "Daycare · 11 Nov – 10 Dec 2026 (discontinued)",
    );
  });
});
