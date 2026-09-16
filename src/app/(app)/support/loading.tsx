import { ApprovalsLoadingSkeleton } from "@/components/shell/page-skeletons";

// Same row/card shape as /approvals -- a list of message-shaped items with
// action buttons at each row's end -- so no dedicated skeleton needed.
export default function Loading() {
  return <ApprovalsLoadingSkeleton />;
}
