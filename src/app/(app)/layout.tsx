import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [years, branches] = await Promise.all([
    getAcademicYears(supabase),
    getBranches(supabase),
  ]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar years={years} branches={branches} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
