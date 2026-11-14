// A template, not a layout: Next.js gives a template a fresh instance on
// every navigation, so this wrapper remounts and its entrance animation
// (globals.css's .animate-page-in, a short fade-up) plays each time a
// signed-in screen opens. The layout around it (sidebar, top bar) does not
// remount, so only the page content moves.
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-page-in">{children}</div>;
}
