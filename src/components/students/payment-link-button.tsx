"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  dangerButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import {
  cancelPaymentLink,
  createPaymentLink,
  getPaymentLinkButtonData,
  type PaymentLinkActionState,
  type PaymentLinkButtonData,
} from "@/lib/payments/actions";
import { PAYMENT_LINK_EXPIRY_DAYS } from "@/lib/domain/payment-request";

const initialState: PaymentLinkActionState = { error: null };

const EXPIRY_OPTIONS = PAYMENT_LINK_EXPIRY_DAYS.map((days) => ({
  value: String(days),
  label: days === 1 ? "1 day" : `${days} days`,
}));

export function PaymentLinkButton({ feeAccountId }: { feeAccountId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
      >
        Payment link
      </button>

      {/* Mounted only while open, same reasoning as SupportRequestDialog:
          useActionState's state lives on this instance, and unmounting on
          close is what makes a second open start fresh instead of
          replaying the previous submission's state. */}
      {open ? (
        <PaymentLinkDialog
          feeAccountId={feeAccountId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function PaymentLinkDialog({
  feeAccountId,
  onClose,
}: {
  feeAccountId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expiryDays, setExpiryDays] = useState("7");
  // Starts true when there's already an open link (brief: the dialog
  // opens directly on that view) -- flipping it false swaps to the create
  // form without closing/reopening the dialog.
  const [creatingNew, setCreatingNew] = useState(false);
  const [createState, createAction, createPending] = useActionState(
    createPaymentLink,
    initialState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelPaymentLink,
    initialState,
  );
  const [copied, setCopied] = useState(false);

  // Fetched on open, not passed as props from the Students list's own
  // server render -- an earlier version batched this into every page load
  // for every row (two extra Supabase queries each), which measurably
  // tightened e2e timing margins in CI even though nothing was wrong with
  // the interaction itself. On-demand costs one round trip only when this
  // dialog is actually opened.
  const [data, setData] = useState<PaymentLinkButtonData | null | "loading">(
    "loading",
  );

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;
    getPaymentLinkButtonData(feeAccountId).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feeAccountId is stable for this dialog's whole lifetime (a fresh instance mounts per open, see PaymentLinkButton's comment)
  }, []);

  // A just-created link (this session) takes priority over the one fetched
  // on open; a just-cancelled one clears back to the create form without
  // needing to close and reopen the dialog.
  const activeLink =
    createState !== initialState && createState.link
      ? { ...createState.link, amountDisplay: null as string | null }
      : cancelState !== initialState && !cancelState.error
        ? null
        : creatingNew
          ? null
          : data !== "loading" && data
            ? data.existingLink
            : null;

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

  async function copyLink(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser -- the link text is
      // still visible and selectable, so this isn't a dead end, just a
      // missed shortcut.
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="payment-link-title"
      className="w-full max-w-sm rounded-md border border-border bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop:bg-ink/30"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id="payment-link-title" className="text-base font-medium text-ink">
          Payment link
        </h2>

        {data === "loading" ? (
          <p className="text-sm text-ink-secondary">Loading…</p>
        ) : !data ? (
          <p className="text-sm text-ink-secondary">
            Could not load this fee account.
          </p>
        ) : !data.hasPending && !activeLink ? (
          <p className="text-sm text-ink-secondary">
            Nothing pending for this account.
          </p>
        ) : activeLink ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-secondary">
              {activeLink.amountDisplay
                ? `${activeLink.amountDisplay} · `
                : ""}
              Valid until {formatExpiry(activeLink.expiresAt)}
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2 text-sm text-ink">
              <span className="min-w-0 flex-1 truncate">
                {activeLink.shortUrl}
              </span>
              <button
                type="button"
                onClick={() => copyLink(activeLink.shortUrl)}
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>

            <FormError error={cancelState.error} />

            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="self-start text-xs text-accent hover:underline"
            >
              Create a new link
            </button>
            <p className="text-2xs text-ink-muted">
              Creating a new link cancels this one first.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="h-9 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Close
              </button>
              <form action={cancelAction}>
                <input type="hidden" name="paymentRequestId" value={activeLink.id} />
                <button
                  type="submit"
                  disabled={cancelPending}
                  className={`${dangerButtonClassName} h-9 px-3 text-sm`}
                >
                  {cancelPending ? "Cancelling…" : "Cancel link"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <form action={createAction} noValidate className="flex flex-col gap-3">
            <input type="hidden" name="feeAccountId" value={feeAccountId} />
            <p className="text-sm text-ink-secondary">
              Pending: {data.pendingDisplay}
            </p>

            <Field label="Amount (₹)" error={createState.fieldErrors?.amount}>
              <input
                name="amount"
                inputMode="decimal"
                required
                defaultValue={data.defaultAmountInput}
                className={inputClassName}
              />
            </Field>

            <Field label="Link expires in">
              <Select
                name="expiryDays"
                ariaLabel="Link expires in"
                value={expiryDays}
                onChange={setExpiryDays}
                options={EXPIRY_OPTIONS}
              />
            </Field>

            <FormError error={createState.error} />
            {createState.warning ? (
              <p className="text-xs text-attention">{createState.warning}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="h-9 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPending}
                className={`${primaryButtonClassName} h-9 px-3 text-sm`}
              >
                {createPending ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
