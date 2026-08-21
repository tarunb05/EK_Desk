// Hand-rolled inline SVGs, not an icon library: this app has zero icon
// dependencies today, and four static glyphs aren't worth adding one for.
// Every path uses currentColor so hover/active text-color rules just work.

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export function TransportIcon() {
  return (
    <IconBase>
      <rect x="3" y="5" width="14" height="9" rx="1.5" />
      <path d="M3 10h14" />
      <circle cx="6.5" cy="16" r="1.25" />
      <circle cx="13.5" cy="16" r="1.25" />
    </IconBase>
  );
}

export function DaycareIcon() {
  return (
    <IconBase>
      <path d="M3 9.5 10 4l7 5.5" />
      <path d="M5 8.5V16h10V8.5" />
      <path d="M8 16v-4h4v4" />
    </IconBase>
  );
}

export function StudentsIcon() {
  return (
    <IconBase>
      <circle cx="7" cy="7" r="2.25" />
      <circle cx="14" cy="8" r="1.75" />
      <path d="M3 16c0-2.3 1.8-4 4-4s4 1.7 4 4" />
      <path d="M12.5 12.5c1.8.2 3 1.6 3 3.5" />
    </IconBase>
  );
}

export function SettingsIcon() {
  return (
    <IconBase>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3.5v1.6M10 14.9v1.6M16.5 10h-1.6M5.1 10H3.5M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M14.6 14.6l-1.1-1.1M6.5 6.5 5.4 5.4" />
    </IconBase>
  );
}

export function CollapseIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <IconBase>
      <path d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"} />
    </IconBase>
  );
}

export function CloseIcon() {
  return (
    <IconBase>
      <path d="M5 5l10 10M15 5 5 15" />
    </IconBase>
  );
}

export function MenuIcon() {
  return (
    <IconBase>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </IconBase>
  );
}
