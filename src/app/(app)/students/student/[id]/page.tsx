import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentDetail } from "@/lib/records/student-detail";
import { StudentDetailBody } from "@/components/records/student-detail-body";
import { BackLink } from "@/components/shell/back-link";
import { requireAuth } from "@/lib/auth/require-role";

// Static rather than the student's own name -- see the transport variant of
// this page for why (avoids a second getStudentDetail() call).
export const metadata: Metadata = {
  title: "Student",
};

// Reachable by both roles -- unlike /transport/student/[id] and
// /daycare/student/[id] (admin-only, gated by ROUTE_ACCESS), this is the
// link the Students list itself uses, for admin and teacher alike. RLS
// already scopes what getStudentDetail can actually return for a teacher
// (their own branch only); StudentDetailBody hides the admin-only
// Delete/Void controls by role.
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await requireAuth();
  const { id } = await params;
  const supabase = await createClient();
  const detail = await getStudentDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="max-w-lg">
      <BackLink href="/students" label="Back to students" />
      <h1 className="mb-4 text-xl font-medium text-ink">
        {detail.student.fullName}
      </h1>
      <StudentDetailBody detail={detail} redirectTo="/students" role={role} />
    </div>
  );
}
