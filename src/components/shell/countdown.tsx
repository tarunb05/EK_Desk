"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

// A live ticking countdown to an expiry timestamp -- self-contained, no
// prop beyond the ISO string, so any screen that needs one can drop it in.
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <span
      className={`text-2xs tabular-nums ${remaining <= 0 ? "text-attention" : "text-ink-muted"}`}
    >
      {formatRemaining(remaining)}
    </span>
  );
}
