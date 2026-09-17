"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import {
  createPaymentRequest,
  getPaymentRequestDialogData,
  markNumberUnreachable,
  recordShareChannel,
  shareAgainPaymentRequest,
  type PaymentRequestActionState,
  type PaymentRequestDialogData,
  type ShareLinks,
} from "@/lib/payments/actions";
import { REQUEST_EXPIRY_DAYS } from "@/lib/domain/payment-request-expiry";

const initialState: PaymentRequestActionState = { error: null };

type PhoneField = "phone" | "whatsappPhone";

const EXPIRY_OPTIONS = REQUEST_EXPIRY_DAYS.map((days) => ({
  value: String(days),
  label: `${days} days`,
}));

function PhonePicker({
  data,
  value,
  onChange,
}: {
  data: PaymentRequestDialogData;
  value: PhoneField;
  onChange: (value: PhoneField) => void;
}) {
  const allOptions: { field: PhoneField; number: string | null; flagged: boolean }[] =
    [
      {
        field: "whatsappPhone",
        number: data.whatsappPhone,
        flagged: data.whatsappPhoneNotOnWhatsapp,
      },
      { field: "phone", number: data.phone, flagged: data.phoneNotOnWhatsapp },
    ];
  const options = allOptions.filter((o) => o.number);

  if (options.length === 0) {
    return (
      <p className="text-sm text-attention">
        This student has no phone number on record.
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm text-ink-secondary">Send to</legend>
      {options.map((option) => (
        <label
          key={option.field}
          className="flex items-center gap-2 text-sm text-ink"
        >
          <input
            type="radio"
            name="phoneField"
            value={option.field}
            checked={value === option.field}
            disabled={option.flagged}
            onChange={() => onChange(option.field)}
            className="h-4 w-4"
          />
          {option.number}
          {option.field === "whatsappPhone" ? " (WhatsApp number)" : ""}
          {option.flagged ? (
            <span className="text-2xs text-ink-muted">
              — flagged as not on WhatsApp
            </span>
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}

function ShareLinksView({
  share,
  studentId,
  phoneField,
  onSwitchNumber,
}: {
  share: ShareLinks;
  studentId: string;
  phoneField: PhoneField;
  onSwitchNumber: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [askedIfOpened, setAskedIfOpened] = useState(false);
  const [markState, markAction] = useActionState(
    async (_prev: { error: string | null }, formData: FormData) =>
      markNumberUnreachable(formData),
    { error: null },
  );

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(share.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      const formData = new FormData();
      formData.set("paymentRequestId", share.paymentRequestId);
      formData.set("sharedVia", "copied");
      formData.set("sharedToLast4", share.message.slice(-4));
      await recordShareChannel(formData);
    } catch {
      // Clipboard access can be denied by the browser -- the message text
      // is still visible and selectable, so this isn't a dead end.
    }
  }

  function recordWhatsAppShare() {
    const formData = new FormData();
    formData.set("paymentRequestId", share.paymentRequestId);
    formData.set("sharedVia", "whatsapp");
    formData.set("sharedToLast4", "");
    void recordShareChannel(formData);
    setAskedIfOpened(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        {share.amountDisplay} · Valid until {share.expiresAtDisplay} · Ref{" "}
        {share.referenceCode}
      </p>

      <pre className="whitespace-pre-wrap rounded-md border border-border bg-canvas p-3 text-2xs text-ink">
        {share.message}
      </pre>

      {!share.numberUsable ? (
        <p className="text-sm text-attention">
          This number doesn&apos;t look like a valid Indian mobile — WhatsApp
          and SMS links aren&apos;t available. Copy the message instead.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <a
            href={share.whatsappUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={recordWhatsAppShare}
            className={`${primaryButtonClassName} inline-flex h-9 items-center px-3 text-sm`}
          >
            Send on WhatsApp
          </a>
          <a
            href={share.smsUrl ?? undefined}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Send as SMS
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={copyMessage}
        className="self-start text-xs text-accent hover:underline"
      >
        {copied ? "Copied" : "Copy message"}
      </button>

      {askedIfOpened ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-canvas p-3">
          <p className="text-sm text-ink">Did WhatsApp open the chat?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAskedIfOpened(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Yes
            </button>
            <form action={markAction}>
              <input type="hidden" name="studentId" value={studentId} />
              <input type="hidden" name="phoneField" value={phoneField} />
              <button
                type="submit"
                onClick={() => {
                  setAskedIfOpened(false);
                  onSwitchNumber();
                }}
                className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Not on WhatsApp
              </button>
            </form>
          </div>
          <FormError error={markState.error} size="2xs" />
        </div>
      ) : null}
    </div>
  );
}

export function RequestPaymentDialog({
  feeAccountId,
  studentId,
  onClose,
}: {
  feeAccountId: string;
  studentId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<PaymentRequestDialogData | null | "loading">(
    "loading",
  );
  const [phoneField, setPhoneField] = useState<PhoneField>("whatsappPhone");
  const [collectionAccountId, setCollectionAccountId] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [share, setShare] = useState<ShareLinks | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [createState, createAction, createPending] = useActionState(
    createPaymentRequest,
    initialState,
  );

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;
    getPaymentRequestDialogData(feeAccountId).then((result) => {
      if (cancelled) return;
      setData(result);
      if (result) {
        const preferWhatsapp =
          result.whatsappPhone && !result.whatsappPhoneNotOnWhatsapp;
        const preferPhone = result.phone && !result.phoneNotOnWhatsapp;
        setPhoneField(preferWhatsapp ? "whatsappPhone" : preferPhone ? "phone" : "whatsappPhone");
        setCollectionAccountId(
          result.collectionAccounts.find((a) => a.isDefault)?.id ??
            result.collectionAccounts[0]?.id ??
            "",
        );
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feeAccountId is stable for this dialog's whole lifetime (a fresh instance mounts per open)
  }, []);

  useEffect(() => {
    if (createState !== initialState && createState.share) {
      setShare(createState.share);
    }
  }, [createState]);

  async function handleShareAgain(paymentRequestId: string) {
    setShareError(null);
    const result = await shareAgainPaymentRequest(paymentRequestId, phoneField);
    if (result.error) {
      setShareError(result.error);
    } else if (result.share) {
      setShare(result.share);
    }
  }

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="request-payment-title"
      className="w-full max-w-md rounded-md border border-border bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop:bg-ink/30"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 id="request-payment-title" className="text-base font-medium text-ink">
            Request payment
          </h2>
          <button
            type="button"
            onClick={closeDialog}
            className="text-sm text-ink-secondary hover:text-ink"
          >
            Close
          </button>
        </div>

        {data === "loading" ? (
          <p className="text-sm text-ink-secondary">Loading…</p>
        ) : !data ? (
          <p className="text-sm text-ink-secondary">
            Could not load this fee account.
          </p>
        ) : share ? (
          <ShareLinksView
            share={share}
            studentId={studentId}
            phoneField={phoneField}
            onSwitchNumber={() =>
              setPhoneField((current) =>
                current === "whatsappPhone" ? "phone" : "whatsappPhone",
              )
            }
          />
        ) : data.existingRequest ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-secondary">
              Already open: {data.existingRequest.amountDisplay} · valid
              until {data.existingRequest.expiresAtDisplay} · ref{" "}
              {data.existingRequest.referenceCode}
            </p>
            <PhonePicker data={data} value={phoneField} onChange={setPhoneField} />
            <FormError error={shareError} />
            <button
              type="button"
              onClick={() => handleShareAgain(data.existingRequest!.id)}
              className={`${primaryButtonClassName} h-9 self-start px-3 text-sm`}
            >
              Share again
            </button>
            <p className="text-2xs text-ink-muted">
              Creating a new link below cancels this one first.
            </p>
          </div>
        ) : !data.hasPending ? (
          <p className="text-sm text-ink-secondary">
            Nothing pending for this account.
          </p>
        ) : null}

        {data && data !== "loading" && !share && data.hasPending ? (
          <form action={createAction} noValidate className="flex flex-col gap-3">
            <input type="hidden" name="feeAccountId" value={feeAccountId} />
            <input type="hidden" name="phoneField" value={phoneField} />
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

            <Field
              label="Collection account"
              error={createState.fieldErrors?.collectionAccountId}
            >
              <Select
                name="collectionAccountId"
                ariaLabel="Collection account"
                value={collectionAccountId}
                onChange={setCollectionAccountId}
                options={data.collectionAccounts.map((a) => ({
                  value: a.id,
                  label: a.isDefault ? `${a.label} (default)` : a.label,
                }))}
              />
            </Field>

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  name="includeUpi"
                  defaultChecked
                  className="h-4 w-4"
                />
                Include UPI details
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" name="includeBank" className="h-4 w-4" />
                Include bank transfer details
              </label>
              <FormError error={createState.fieldErrors?.includeUpi} />
            </div>

            <Field label="Link expires in">
              <Select
                name="expiryDays"
                ariaLabel="Link expires in"
                value={expiryDays}
                onChange={setExpiryDays}
                options={EXPIRY_OPTIONS}
              />
            </Field>

            <PhonePicker data={data} value={phoneField} onChange={setPhoneField} />

            <FormError error={createState.error} />

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
        ) : null}
      </div>
    </dialog>
  );
}
