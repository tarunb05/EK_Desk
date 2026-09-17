"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import { formatPaise, paiseToRupeesInputString, parseRupeesToPaise } from "@/lib/domain/money";
import { formatLogDate } from "@/lib/domain/datetime";
import { normalizeIndianMobile } from "@/lib/domain/phone";
import { buildWhatsAppUrl } from "@/lib/domain/whatsapp";
import { buildSmsUrl } from "@/lib/domain/sms";
import {
  buildPaymentReminderMessage,
  buildPaymentRequestMessage,
} from "@/lib/domain/payment-request-message";
import { getSiteUrl } from "@/lib/site-url";
import { getClientIpHash } from "@/lib/request-ip";
import { normalizeUtr } from "@/lib/domain/utr";
import { buildUpiPaymentUri } from "@/lib/domain/upi-uri";
import {
  createPaymentRequestSchema,
  markNumberUnreachableSchema,
  recordShareChannelSchema,
  sendReminderSchema,
  submitPaymentClaimSchema,
} from "@/lib/payments/schemas";

const SERVICE_LABEL: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

// PostgREST/supabase-js expects a bytea RPC argument in Postgres's own hex
// text representation ("\x..."), not a raw Buffer -- the raw pg driver used
// elsewhere in this codebase (integration tests) accepts a Buffer directly
// because it's a different wire protocol; this goes over HTTP.
function toByteaHex(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}

export interface ShareLinks {
  paymentRequestId: string;
  referenceCode: string;
  amountDisplay: string;
  expiresAtDisplay: string;
  payPageUrl: string;
  message: string;
  whatsappUrl: string | null;
  smsUrl: string | null;
  numberUsable: boolean;
}

export interface PaymentRequestActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
  share?: ShareLinks;
}

export interface CollectionAccountOption {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface PaymentRequestDialogData {
  hasPending: boolean;
  pendingDisplay: string;
  defaultAmountInput: string;
  collectionAccounts: CollectionAccountOption[];
  phone: string | null;
  whatsappPhone: string | null;
  phoneNotOnWhatsapp: boolean;
  whatsappPhoneNotOnWhatsapp: boolean;
  existingRequest: {
    id: string;
    amountDisplay: string;
    expiresAtDisplay: string;
    referenceCode: string;
  } | null;
}

// Fetched on demand when the dialog opens, same reasoning as Phase 15's
// earlier on-demand reads (see the retired PaymentLinkButton) -- not
// batched into every Students-list page load for every row.
export async function getPaymentRequestDialogData(
  feeAccountId: string,
): Promise<PaymentRequestDialogData | null> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: feeAccount } = await supabase
    .from("fee_account")
    .select(
      `status,
       student:student_id (
         phone, whatsapp_phone, phone_not_on_whatsapp_at, whatsapp_phone_not_on_whatsapp_at,
         branch:branch_id ( id )
       )`,
    )
    .eq("id", feeAccountId)
    .maybeSingle();

  if (!feeAccount || !feeAccount.student) {
    return null;
  }

  const [{ data: balance }, { data: accounts }, { data: existing }] =
    await Promise.all([
      supabase
        .from("fee_account_balance")
        .select("pending_paise")
        .eq("fee_account_id", feeAccountId)
        .maybeSingle(),
      supabase
        .from("collection_account")
        .select("id, label, is_default")
        .eq("branch_id", feeAccount.student.branch.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("label"),
      supabase
        .from("payment_request")
        .select("id, amount_paise, expires_at, reference_code")
        .eq("fee_account_id", feeAccountId)
        .eq("status", "open")
        .maybeSingle(),
    ]);

  const pendingPaise = BigInt(balance?.pending_paise ?? 0);

  return {
    hasPending: pendingPaise > 0n,
    pendingDisplay: formatPaise(pendingPaise),
    defaultAmountInput: paiseToRupeesInputString(pendingPaise),
    collectionAccounts: (accounts ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      isDefault: a.is_default,
    })),
    phone: feeAccount.student.phone,
    whatsappPhone: feeAccount.student.whatsapp_phone,
    phoneNotOnWhatsapp: feeAccount.student.phone_not_on_whatsapp_at !== null,
    whatsappPhoneNotOnWhatsapp:
      feeAccount.student.whatsapp_phone_not_on_whatsapp_at !== null,
    existingRequest: existing
      ? {
          id: existing.id,
          amountDisplay: formatPaise(BigInt(existing.amount_paise)),
          expiresAtDisplay: formatLogDate(existing.expires_at),
          referenceCode: existing.reference_code,
        }
      : null,
  };
}

