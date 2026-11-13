"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteEnrollment,
  permanentlyDeleteStudent,
  requestEnrollmentDelete,
  requestStudentDelete,
} from "@/lib/records/actions";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { RequestPaymentDialog } from "./request-payment-dialog";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/shell/action-menu";
import { FormError } from "@/components/forms/field";
import type { Role } from "@/lib/auth/routes";
import type { ServiceType } from "@/lib/records/types";

// One enrollment a student has, already labelled and linked by the server
// (the links differ by role: /transport and /daycare are admin-only, so a
// teacher's pages live under /students).
export interface EnrollmentOption {
  feeAccountId: string;
  label: string;
  serviceType: ServiceType;
  active: boolean;
  editHref: string;
  paymentHref: string;
}

// The student's single Actions menu. Edit, Record payment and Request
// payment act on an enrollment, so a student with more than one gets a list
// of them inside the option to choose from (with one, the option just
// goes). Re-enroll and Delete are about the student, not an enrollment, so
// there's nothing to choose: Re-enroll opens the form, and Delete is direct
// for an admin or a request for an admin to approve from a teacher.
export function RowActionMenu({
  studentId,
  studentName,
  role,
  enrollments,
}: {
  studentId: string;
  studentName: string;
  role: Role;
  enrollments: EnrollmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // The enrollment a payment request is being made for; the dialog is
  // mounted only while this is set.
  const [requestPaymentFor, setRequestPaymentFor] = useState<string | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The enrollment chosen for deletion; its own confirmation dialog.
  const [enrollmentToDelete, setEnrollmentToDelete] =
    useState<EnrollmentOption | null>(null);
  const enrollmentDialogRef = useRef<HTMLDialogElement>(null);

  function handleDeleteEnrollment() {
    if (!enrollmentToDelete) return;
    const feeAccountId = enrollmentToDelete.feeAccountId;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("feeAccountId", feeAccountId);
      const action =
        role === "admin" ? deleteEnrollment : requestEnrollmentDelete;
      const result = await action({ error: null }, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.submitted) {
        setSubmitted(true);
      }
    });
  }

  function openDeleteEnrollmentDialog(enrollment: EnrollmentOption) {
    setError(null);
    setEnrollmentToDelete(enrollment);
    // Same deferral as openDeleteDialog below.
    setTimeout(() => enrollmentDialogRef.current?.showModal(), 0);
  }

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("studentId", studentId);
      const action =
        role === "admin" ? permanentlyDeleteStudent : requestStudentDelete;
      const result = await action({ error: null }, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.submitted) {
        setSubmitted(true);
      }
    });
  }

  function openDeleteDialog() {
    setError(null);
    // Deferring past this tick avoids the confirm dialog's showModal()
    // racing the menu's own portal-unmount from the same click -- both
    // want to touch the DOM in the same event, and the dialog needs to
    // win second.
    setTimeout(() => dialogRef.current?.showModal(), 0);
  }

  // One enrollment: the option acts on it directly. Several: the option
  // lists them. None: the option isn't offered.
  function forEnrollments(
    label: string,
    list: EnrollmentOption[],
    act: (enrollment: EnrollmentOption) => void,
  ): ActionMenuItem[] {
    const [only, ...rest] = list;
    if (!only) return [];
    if (rest.length === 0) return [{ label, onSelect: () => act(only) }];
    return [
      {
        label,
        choices: list.map((enrollment) => ({
          label: enrollment.label,
          onSelect: () => act(enrollment),
        })),
      },
    ];
  }

  const items: ActionMenuItem[] = [
    ...forEnrollments("Edit", enrollments, (e) => router.push(e.editHref)),
    ...forEnrollments("Record payment", enrollments, (e) =>
      router.push(e.paymentHref),
    ),
    // Only an active enrollment can have a payment requested against it.
    ...forEnrollments(
      "Request payment",
      enrollments.filter((e) => e.active),
      (e) => setRequestPaymentFor(e.feeAccountId),
    ),
    // Re-enrolling is for a returning daycare student. It's about the
    // student, not one of their stints, so it goes straight to the form
    // (pre-filled from what's on file) with nothing to choose first.
    ...(enrollments.some((e) => e.serviceType === "daycare")
      ? [
          {
            label: "Re-enroll",
            onSelect: () => router.push(`/students/re-enroll/${studentId}`),
          },
        ]
      : []),
    // Removes just the chosen enrollment (and its payments), not the
    // student: an admin deletes it directly, a teacher sends a request for
    // an admin to approve. Not offered for a student's only enrollment: that
    // would leave a student with nothing on file, which is what Delete
    // permanently is for.
    ...(enrollments.length > 1
      ? forEnrollments(
          role === "admin"
            ? "Delete enrollment"
            : "Request enrollment deletion",
          enrollments,
          openDeleteEnrollmentDialog,
        ).map((item) => ({ ...item, destructive: true }))
      : []),
    {
      label: role === "admin" ? "Delete permanently" : "Request deletion",
      onSelect: openDeleteDialog,
      destructive: true,
    },
  ];

  return (
    <div className="inline-flex flex-col gap-1">
      <ActionMenu items={items} disabled={isPending} />
      <FormError error={error} size="2xs" />
      {submitted ? (
        <span className="text-2xs text-ink-secondary">
          Submitted for admin approval.
        </span>
      ) : null}
      <DeleteConfirmDialog
        dialogRef={enrollmentDialogRef}
        title={`${role === "admin" ? "Delete" : "Request deletion of"} ${enrollmentToDelete?.label ?? "this enrollment"}?`}
        message={
          role === "admin"
            ? `This removes this enrollment of ${studentName}, and every payment recorded on it, from the database. ${studentName} and their other enrollments stay. This cannot be undone. To keep the record, set it to Discontinued from Edit instead.`
            : `This sends a request to an admin to delete this enrollment of ${studentName} and every payment recorded on it. Nothing is removed unless and until they approve it. To keep the record, set it to Discontinued from Edit instead.`
        }
        confirmLabel={
          role === "admin" ? "Delete enrollment" : "Request deletion"
        }
        destructive={role === "admin"}
        onConfirm={handleDeleteEnrollment}
      />
      <DeleteConfirmDialog
        dialogRef={dialogRef}
        title={
          role === "admin"
            ? `Delete ${studentName}?`
            : `Request deletion of ${studentName}?`
        }
        message={
          role === "admin"
            ? "This removes the student and every fee account and payment they have from the database. This cannot be undone."
            : "This sends a delete request to an admin for approval. Nothing is removed unless and until they approve it."
        }
        confirmLabel={
          role === "admin" ? "Delete permanently" : "Request deletion"
        }
        destructive={role === "admin"}
        onConfirm={handleDelete}
      />
      {/* Mounted only while open -- a fresh instance per open means a
          second open starts clean instead of replaying the previous
          submission's state, same reasoning as every other Phase 15
          dialog. */}
      {requestPaymentFor ? (
        <RequestPaymentDialog
          feeAccountId={requestPaymentFor}
          studentId={studentId}
          onClose={() => setRequestPaymentFor(null)}
        />
      ) : null}
    </div>
  );
}
