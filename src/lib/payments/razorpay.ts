import { razorpayEnv } from "./env";

// The one seam between this app and Razorpay's Payment Links API -- every
// caller (the create/cancel Server Actions here, the webhook handler in
// 15.3) goes through this file, never fetch()es Razorpay directly. Plain
// fetch + Basic auth, not the `razorpay` npm package: three narrow REST
// calls (create, cancel, and verifying a webhook signature) don't earn a
// dependency (see the Phase 15 plan's own answer on this).
//
// RAZORPAY_MOCK=true short-circuits both calls with deterministic fake
// data instead of a real fetch -- the E2E suite's own server process can't
// be reached by vitest's vi.mock(), so this is the mechanism that lets
// Playwright exercise the create/cancel-link flow for real without a real
// Razorpay account or network access. Confirmed with the user as the
// chosen approach over skipping E2E coverage for this flow.
//
// Deliberately no customer name/email/phone anywhere in this file --
// Razorpay's `customer` field is optional, and is the one place PII could
// leak into a third party. Confirmed against Razorpay's own docs
// (razorpay.com/docs/api/payments/payment-links/create-standard) that
// `customer` is not required, so omitting it entirely (rather than the
// alternative already flagged in the plan -- asking before adding it)
// carries no functional cost: notify.sms/notify.email are both false, so
// nothing here ever needed a phone or email in the first place.

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

// Set only in the e2e CI job / a local .env.test (never in dev/production)
// -- Playwright drives a real, separately-spawned `next start` server, so
// vitest's vi.mock() (used by this file's own unit tests and by
// link-lifecycle.test.ts) can't reach it. This is the one place this
// module is test-aware; every other file in lib/payments/ has no idea
// mock mode exists.
const MOCK_MODE = process.env.RAZORPAY_MOCK === "true";

function authHeader(): string {
  const credentials = Buffer.from(
    `${razorpayEnv.RAZORPAY_KEY_ID}:${razorpayEnv.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

export interface CreatePaymentLinkParams {
  amountPaise: bigint;
  // Our payment_request.id -- Razorpay's reference_id, echoed back on every
  // webhook event so 15.3 can look the row up without trusting `notes`.
  referenceId: string;
  // Branch name, service, admission number -- never a student's name or a
  // guardian's phone/email (data minimisation, Phase 15 brief section 2.7).
  description: string;
  expireBy: number;
  // Optional: /payments/return (what this would point to) doesn't exist
  // until 15.3. Razorpay's own hosted page still completes the payment
  // without it -- the parent just isn't redirected anywhere afterward.
  callbackUrl?: string;
}

export interface RazorpayPaymentLink {
  id: string;
  shortUrl: string;
}

export type CreatePaymentLinkResult =
  | { ok: true; link: RazorpayPaymentLink }
  | { ok: false; error: string };

export async function createLink(
  params: CreatePaymentLinkParams,
): Promise<CreatePaymentLinkResult> {
  if (MOCK_MODE) {
    const shortId = params.referenceId.replace(/-/g, "").slice(0, 14);
    return {
      ok: true,
      link: { id: `plink_mock${shortId}`, shortUrl: `https://rzp.io/i/mock${shortId}` },
    };
  }

  const response = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(params.amountPaise),
      currency: "INR",
      accept_partial: false,
      reference_id: params.referenceId,
      description: params.description,
      expire_by: params.expireBy,
      ...(params.callbackUrl
        ? { callback_url: params.callbackUrl, callback_method: "get" }
        : {}),
      notify: { sms: false, email: false },
      reminder_enable: false,
    }),
  });

  const body = (await response.json()) as {
    id?: string;
    short_url?: string;
    error?: { description?: string };
  };

  if (!response.ok || !body.id || !body.short_url) {
    return {
      ok: false,
      error: body.error?.description ?? "Razorpay did not create the link.",
    };
  }

  return { ok: true, link: { id: body.id, shortUrl: body.short_url } };
}

export type CancelPaymentLinkResult =
  | { ok: true }
  // "already_paid" is the one failure the caller must react to
  // differently (Phase 15 brief section 2's Cancel action: leave it for
  // the webhook, tell the admin, never mark it cancelled over a real
  // payment) -- everything else is just a generic, surfaced error.
  | { ok: false; reason: "already_paid" | "other"; error: string };

export async function cancelLink(
  gatewayLinkId: string,
): Promise<CancelPaymentLinkResult> {
  if (MOCK_MODE) {
    // A mock link id containing "alreadypaid" simulates the one failure
    // mode a caller must react to differently -- see e2e/ tests exercising
    // that path deliberately, by creating a link and cancelling it under
    // that id.
    if (gatewayLinkId.includes("alreadypaid")) {
      return {
        ok: false,
        reason: "already_paid",
        error: "The payment link has already been paid",
      };
    }
    return { ok: true };
  }

  const response = await fetch(
    `${RAZORPAY_API_BASE}/payment_links/${gatewayLinkId}/cancel`,
    {
      method: "POST",
      headers: { Authorization: authHeader() },
    },
  );

  if (response.ok) {
    return { ok: true };
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: { description?: string };
  };
  const message = body.error?.description ?? "Razorpay did not cancel the link.";
  const alreadyPaid = /paid|partially_paid/i.test(message);

  return {
    ok: false,
    reason: alreadyPaid ? "already_paid" : "other",
    error: message,
  };
}
