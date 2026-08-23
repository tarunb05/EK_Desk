// Hand-rolled inline SVGs, not an icon library: this app has zero icon
// dependencies today, and a couple dozen static glyphs aren't worth adding
// one for. Every path uses currentColor so hover/active text-color rules
// just work. Default size (18px) fits nav/button contexts; pass `size` down
// to `IconProps` for dense contexts like table cells and small badges.

interface IconProps {
  size?: number;
  className?: string;
}

function IconBase({
  size = 18,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export function TransportIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="14" height="9" rx="1.5" />
      <path d="M3 10h14" />
      <circle cx="6.5" cy="16" r="1.25" />
      <circle cx="13.5" cy="16" r="1.25" />
    </IconBase>
  );
}

export function DaycareIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M3 9.5 10 4l7 5.5" />
      <path d="M5 8.5V16h10V8.5" />
      <path d="M8 16v-4h4v4" />
    </IconBase>
  );
}

export function StudentsIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="7" r="2.25" />
      <circle cx="14" cy="8" r="1.75" />
      <path d="M3 16c0-2.3 1.8-4 4-4s4 1.7 4 4" />
      <path d="M12.5 12.5c1.8.2 3 1.6 3 3.5" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.6 5.6l1.4 1.4M13 13l1.4 1.4M14.4 5.6 13 7M7 13l-1.4 1.4" />
    </IconBase>
  );
}

export function ApprovalsIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <rect x="4" y="3.5" width="12" height="13" rx="1.5" />
      <path d="m7 10 2 2 4-4.5" />
    </IconBase>
  );
}

export function CollapseIcon({
  direction,
  ...props
}: IconProps & { direction: "left" | "right" }) {
  return (
    <IconBase {...props}>
      <path d={direction === "left" ? "M12 4 6 10l6 6" : "M8 4l6 6-6 6"} />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M16 10H4M9 4.5 3.5 10 9 15.5" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
      <path d="M3.5 8.5h13M7 3v3M13 3v3" />
    </IconBase>
  );
}

export function BranchIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M10 17s5.5-4.8 5.5-9A5.5 5.5 0 0 0 4.5 8c0 4.2 5.5 9 5.5 9Z" />
      <circle cx="10" cy="8" r="1.75" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M3.5 5h13M6 10h8M8.5 15h3" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <circle cx="8.75" cy="8.75" r="5" />
      <path d="m16 16-3.4-3.4" />
    </IconBase>
  );
}

export function StatusIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m7.2 10 1.9 1.9L12.9 8" />
    </IconBase>
  );
}

export function ServiceIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="m10 3.5 6.5 3.5-6.5 3.5-6.5-3.5L10 3.5Z" />
      <path d="m3.5 10.5 6.5 3.5 6.5-3.5" />
      <path d="m3.5 13.5 6.5 3.5 6.5-3.5" />
    </IconBase>
  );
}

export function ClassIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="m10 3.5 7 3.5-7 3.5-7-3.5 7-3.5Z" />
      <path d="M5.5 8.7v3.8c0 1 2 2 4.5 2s4.5-1 4.5-2V8.7" />
      <path d="M17 7v4.5" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
    </IconBase>
  );
}

export function SignOutIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M8 17H4.5A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3H8" />
      <path d="M13.5 14 17.5 10l-4-4" />
      <path d="M17.5 10H7.5" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.5" />
    </IconBase>
  );
}

export function WalletIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5.5" width="14" height="10" rx="1.5" />
      <path d="M3 8.5h14" />
      <path d="M13 11.5h2" />
    </IconBase>
  );
}

export function TrendIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="m3.5 13 4.5-5 3 3 5.5-6.5" />
      <path d="M12.5 4.5h4v4" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="m5 7.5 5 5 5-5" />
    </IconBase>
  );
}

export function AlertIcon(props: IconProps = {}) {
  return (
    <IconBase {...props}>
      <path d="M10 3.5 17.5 16h-15L10 3.5Z" />
      <path d="M10 8.5v3.2" />
      <circle cx="10" cy="14" r="0.15" fill="currentColor" stroke="none" />
    </IconBase>
  );
}
