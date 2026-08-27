import type { Metadata } from "next";
import { ServiceScopeDashboard } from "@/components/dashboard/service-scope-dashboard";

export const metadata: Metadata = {
  title: "Daycare",
};

export default function DaycarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ServiceScopeDashboard
      serviceType="daycare"
      title="Daycare"
      searchParams={searchParams}
    />
  );
}
