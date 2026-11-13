const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parts(iso: string): { year: string; month: string; day: number } {
  const [year = "", month = "1", day = "1"] = iso.split("-");
  return {
    year,
    month: MONTHS[Number(month) - 1] ?? month,
    day: Number(day),
  };
}

// "11 Nov – 10 Dec 2026" within one year, "20 Dec 2026 – 19 Jan 2027" across
// two, and a single date when a stint is one day long.
export function formatDateRange(startsOn: string, endsOn: string): string {
  const start = parts(startsOn);
  const end = parts(endsOn);
  const endText = `${end.day} ${end.month} ${end.year}`;
  if (startsOn === endsOn) return endText;
  if (start.year === end.year) {
    return `${start.day} ${start.month} – ${endText}`;
  }
  return `${start.day} ${start.month} ${start.year} – ${endText}`;
}

const SERVICE_NAME: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

// How one enrollment is named inside the Students list's Actions menu, so a
// student with several can be told apart: daycare by the dates of the stint
// (a student can have several in one year), transport by academic year (it
// runs the whole year).
export function enrollmentLabel(enrollment: {
  serviceType: string;
  academicYearLabel: string;
  startsOn: string;
  endsOn: string;
  status: string;
}): string {
  const service =
    SERVICE_NAME[enrollment.serviceType] ?? enrollment.serviceType;
  const when =
    enrollment.serviceType === "daycare"
      ? formatDateRange(enrollment.startsOn, enrollment.endsOn)
      : enrollment.academicYearLabel;
  const suffix = enrollment.status === "discontinued" ? " (discontinued)" : "";
  return `${service} · ${when}${suffix}`;
}
