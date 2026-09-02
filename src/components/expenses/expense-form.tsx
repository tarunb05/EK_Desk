"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { DateField } from "@/components/forms/date-field";
import {
  EXPENSE_SANITY_CEILING_PAISE,
  formatPaise,
  parseRupeesToPaise,
} from "@/lib/domain/money";
import {
  recordExpense,
  updateExpense,
  type ActionState,
} from "@/lib/records/actions";
import type { Role } from "@/lib/auth/routes";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";
import type { ExpenseCategoryOption } from "@/lib/records/expense-directory";

const initialState: ActionState = { error: null };

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
];

interface ExpenseFormDefaults {
  categoryId: string;
  amountRupees: string;
  spentOn: string;
  method: string;
  reference: string;
  note: string;
  branchId: string;
}

interface ExpenseFormProps {
  mode: "create" | "edit";
  expenseId?: string;
  role: Role;
  teacherBranchName?: string;
  branches: BranchOption[];
  categories: ExpenseCategoryOption[];
  academicYearId: string;
  defaultValues?: ExpenseFormDefaults;
}

export function ExpenseForm({
  mode,
  expenseId,
  role,
  teacherBranchName,
  branches,
  categories,
  academicYearId,
  defaultValues,
}: ExpenseFormProps) {
  const action = mode === "create" ? recordExpense : updateExpense;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [categoryId, setCategoryId] = useState(
    defaultValues?.categoryId ?? categories[0]?.id ?? "",
  );
  const [method, setMethod] = useState(defaultValues?.method ?? "cash");
  const [branchId, setBranchId] = useState(
    defaultValues?.branchId ?? branches[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(defaultValues?.amountRupees ?? "");
  // Two clicks for an amount over the sanity ceiling: the first is
  // intercepted client-side (no server round trip needed for the common
  // case) and shows this, arming a hidden confirmed=true field for the
  // second click. The Server Action enforces the same ceiling
  // independently -- confirmAmountPaise below is that backstop, for a
  // request that reaches it without ever going through this client check.
  const [showConfirm, setShowConfirm] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (showConfirm) return;
    const paise = parseRupeesToPaise(amount);
    if (paise !== null && paise > EXPENSE_SANITY_CEILING_PAISE) {
      event.preventDefault();
      setShowConfirm(true);
    }
  }

  const confirmAmountPaise = state.confirmAmountPaise
    ? BigInt(state.confirmAmountPaise)
    : null;

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {expenseId ? (
        <input type="hidden" name="expenseId" value={expenseId} />
      ) : null}
      <input type="hidden" name="academicYearId" value={academicYearId} />
      {showConfirm || confirmAmountPaise ? (
        <input type="hidden" name="confirmed" value="true" />
      ) : null}

      <Field label="Category" error={state.fieldErrors?.categoryId}>
        <Select
          name="categoryId"
          ariaLabel="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
      </Field>

      <Field label="Amount (₹)" error={state.fieldErrors?.amount}>
        <input
          name="amount"
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="1234.50"
          className={inputClassName}
        />
      </Field>

      <Field label="Date" error={state.fieldErrors?.spentOn}>
        <DateField
          name="spentOn"
          required
          ariaLabel="Date"
          defaultValue={defaultValues?.spentOn}
        />
      </Field>

      <Field label="Method" error={state.fieldErrors?.method}>
        <Select
          name="method"
          ariaLabel="Method"
          value={method}
          onChange={setMethod}
          options={METHOD_OPTIONS}
        />
      </Field>

      <Field label="Reference (optional)">
        <input
          name="reference"
          defaultValue={defaultValues?.reference}
          className={inputClassName}
        />
      </Field>

      <Field label="Note (optional)">
        <input
          name="note"
          defaultValue={defaultValues?.note}
          className={inputClassName}
        />
      </Field>

      {role === "admin" ? (
        <Field label="Branch" error={state.fieldErrors?.branchId}>
          <Select
            name="branchId"
            ariaLabel="Branch"
            value={branchId}
            onChange={setBranchId}
            options={branches.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
          />
        </Field>
      ) : (
        <div className="flex flex-col gap-1 text-sm text-ink-secondary">
          <span>Branch</span>
          <span className="text-ink">{teacherBranchName}</span>
        </div>
      )}

      {showConfirm ? (
        <p className="text-sm text-ink">
          That&apos;s {formatPaise(parseRupeesToPaise(amount) ?? 0n)} — an
          unusually large expense. Select the button again to confirm.
        </p>
      ) : null}
      {confirmAmountPaise ? (
        <p className="text-sm text-ink">
          That&apos;s {formatPaise(confirmAmountPaise)} — an unusually large
          expense. Select the button again to confirm.
        </p>
      ) : null}

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={`${primaryButtonClassName} flex items-center justify-center gap-2`}
      >
        {isPending ? (
          <>
            {/* Same loading-ring pattern as the Sign in button (login-form.tsx)
                -- border-surface since this sits on the same dark --accent
                background. */}
            <span
              aria-hidden="true"
              className="animate-loading-ring h-4 w-4 rounded-full border-2 border-surface/30 border-t-surface"
            />
            Saving…
          </>
        ) : showConfirm || confirmAmountPaise ? (
          "Confirm and record"
        ) : mode === "create" ? (
          "Record expense"
        ) : (
          "Save changes"
        )}
      </button>
    </form>
  );
}
