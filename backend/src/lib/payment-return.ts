import { createHmac, timingSafeEqual } from 'node:crypto';
const secret = () => process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret';
export const signMobilePaymentReturn = (txRef: string) =>
  createHmac('sha256', secret())
    .update(`mobile-payment:${txRef}`)
    .digest('hex');
export function isMobilePaymentReturn(txRef: string, signature?: string) {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(signMobilePaymentReturn(txRef), 'hex'),
  );
}
