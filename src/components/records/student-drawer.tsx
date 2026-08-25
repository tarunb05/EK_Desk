import type { StudentDetail } from "@/lib/records/student-detail";
import type { Role } from "@/lib/auth/routes";
import { StudentDetailBody } from "./student-detail-body";
import { EscapeToClose } from "./escape-to-close";
import { CloseDrawerLink } from "./close-drawer-link";

export function StudentDrawer({
  detail,
  closeHref,
  role,
}: {
  detail: StudentDetail;
  closeHref: "/transport" | "/daycare";
  role: Role;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <EscapeToClose />
      <CloseDrawerLink
        href={closeHref}
        ariaLabel="Close"
        className="absolute inset-0 bg-ink/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-drawer-heading"
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-hairline bg-surface p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="student-drawer-heading"
            className="text-lg font-medium text-ink"
          >
            {detail.student.fullName}
          </h2>
          <CloseDrawerLink
            href={closeHref}
            className="text-sm text-ink-secondary hover:text-ink"
          >
            Close
          </CloseDrawerLink>
        </div>
        <StudentDetailBody
          detail={detail}
          redirectTo={closeHref}
          role={role}
        />
      </div>
    </div>
  );
}
