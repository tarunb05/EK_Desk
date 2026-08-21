// The school's actual class list — fixed, not freeform, so admission data
// stays consistent (no "Nursery" vs "nursery" vs "Nursery " typos).
export const CLASS_SECTIONS = [
  "Play Group",
  "Nursery",
  "Euro Junior",
  "Euro Senior",
  "Daycare",
] as const;

export type ClassSection = (typeof CLASS_SECTIONS)[number];
