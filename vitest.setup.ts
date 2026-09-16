import "@testing-library/jest-dom/vitest";

// Vitest doesn't auto-load .env.local the way `next dev`/`next build` do,
// unlike CI's `test` job (which sets these at the job level, already
// present in process.env by the time this runs) -- these are only a local
// fallback so lib/payments/env.ts's validation doesn't throw on import.
// No real Razorpay call ever uses these: razorpay.test.ts mocks fetch
// directly, and nothing else in the unit suite imports razorpay.ts.
process.env.RAZORPAY_KEY_ID ??= "rzp_test_vitest_placeholder";
process.env.RAZORPAY_KEY_SECRET ??= "vitest-placeholder-key-secret";
process.env.RAZORPAY_WEBHOOK_SECRET ??= "vitest-placeholder-webhook-secret";
