// Same format the save_collection_account SQL function uses for the audit
// log's before/after snapshots (see the 15.2 migration) -- this is the
// display-side counterpart, for rendering collection_account.account_number
// (stored in full) as text a screen can safely show. Kept in sync by
// convention (both "•••• " + last 4), not by sharing code across languages.
export function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `••••${last4}`;
}
