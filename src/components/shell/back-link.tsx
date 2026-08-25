import Link from "next/link";
import { ArrowLeftIcon } from "./nav-icons";

export function BackLink({
  href,
  label = "Back to dashboard",
}: {
  href: "/transport" | "/daycare" | "/students" | "/expenses";
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      <ArrowLeftIcon /> {label}
    </Link>
  );
}
