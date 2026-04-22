/** Ethiopian mobile in E.164: +251 plus nine subscriber digits. */
export const ETHIOPIA_PHONE_E164 = /^\+251\d{9}$/;

/**
 * Normalizes phone input (web forms, Telegram contacts, pasted numbers)
 * toward `+251` + nine digits, matching stored `users.phoneNumber` values.
 */
export function normalizePhone(phoneNumber: string): string {
  const trimmed = phoneNumber.replace(/\s+/g, '');

  if (ETHIOPIA_PHONE_E164.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('+')) {
    const restDigits = trimmed.slice(1).replace(/\D/g, '');
    if (restDigits.startsWith('251') && restDigits.length >= 12) {
      return `+${restDigits.slice(0, 12)}`;
    }
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.startsWith('251') && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+251${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `+251${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('251')) {
    return `+${digits}`;
  }

  return trimmed;
}
