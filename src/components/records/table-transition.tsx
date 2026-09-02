"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";

// Sorting and pagination on a record table are both "change the URL, the
// Server Component re-fetches with the new params" -- and a same-route
// search-param navigation like that is exactly the case Next's own
// loading.tsx Suspense boundary does NOT reliably re-trigger (it's built
// for a genuinely new segment load, not a prop update to the one already
// on screen). Without this, clicking a sort header or a page number
// changed nothing on screen until the new rows just appeared. useTransition
// is the documented way to get an isPending signal for exactly this kind
// of navigation.
//
// Shared via context (not a per-header/per-control useTransition each)
// because a table's sort headers and its pagination controls all need to
// agree on the same "is a navigation for THIS table in flight" answer --
// otherwise clicking Amount desc, say, wouldn't dim the row that's still
// mid-flight from clicking Date asc a moment before.
interface TableTransitionContextValue {
  isPending: boolean;
  navigate: (href: string) => void;
}

const TableTransitionContext =
  createContext<TableTransitionContextValue | null>(null);

export function TableTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      // scroll: false -- this is a sort/page change on a table already in
      // view, not a new page; jumping back to the top would undo whatever
      // scroll position the click itself needed.
      router.push(href, { scroll: false });
    });
  }

  return (
    <TableTransitionContext.Provider value={{ isPending, navigate }}>
      {children}
    </TableTransitionContext.Provider>
  );
}

export function useTableTransition(): TableTransitionContextValue {
  const context = useContext(TableTransitionContext);
  if (!context) {
    throw new Error(
      "useTableTransition must be used within a TableTransitionProvider",
    );
  }
  return context;
}

// A clickable href that still looks/behaves like a real link (visible URL
// on hover, right-click "copy link", ctrl/cmd/middle-click opens a new tab
// natively) but routes primary left-clicks through navigate() above so the
// table's shared isPending actually fires -- next/link's own soft
// navigation gives no such signal to a sibling component.
export function TableNavLink({
  href,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navigate } = useTableTransition();

  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
