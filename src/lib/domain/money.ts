const PAISE_PER_RUPEE = 100;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function paiseToRupees(paise: bigint): number {
  return Number(paise) / PAISE_PER_RUPEE;
}

export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * PAISE_PER_RUPEE));
}

export function formatPaise(paise: bigint): string {
  return inrFormatter.format(paiseToRupees(paise));
}
