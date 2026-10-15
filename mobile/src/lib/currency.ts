export function toMoneyNumber(
  value: string | number | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatBirr(value: string | number | null | undefined): string {
  return `${toMoneyNumber(value).toFixed(2)} Birr`;
}

export function hasDiscount(
  discount: string | number | null | undefined,
): boolean {
  return toMoneyNumber(discount) > 0;
}

export function discountLabel(
  discount: string | number | null | undefined,
): string {
  return `${toMoneyNumber(discount).toFixed(0)} Birr off`;
}

export function discountedPrice(
  price: string | number | null | undefined,
  discount: string | number | null | undefined,
): number {
  return Math.max(toMoneyNumber(price) - toMoneyNumber(discount), 0);
}

export function formatDiscountedBirr(
  price: string | number | null | undefined,
  discount: string | number | null | undefined,
): string {
  return formatBirr(discountedPrice(price, discount));
}
