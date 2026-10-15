type PriceFields = {
  totalPrice: string;
  deliveryFee: string;
  serviceCharge: string;
  payment?: { amount: string } | null;
};
// The existing API's totalPrice is the item subtotal, not the amount to collect.
export function orderPayableTotal(
  order: PriceFields,
  payment = order.payment,
): string {
  if (payment?.amount != null) return payment.amount;
  const cents = [
    order.totalPrice,
    order.deliveryFee,
    order.serviceCharge,
  ].reduce((sum, value) => sum + Math.round(Number(value || 0) * 100), 0);
  return (cents / 100).toFixed(2);
}
