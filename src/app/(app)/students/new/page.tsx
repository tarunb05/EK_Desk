import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Add Student",
};

export default function NewStudentPage() {
  return (
    <div className="max-w-xl">
      <BackLink href="/students" />
      <h1 className="mb-4 text-xl font-medium text-ink">Add student</h1>
      <div className="flex flex-col gap-2">
        <Link
          href="/students/new/transport"
          className="h-10 rounded-md border border-border px-4 text-sm leading-10 text-ink transition-colors duration-150 hover:bg-surface-accent"
        >
          Add transport student
        </Link>
        <Link
          href="/students/new/daycare"
          className="h-10 rounded-md border border-border px-4 text-sm leading-10 text-ink transition-colors duration-150 hover:bg-surface-accent"
        >
          Add daycare student
        </Link>
      </div>
    </div>
  );
}
