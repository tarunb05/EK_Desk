import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentDetail } from "@/lib/records/student-detail";
import { StudentDetailBody } from "@/components/records/student-detail-body";

export default async function StudentDetailPage({
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

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-medium text-ink">
        {detail.student.fullName}
      </h1>
      <StudentDetailBody detail={detail} />
    </div>
  );
}
