import { describe, expect, it } from "vitest";
import {
  canTransitionFeeAccountStatus,
  canTransitionStudentStatus,
} from "./student-status";

describe("canTransitionStudentStatus", () => {
  it("allows active to inactive", () => {
    expect(canTransitionStudentStatus("active", "inactive")).toBe(true);
  });

  it("allows inactive to active", () => {
    expect(canTransitionStudentStatus("inactive", "active")).toBe(true);
  });

  it("allows active to withdrawn", () => {
    expect(canTransitionStudentStatus("active", "withdrawn")).toBe(true);
  });

  it("allows inactive to withdrawn", () => {
    expect(canTransitionStudentStatus("inactive", "withdrawn")).toBe(true);
  });

  it("allows withdrawn back to active (re-enrollment)", () => {
    expect(canTransitionStudentStatus("withdrawn", "active")).toBe(true);
  });

  it("rejects withdrawn to inactive (must go through active)", () => {
    expect(canTransitionStudentStatus("withdrawn", "inactive")).toBe(false);
  });

  it("rejects a status transitioning to itself", () => {
    expect(canTransitionStudentStatus("active", "active")).toBe(false);
    expect(canTransitionStudentStatus("inactive", "inactive")).toBe(false);
    expect(canTransitionStudentStatus("withdrawn", "withdrawn")).toBe(false);
  });
});

describe("canTransitionFeeAccountStatus", () => {
  it("allows active to discontinued", () => {
    expect(canTransitionFeeAccountStatus("active", "discontinued")).toBe(
      true,
    );
  });

  it("allows discontinued back to active", () => {
    expect(canTransitionFeeAccountStatus("discontinued", "active")).toBe(
      true,
    );
  });

  it("rejects a status transitioning to itself", () => {
    expect(canTransitionFeeAccountStatus("active", "active")).toBe(false);
    expect(canTransitionFeeAccountStatus("discontinued", "discontinued")).toBe(
      false,
    );
  });
});