// Shared by createPaymentRequest and shareAgainPaymentRequest/sendReminder:
// everything needed to build the message and share URLs for one request,
// read fresh rather than trusted from the client. `rawToken` is passed in
// (never re-read from the database -- only its hash is ever stored) and
// `phoneField` says which of the student's two numbers this share targets.
async function buildShareLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paymentRequestId: string,
  rawToken: string,
  phoneField: "phone" | "whatsappPhone",
  variant: "full" | "reminder",
): Promise<ShareLinks | { error: string }> {
  const { data: request } = await supabase
    .from("payment_request")
    .select(
      `amount_paise, expires_at, reference_code, include_upi, include_bank,
       fee_account:fee_account_id (
         service_type,
         student:student_id ( full_name, phone, whatsapp_phone, branch:branch_id ( name ) )
       ),
       collection_account:collection_account_id ( upi_id, payee_name, bank_name, account_holder, account_number, ifsc )`,
    )
    .eq("id", paymentRequestId)
    .maybeSingle();

  if (!request || !request.fee_account || !request.collection_account) {
    return { error: "Could not find this payment request." };
  }

  const childFirstName = request.fee_account.student.full_name.split(" ")[0]!;
  const branchName = request.fee_account.student.branch.name;
  const serviceLabel =
    SERVICE_LABEL[request.fee_account.service_type] ??
    request.fee_account.service_type;
  const amountDisplay = formatPaise(BigInt(request.amount_paise));
  const expiresAtDisplay = formatLogDate(request.expires_at);
  const payPageUrl = `${getSiteUrl()}/p/${rawToken}`;

  const message =
    variant === "full"
      ? buildPaymentRequestMessage({
          branchName,
          serviceLabel,
          childFirstName,
          amountDisplay,
          dueDateDisplay: expiresAtDisplay,
          referenceCode: request.reference_code,
          payPageUrl,
          upi: request.include_upi
            ? {
                upiId: request.collection_account.upi_id ?? "",
                payeeName: request.collection_account.payee_name,
              }
            : null,
          bank: request.include_bank
            ? {
                accountHolder: request.collection_account.account_holder ?? "",
                bankName: request.collection_account.bank_name ?? "",
                accountNumber: request.collection_account.account_number ?? "",
                ifsc: request.collection_account.ifsc ?? "",
              }
            : null,
        })
      : buildPaymentReminderMessage({
          amountDisplay,
          dueDateDisplay: expiresAtDisplay,
          referenceCode: request.reference_code,
          payPageUrl,
        });

  const rawNumber =
    phoneField === "whatsappPhone"
      ? request.fee_account.student.whatsapp_phone
      : request.fee_account.student.phone;
  const normalized = rawNumber ? normalizeIndianMobile(rawNumber) : null;

  return {
    paymentRequestId,
    referenceCode: request.reference_code,
    amountDisplay,
    expiresAtDisplay,
    payPageUrl,
    message,
    whatsappUrl: normalized ? buildWhatsAppUrl(normalized, message) : null,
    smsUrl: normalized ? buildSmsUrl(normalized, message) : null,
    numberUsable: normalized !== null,
  };
}

// "A few links per minute is plenty" (brief) -- a query against
// payment_request itself, same mechanism used across every Phase 15 rate
// limit so far: an in-memory counter would reset on cold start and isn't
// shared across serverless instances, silently doing nothing in production.
const RATE_LIMIT_MAX_PER_MINUTE = 5;

async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("payment_request")
    .select("id", { count: "exact", head: true })
    .eq("created_by", adminId)
    .gte("created_at", oneMinuteAgo);
  return (count ?? 0) < RATE_LIMIT_MAX_PER_MINUTE;
}

