export const REQUEST_EXPIRY_DAYS = [3, 7, 14, 30] as const;
export type RequestExpiryDays = (typeof REQUEST_EXPIRY_DAYS)[number];
export const DEFAULT_REQUEST_EXPIRY_DAYS: RequestExpiryDays = 7;

export function expiryDaysToExpiresAt(
  days: RequestExpiryDays,
  from: Date,
): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
