import Link from "next/link";
import type { StudentDetail } from "@/lib/records/student-detail";
import { StudentDetailBody } from "./student-detail-body";

export function StudentDrawer({
  detail,
  closeHref,
}: {
  detail: StudentDetail;
  closeHref: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link
        href={closeHref}
        aria-label="Close"
        className="absolute inset-0 bg-ink/30"
      />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-hairline bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">
            {detail.student.fullName}
          </h2>
          <Link
            href={closeHref}
            className="text-sm text-ink-secondary hover:text-ink"
          >
            Close
          </Link>
        </div>
        <StudentDetailBody detail={detail} />
      </div>
    </div>
  );
}
