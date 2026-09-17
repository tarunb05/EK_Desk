import { describe, expect, it } from "vitest";
import { buildUpiPaymentUri } from "./upi-uri";

describe("buildUpiPaymentUri", () => {
  it("builds a upi://pay URI with every required field", () => {
    const uri = buildUpiPaymentUri({
      payeeVpa: "school@upi",
      payeeName: "EuroKids Kothanur",
      amountRupees: "4000.00",
      referenceCode: "EK-7F3KQ",
    });
    expect(uri).toBe(
      "upi://pay?pa=school%40upi&pn=EuroKids%20Kothanur&am=4000.00&cu=INR&tn=EK-7F3KQ",
    );
  });

  it("encodes an & and spaces in a personal payee name", () => {
    const uri = buildUpiPaymentUri({
      payeeVpa: "9876543210@upi",
      payeeName: "Kavya & Ramesh Narahari",
      amountRupees: "1000.00",
      referenceCode: "EK-ABCDE",
    });
    expect(uri).toContain(encodeURIComponent("Kavya & Ramesh Narahari"));
    expect(uri).not.toContain(" ");
  });

  it("always includes cu=INR", () => {
    const uri = buildUpiPaymentUri({
      payeeVpa: "a@b",
      payeeName: "A",
      amountRupees: "1.00",
      referenceCode: "EK-11111",
    });
    expect(uri).toContain("cu=INR");
  });
});
