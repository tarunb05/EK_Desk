// A mobile number, once every input variation is stripped down: exactly 10
// digits, first digit 6-9 -- the range Indian telecom licenses mobile
// numbers under (TRAI's numbering plan reserves 6-9 for mobile; 0-5 is
// landline/other services). Deliberately permissive about everything else:
// spaces, dashes, a leading +91/91/0 are all just noise around the same
// number underneath.
//
// This can't perfectly separate every landline from every mobile by digits
// alone -- a handful of metro STD codes (Bangalore's 080, for one) leave a
// 6-9-leading residue after the trunk 0 is stripped, indistinguishable from
// a real mobile without an actual area-code table. Good enough for "does
// this look like a number WhatsApp/SMS can reach", not a phone-network
// validator.
const MOBILE_LOCAL_PATTERN = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(raw: string): string | null {
  const digitsOnly = raw.replace(/\D/g, "");

  let local = digitsOnly;
  if (local.length === 12 && local.startsWith("91")) {
    local = local.slice(2);
  } else if (local.length === 11 && local.startsWith("0")) {
    local = local.slice(1);
  }

  if (!MOBILE_LOCAL_PATTERN.test(local)) {
    return null;
  }

  return `91${local}`;
}
