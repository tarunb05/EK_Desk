import type { Metadata } from "next";
import { ServiceScopeDashboard } from "@/components/dashboard/service-scope-dashboard";

export const metadata: Metadata = {
  title: "Transport",
};

export default function TransportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ServiceScopeDashboard
      serviceType="transport"
      title="Transport"
      searchParams={searchParams}
    />
  );
}
