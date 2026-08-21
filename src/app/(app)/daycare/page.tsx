import { ServiceScopeDashboard } from "@/components/dashboard/service-scope-dashboard";

export default function DaycarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ServiceScopeDashboard
      serviceType="daycare"
      title="Daycare"
      groupByLabel="Slot"
      searchParams={searchParams}
    />
  );
}
