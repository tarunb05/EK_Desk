import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentDetail } from "@/lib/records/student-detail";
import { StudentDrawer } from "@/components/records/student-drawer";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = {
  title: "Student",
};

export default async function InterceptedStudentDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const detail = await getStudentDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  return <StudentDrawer detail={detail} closeHref="/transport" role={role} />;
}
