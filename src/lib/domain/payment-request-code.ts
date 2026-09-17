// Excludes 0/O and 1/I/L -- ambiguous by sight, easy to mistype retyping a
// code off a WhatsApp message. 32 remaining characters need exactly 5 bits
// each, so one random byte (0-255) maps via `% 32` with a uniform
// distribution -- 256 divides evenly by 32, so there's no modulo bias to
// correct for at this alphabet size.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERENCE_CODE_LENGTH = 5;
export const REFERENCE_CODE_PREFIX = "EK-";

// Pure: takes the random bytes it needs as a parameter instead of reading
// crypto itself, so it's directly unit-testable with fixed bytes.
// generateReferenceCode below is the one real caller. The retry-on-conflict
// loop (this alphabet gives 32^5 ≈ 33.5M codes, so a collision is rare but
// not impossible) is a Server Action concern in 15.3, not this function's.
export function referenceCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < REFERENCE_CODE_LENGTH) {
    throw new Error(`Need at least ${REFERENCE_CODE_LENGTH} random bytes.`);
  }
  let code = "";
  for (let i = 0; i < REFERENCE_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${REFERENCE_CODE_PREFIX}${code}`;
}

export function generateReferenceCode(): string {
  return referenceCodeFromBytes(
    crypto.getRandomValues(new Uint8Array(REFERENCE_CODE_LENGTH)),
  );
}
