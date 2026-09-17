export interface UpiPaymentParams {
  payeeVpa: string; // pa
  payeeName: string; // pn -- may be a personal account holder's name
  amountRupees: string; // am -- decimal rupees as text, e.g. "4000.00"
  referenceCode: string; // tn
}

// The NPCI-standard upi://pay intent URI -- same query string used both for
// the "Pay with UPI app" button and encoded into the QR. encodeURIComponent
// per field (not URLSearchParams, which encodes spaces as `+` rather than
// %20) matches this app's existing convention for building share URLs.
export function buildUpiPaymentUri(params: UpiPaymentParams): string {
  const parts = [
    `pa=${encodeURIComponent(params.payeeVpa)}`,
    `pn=${encodeURIComponent(params.payeeName)}`,
    `am=${encodeURIComponent(params.amountRupees)}`,
    "cu=INR",
    `tn=${encodeURIComponent(params.referenceCode)}`,
  ];
  return `upi://pay?${parts.join("&")}`;
}
