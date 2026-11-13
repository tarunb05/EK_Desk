import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface ReEnrollContext {
  student: {
    id: string;
    fullName: string;
    admissionNo: string;
    guardianName: string;
    phone: string;
    whatsappPhone: string;
    classSection: string;
    notes: string;
    branchName: string;
  };
  // The slot of their most recent daycare stint, to pre-fill. Empty for a
  // student with no daycare history.
  suggestedSlot: string;
}

// What the Re-enroll page needs about one student, or null when there's
// nothing to re-enroll: not found (RLS hides another branch's students from
// a teacher) or not an active student.
export async function getReEnrollContext(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<ReEnrollContext | null> {
  const { data: student } = await supabase
    .from("student")
    .select(
      "id, full_name, admission_no, guardian_name, phone, whatsapp_phone, class_section, notes, status, branch:branch_id(name)",
    )
    .eq("id", studentId)
    .maybeSingle();

  if (!student || student.status !== "active") {
    return null;
  }

  const { data: stints } = await supabase
    .from("fee_account")
    .select("id, slot")
    .eq("student_id", studentId)
    .eq("service_type", "daycare")
    .order("starts_on", { ascending: false });

  const branch = student.branch as { name: string } | null;

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      admissionNo: student.admission_no,
      guardianName: student.guardian_name,
      phone: student.phone,
      whatsappPhone: student.whatsapp_phone ?? "",
      classSection: student.class_section,
      notes: student.notes ?? "",
      branchName: branch?.name ?? "",
    },
    suggestedSlot: stints?.[0]?.slot ?? "",
  };
}
