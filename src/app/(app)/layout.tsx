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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-surface"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar years={years} branches={branches} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