export async function createPaymentRequest(
  _prevState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  const parsed = createPaymentRequestSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireRole("admin");
  const supabase = await createClient();

  if (!(await checkRateLimit(supabase, authed.userId))) {
    return {
      error: "Too many links created in the last minute — wait a moment and try again.",
    };
  }

  const amountPaise = parseRupeesToPaise(value.amount);
  if (amountPaise === null) {
    return { error: null, fieldErrors: { amount: "Enter a valid amount." } };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest();

  const { data, error } = await supabase.rpc("create_payment_request", {
    p_fee_account_id: value.feeAccountId,
    p_collection_account_id: value.collectionAccountId,
    p_amount_paise: Number(amountPaise),
    p_include_upi: value.includeUpi,
    p_include_bank: value.includeBank,
    p_expiry_days: value.expiryDays,
    p_token_hash: toByteaHex(tokenHash),
  });

  if (error || !data) {
    return { error: "Could not create this payment link — try again." };
  }

  const paymentRequestId = (data as { id: string }).id;

  // Ids and amounts only -- no phone, no account number, no token.
  console.log(
    `[payment-request] created by=${authed.userId} feeAccount=${value.feeAccountId} paymentRequest=${paymentRequestId} amountPaise=${amountPaise}`,
  );

  const share = await buildShareLinks(
    supabase,
    paymentRequestId,
    rawToken,
    value.phoneField,
    "full",
  );

  revalidatePath("/students", "page");

  if ("error" in share) {
    return { error: share.error };
  }
  return { error: null, share };
}

export async function shareAgainPaymentRequest(
  paymentRequestId: string,
  phoneField: "phone" | "whatsappPhone",
): Promise<PaymentRequestActionState> {
  await requireRole("admin");
  const supabase = await createClient();

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest();

  const { error } = await supabase.rpc("reissue_payment_request_token", {
    p_id: paymentRequestId,
    p_token_hash: toByteaHex(tokenHash),
  });
  if (error) {
    return { error: "This request is no longer open." };
  }

  const share = await buildShareLinks(
    supabase,
    paymentRequestId,
    rawToken,
    phoneField,
    "full",
  );
  if ("error" in share) {
    return { error: share.error };
  }
  return { error: null, share };
}

export async function sendReminder(
  _prevState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  const parsed = sendReminderSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  await requireRole("admin");
  const supabase = await createClient();

  // A reminder needs a working link too, and only the token's hash is ever
  // stored (brief section 3) -- there is no way to recover the original
  // raw token to send "the exact same" URL again once the dialog that
  // first showed it has closed. This issues a fresh token for the same
  // request (no new reference code, no change to amount/expiry) rather
  // than silently failing to produce a link at all; the old link stops
  // working from this point, same as an explicit "Share again".
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest();

  const { error } = await supabase.rpc("reissue_payment_request_token", {
    p_id: parsed.data.paymentRequestId,
    p_token_hash: toByteaHex(tokenHash),
  });
  if (error) {
    return { error: "This request is no longer open." };
  }

  const share = await buildShareLinks(
    supabase,
    parsed.data.paymentRequestId,
    rawToken,
    parsed.data.phoneField,
    "reminder",
  );
  if ("error" in share) {
    return { error: share.error };
  }
  return { error: null, share };
}

export async function markNumberUnreachable(
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = markNumberUnreachableSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: "Could not save this." };
  }
  await requireRole("admin");
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("student")
    .update(
      parsed.data.phoneField === "whatsappPhone"
        ? { whatsapp_phone_not_on_whatsapp_at: now }
        : { phone_not_on_whatsapp_at: now },
    )
    .eq("id", parsed.data.studentId);

  if (error) {
    return { error: "Could not save this." };
  }
  revalidatePath("/students", "page");
  return { error: null };
}

export async function recordShareChannel(formData: FormData): Promise<void> {
  const parsed = recordShareChannelSchema.safeParse(formEntries(formData));
  if (!parsed.success) return;
  await requireRole("admin");
  const supabase = await createClient();

  // Records what happened, not what we hope (brief) -- this fires right
  // after the admin presses Send/Copy, not on any confirmation WhatsApp
  // itself could give (there isn't one).
  await supabase
    .from("payment_request")
    .update({
      shared_at: new Date().toISOString(),
      shared_via: parsed.data.sharedVia,
      shared_to_last4: parsed.data.sharedToLast4,
    })
    .eq("id", parsed.data.paymentRequestId);
}

