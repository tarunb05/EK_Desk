export const TEST_ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME ?? "admin";
export const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "admin1";

// One teacher per seeded branch (BR-A, BR-B) so the E2E suite can log in as
// each and exercise the branch-scoped RLS policies from a real session.
export const TEST_TEACHERS = [
  {
    username: process.env.TEST_TEACHER_A_USERNAME ?? "kavya",
    password: process.env.TEST_TEACHER_A_PASSWORD ?? "narahari",
    fullName: "Kavya Narahari",
    branchCode: "BR-A",
  },
  {
    username: process.env.TEST_TEACHER_B_USERNAME ?? "meera",
    password: process.env.TEST_TEACHER_B_PASSWORD ?? "iyer",
    fullName: "Meera Iyer",
    branchCode: "BR-B",
  },
] as const;
