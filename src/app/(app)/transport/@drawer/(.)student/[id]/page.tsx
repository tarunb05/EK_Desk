import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentDetail } from "@/lib/records/student-detail";
import { StudentDrawer } from "@/components/records/student-drawer";

export default async function InterceptedStudentDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const detail = await getStudentDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  return <StudentDrawer detail={detail} closeHref="/transport" />;
}
