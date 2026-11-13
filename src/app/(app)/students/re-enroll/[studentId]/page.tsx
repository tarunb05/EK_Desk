import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAcademicYears } from "@/lib/supabase/queries";
import { getReEnrollContext } from "@/lib/records/re-enroll";
import { ReEnrollForm } from "@/components/records/re-enroll-form";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Re-enroll Student",
};

// Reached from a student's Actions menu on the Students page, by admin and
// teacher alike (/students is open to both; RLS limits a teacher to their
// own branch's students, so another branch's id is simply not found).
export default async function ReEnrollStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const [context, years] = await Promise.all([
    getReEnrollContext(supabase, studentId),
    getAcademicYears(supabase),
  ]);

  if (!context) {
    notFound();
  }

  const { student } = context;
  const fallbackYear = years.find((year) => year.isCurrent) ?? years[0];

  return (
    <div className="max-w-xl">
      <BackLink href="/students" label="Back to students" />
      <h1 className="mb-1 text-xl font-medium text-ink">
        Re-enroll {student.fullName}
      </h1>
      <p className="mb-4 text-sm text-ink-secondary">
        Admission no. {student.admissionNo} · {student.branchName}. Their
        details are filled in from what&apos;s on file; enter the new
        stint&apos;s money and dates.
      </p>

      {fallbackYear ? (
        <ReEnrollForm
          student={student}
          suggestedSlot={context.suggestedSlot}
          years={years.map((year) => ({
            id: year.id,
            startsOn: year.startsOn,
            endsOn: year.endsOn,
          }))}
          fallbackYearId={fallbackYear.id}
        />
      ) : (
        <p className="text-sm text-ink-secondary">
          There is no academic year set up yet — add one in Settings before
          re-enrolling a student.
        </p>
      )}
    </div>
  );
}
