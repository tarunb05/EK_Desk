export type StudentStatus = "active" | "inactive" | "withdrawn";
export type FeeAccountStatus = "active" | "discontinued";

// A <select> is not a permission model -- every legal edge is named
// explicitly rather than "anything goes except X". Withdrawn only reaches
// back to active (re-enrollment) directly; withdrawn -> inactive isn't a
// real-world action ("un-enroll a student who already left, but only
// halfway"), so it must go through active first, one deliberate step at
// a time.
const STUDENT_STATUS_TRANSITIONS: Record<StudentStatus, StudentStatus[]> = {
  active: ["inactive", "withdrawn"],
  inactive: ["active", "withdrawn"],
  withdrawn: ["active"],
};

export function canTransitionStudentStatus(
  from: StudentStatus,
  to: StudentStatus,
): boolean {
  return STUDENT_STATUS_TRANSITIONS[from].includes(to);
}

const FEE_ACCOUNT_STATUS_TRANSITIONS: Record<
  FeeAccountStatus,
  FeeAccountStatus[]
> = {
  active: ["discontinued"],
  discontinued: ["active"],
};

export function canTransitionFeeAccountStatus(
  from: FeeAccountStatus,
  to: FeeAccountStatus,
): boolean {
  return FEE_ACCOUNT_STATUS_TRANSITIONS[from].includes(to);
}
