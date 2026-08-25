import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentDetail } from "@/lib/records/student-detail";
import { StudentDetailBody } from "@/components/records/student-detail-body";
import { BackLink } from "@/components/shell/back-link";
import { requireRole } from "@/lib/auth/require-role";

export default async function StudentDetailPage({
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

  return (
    <div className="max-w-lg">
      <BackLink href="/daycare" />
      <h1 className="mb-4 text-xl font-medium text-ink">
        {detail.student.fullName}
      </h1>
      <StudentDetailBody detail={detail} redirectTo="/daycare" role={role} />
    </div>
  );
}
