import { ServiceScopeDashboard } from "@/components/dashboard/service-scope-dashboard";

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
