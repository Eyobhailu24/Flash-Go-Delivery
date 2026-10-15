import * as WebBrowser from 'expo-web-browser';
import { api, jsonBody } from './auth-api';
import { queryClient } from './query';
export async function payForOrder(orderId: string) {
  const payment = await api<{ checkoutUrl: string }>(
    '/payments/telebirr/initialize',
    jsonBody({ orderId, client: 'mobile' }),
  );
  if (!payment.checkoutUrl.startsWith('https://'))
    throw new Error(
      'The payment provider did not return a secure checkout URL.',
    );
  try {
    await WebBrowser.openAuthSessionAsync(
      payment.checkoutUrl,
      'flashgo://payment-status',
    );
  } finally {
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
  }
}