export interface PayPageData {
  status: string;
  branchName: string;
  serviceLabel: string;
  childFirstName: string;
  amountDisplay: string;
  expiresAtDisplay: string;
  referenceCode: string;
  payeeName: string;
  upiId: string | null;
  upiUri: string | null;
  includeUpi: boolean;
  includeBank: boolean;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
}

// The public pay page's one read (Phase 15.4) -- no session, no role
// check, because there is neither: this is the app's first genuinely
// unauthenticated caller, and every real check (rate limits, does this
// token even resolve) lives inside lookup_payment_request_by_token_hash
// itself, a security definer function granted to anon. Collapses every
// non-open status to the same null this function already returns for an
// unknown/rate-limited token -- the brief's own requirement that unknown,
// expired, closed, cancelled, and (here) rate-limited all render
// identically, enforced one layer further out as defense in depth.
export async function getPayPageData(rawToken: string): Promise<PayPageData | null> {
  const tokenHash = createHash("sha256").update(rawToken).digest();
  const ipHash = await getClientIpHash();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "lookup_payment_request_by_token_hash",
    {
      p_token_hash: toByteaHex(tokenHash),
      p_ip_hash: toByteaHex(ipHash),
    },
  );

  if (error || !data || data.length === 0) {
    return null;
  }
  const row = data[0]!;
  if (row.status !== "open") {
    return null;
  }

  return {
    status: row.status,
    branchName: row.branch_name,
    serviceLabel: SERVICE_LABEL[row.service_type] ?? row.service_type,
    childFirstName: row.child_first_name,
    amountDisplay: formatPaise(BigInt(row.amount_paise)),
    expiresAtDisplay: formatLogDate(row.expires_at),
    referenceCode: row.reference_code,
    payeeName: row.payee_name,
    upiId: row.include_upi ? row.upi_id : null,
    upiUri:
      row.include_upi && row.upi_id
        ? buildUpiPaymentUri({
            payeeVpa: row.upi_id,
            payeeName: row.payee_name,
            amountRupees: paiseToRupeesInputString(BigInt(row.amount_paise)),
            referenceCode: row.reference_code,
          })
        : null,
    includeUpi: row.include_upi,
    includeBank: row.include_bank,
    bankName: row.include_bank ? row.bank_name : null,
    accountHolder: row.include_bank ? row.account_holder : null,
    accountNumber: row.include_bank ? row.account_number : null,
    ifsc: row.include_bank ? row.ifsc : null,
  };
}

export interface ClaimActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
  submitted?: boolean;
}

// The claim form's one write, and the one Server Action in this app
// callable by a fully anonymous visitor. Every failure mode -- not open,
// rate-limited, too many pending claims already, an invalid date --
// collapses to the same one generic sentence, same anti-fingerprinting
// reasoning as the page load: distinguishing them would tell a script
// which guess landed closer to a real, live token. Logs nothing at all
// (not even the payment_request id) -- there's no admin action yet to
// correlate it with (that's 15.5), so there's no established need to
// weigh against the exposure of logging anything about an anonymous
// submission.
export async function submitPaymentClaim(
  _prevState: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const parsed = submitPaymentClaimSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const amountPaise = parseRupeesToPaise(value.amount);
  if (amountPaise === null) {
    return { error: null, fieldErrors: { amount: "Enter a valid amount." } };
  }

  const tokenHash = createHash("sha256").update(value.token).digest();
  const ipHash = await getClientIpHash();
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_payment_claim", {
    p_token_hash: toByteaHex(tokenHash),
    p_ip_hash: toByteaHex(ipHash),
    p_utr: normalizeUtr(value.utr),
    p_amount_paise: Number(amountPaise),
    p_paid_on: value.paidOn,
    p_source: "parent_page",
  });

  if (error) {
    return {
      error:
        "We couldn't process this — please try again or contact the school office.",
    };
  }

  return { error: null, submitted: true };
}
