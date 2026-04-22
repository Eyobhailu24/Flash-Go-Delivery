/** Ethiopian mobile in E.164: +251 plus 9 subscriber digits (e.g. 7xx… or 9xx…). */
export const ETHIOPIA_E164_REGEX = /^\+251\d{9}$/;

export function sanitizeEthiopiaNationalInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 9);
}

/** Build E.164 from the 9 digits the user types after +251. */
export function toEthiopiaE164(nationalDigits: string): string | null {
  const d = sanitizeEthiopiaNationalInput(nationalDigits);
  return d.length === 9 ? `+251${d}` : null;
}

export function isValidEthiopiaE164(phone: string): boolean {
  return ETHIOPIA_E164_REGEX.test(phone.replace(/\s+/g, ""));
}

/** Map stored full number to the 9-digit national part for the input field. */
export function nationalDigitsFromStoredPhone(
  stored: string | null | undefined,
): string {
  if (!stored) return "";
  const compact = stored.replace(/\s+/g, "");
  if (ETHIOPIA_E164_REGEX.test(compact)) {
    return compact.slice(4);
  }
  const digits = compact.replace(/\D/g, "");
  if (digits.startsWith("251") && digits.length >= 12) {
    return digits.slice(3, 12);
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return digits.slice(1, 10);
  }
  if (digits.length === 9) {
    return digits;
  }
  return sanitizeEthiopiaNationalInput(compact);
}
