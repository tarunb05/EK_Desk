// One shared bar for every page's filters + primary action, replacing the
// previous pattern of filters floating loose in the page body (or, on
// Students, filters split across two separate rows from the heading). A
// single bordered/surfaced container reads as one instrument, not a pile
// of independent controls.
export function Toolbar({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-surface px-3 py-2.5">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {children}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
