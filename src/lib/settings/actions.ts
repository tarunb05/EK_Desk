"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createAcademicYearSchema,
  createBranchSchema,
} from "@/lib/settings/schemas";

export interface ActionState {
  error: string | null;
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

// Every screen that reads years/branches (dashboards, the student directory,
// the add-student forms) lives under one of these three layouts — revalidate
// the whole layout subtree rather than each page individually, so a new
// /transport/new or /daycare/[feeAccountId] doesn't silently need its own
// entry added here later.
function revalidateScopeDependents() {
  revalidatePath("/transport", "layout");
  revalidatePath("/daycare", "layout");
  revalidatePath("/students");
  revalidatePath("/settings");
}

export async function createAcademicYear(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createAcademicYearSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const value = parsed.data;
  const supabase = await createClient();

  if (value.isCurrent) {
    const { error: unsetError } = await supabase
      .from("academic_year")
      .update({ is_current: false })
      .eq("is_current", true);

    if (unsetError) {
      return { error: "Could not update the current academic year." };
    }
  }

  const { error } = await supabase.from("academic_year").insert({
    label: value.label,
    starts_on: value.startsOn,
    ends_on: value.endsOn,
    is_current: value.isCurrent,
  });

  if (error) {
    return {
      error:
        "Could not save the academic year — check the label isn't already used.",
    };
  }

  revalidateScopeDependents();
  return { error: null };
}

export async function createBranch(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createBranchSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const value = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("branch").insert({
    code: value.code,
    name: value.name,
  });

  if (error) {
    return {
      error: "Could not save the branch — check the code isn't already used.",
    };
  }

  revalidateScopeDependents();
  return { error: null };
}
