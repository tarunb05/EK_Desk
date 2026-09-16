import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelLink, createLink } from "./razorpay";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const baseParams = {
  amountPaise: 5_000_00n,
  referenceId: "11111111-1111-4111-8111-111111111111",
  description: "Kothanur — transport — BR-A-0001",
  expireBy: 1_800_000_000,
};

describe("createLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the link on a successful Razorpay response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "plink_abc123", short_url: "https://rzp.io/i/abc123" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createLink(baseParams);

    expect(result).toEqual({
      ok: true,
      link: { id: "plink_abc123", shortUrl: "https://rzp.io/i/abc123" },
    });
  });

  it("sends Basic auth and the expected body shape, with no customer field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "plink_abc123", short_url: "https://rzp.io/i/abc123" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createLink(baseParams);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/payment_links");
    expect((init.headers as Record<string, string>).Authorization).toMatch(
      /^Basic /,
    );
    const body = JSON.parse(init.body as string);
    expect(body.amount).toBe(500000);
    expect(body.currency).toBe("INR");
    expect(body.accept_partial).toBe(false);
    expect(body.reference_id).toBe(baseParams.referenceId);
    expect(body.notify).toEqual({ sms: false, email: false });
    expect(body).not.toHaveProperty("customer");
  });

  it("includes callback_url and callback_method only when callbackUrl is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "plink_abc123", short_url: "https://rzp.io/i/abc123" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createLink(baseParams);
    let body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body).not.toHaveProperty("callback_url");

    await createLink({ ...baseParams, callbackUrl: "https://example.com/return" });
    body = JSON.parse(
      (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string,
    );
    expect(body.callback_url).toBe("https://example.com/return");
    expect(body.callback_method).toBe("get");
  });

  it("surfaces Razorpay's own error description on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { description: "The amount must be at least INR 1." } },
          false,
        ),
      ),
    );

    const result = await createLink(baseParams);
    expect(result).toEqual({
      ok: false,
      error: "The amount must be at least INR 1.",
    });
  });
});

describe("cancelLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on a successful cancel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    const result = await cancelLink("plink_abc123");
    expect(result).toEqual({ ok: true });
  });

  it("distinguishes an already-paid link from a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { description: "This link has already been paid." } },
          false,
        ),
      ),
    );
    const result = await cancelLink("plink_abc123");
    expect(result).toEqual({
      ok: false,
      reason: "already_paid",
      error: "This link has already been paid.",
    });
  });

  it("reports a generic failure as reason: other", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { description: "Something went wrong." } }, false),
      ),
    );
    const result = await cancelLink("plink_abc123");
    expect(result).toEqual({
      ok: false,
      reason: "other",
      error: "Something went wrong.",
    });
  });
});

describe("RAZORPAY_MOCK=true", () => {
  const originalEnv = process.env.RAZORPAY_MOCK;

  afterEach(() => {
    process.env.RAZORPAY_MOCK = originalEnv;
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("short-circuits createLink with deterministic fake data, no network call", async () => {
    process.env.RAZORPAY_MOCK = "true";
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { createLink: mockedCreateLink } = await import("./razorpay");
    const result = await mockedCreateLink(baseParams);

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("short-circuits cancelLink, simulating already_paid via a magic id", async () => {
    process.env.RAZORPAY_MOCK = "true";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());

    const { cancelLink: mockedCancelLink } = await import("./razorpay");
    const normal = await mockedCancelLink("plink_mockabc123");
    expect(normal).toEqual({ ok: true });

    const alreadyPaid = await mockedCancelLink("plink_mockalreadypaid123");
    expect(alreadyPaid.ok).toBe(false);
    if (!alreadyPaid.ok) {
      expect(alreadyPaid.reason).toBe("already_paid");
    }
  });
});
