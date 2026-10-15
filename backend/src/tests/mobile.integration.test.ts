import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../app.js';
import { db, closeDb } from '../db.js';
import { DEMO_PASSWORD, seedMobileDemo } from '../lib/demo-data.js';
import {
  orders,
  users,
  categoryNameCatalog,
  notificationDevices,
  notifications,
  payments,
  mobileSessions,
} from '../schema.js';
import { signMobilePaymentReturn } from '../lib/payment-return.js';

// These integration tests require the configured disposable Neon database.
// Every account belongs to this run; external network services are blocked/mocked.
test('mobile API integration', { timeout: 180_000 }, async (t) => {
  process.env.PUSH_ENABLED = 'false';
  process.env.OTP_BYPASS = 'false';
  const originalFetch = globalThis.fetch;
  const fixture = await seedMobileDemo(true);
  const sessions: Record<
    string,
    {
      accessToken: string;
      refreshToken: string;
      user: { id: string; role: string };
    }
  > = {};
  let chapaReturn = '';
  let verified = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/transaction/initialize')) {
      const body = JSON.parse(String(init?.body));
      chapaReturn = body.return_url;
      return Response.json({
        status: 'success',
        data: { checkout_url: 'https://checkout.example.test/pay' },
      });
    }
    if (url.includes('/transaction/verify/'))
      return Response.json({
        status: 'success',
        data: { status: verified ? 'success' : 'pending' },
      });
    throw new Error(
      `External network call blocked in test: ${new URL(url).hostname}`,
    );
  };
  async function request(
    path: string,
    role?: string,
    method = 'GET',
    body?: unknown,
    status = 200,
  ) {
    const res = await app.request(path, {
      method,
      headers: {
        ...(role
          ? { Authorization: `Bearer ${sessions[role].accessToken}` }
          : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await res.json()) as any;
    assert.equal(
      res.status,
      status,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return data;
  }
  try {
    await t.test(
      'all four native roles, website cookies, access restrictions',
      async () => {
        for (const account of fixture.accounts) {
          sessions[account.role] = await request(
            '/auth/mobile/login',
            undefined,
            'POST',
            {
              phoneNumber: account.phoneNumber,
              password: process.env.MOBILE_DEMO_PASSWORD || DEMO_PASSWORD,
            },
          );
          assert.equal(sessions[account.role].user.role, account.role);
          assert.equal(
            (await request('/auth/me', account.role)).user.id,
            account.id,
          );
        }
        await request('/users', 'customer', 'GET', undefined, 403);
        await request('/orders/my', 'driver', 'GET', undefined, 403);
        await request('/orders/admin', 'admin');
        await request('/orders/business', 'business');
        const customer = fixture.accounts[0];
        const res = await app.request('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: customer.phoneNumber,
            password: process.env.MOBILE_DEMO_PASSWORD || DEMO_PASSWORD,
          }),
        });
        assert.equal(res.status, 200);
        const cookies = res.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ');
        assert.match(cookies, /access_token=/);
        assert.equal(
          (await app.request('/auth/me', { headers: { Cookie: cookies } }))
            .status,
          200,
        );
      },
    );
    await t.test(
      'refresh rotation rejects replay and logout revokes access',
      async () => {
        const account = fixture.accounts[0];
        const fresh = await request('/auth/mobile/login', undefined, 'POST', {
          phoneNumber: account.phoneNumber,
          password: process.env.MOBILE_DEMO_PASSWORD || DEMO_PASSWORD,
        });
        const rotated = await request(
          '/auth/mobile/refresh',
          undefined,
          'POST',
          { refreshToken: fresh.refreshToken },
        );
        assert.notEqual(rotated.refreshToken, fresh.refreshToken);
        await request(
          '/auth/mobile/refresh',
          undefined,
          'POST',
          { refreshToken: fresh.refreshToken },
          401,
        );
        await request('/auth/mobile/logout', undefined, 'POST', {
          refreshToken: rotated.refreshToken,
        });
        assert.equal(
          (
            await app.request('/auth/me', {
              headers: { Authorization: `Bearer ${rotated.accessToken}` },
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      'catalog, cart limits, cash checkout, business approval, driver delivery, feedback',
      async () => {
        const menu = await request(
          `/catalog/category-items?categoryNameId=${fixture.categoryNameId}`,
        );
        assert.equal(menu.items[0].id, fixture.itemId);
        const cart = await request(
          '/carts',
          'customer',
          'POST',
          { businessId: fixture.ids.business },
          201,
        );
        await request(
          `/carts/${cart.cart.id}/items`,
          'customer',
          'POST',
          { categoryItemId: fixture.itemId, quantity: 2 },
          201,
        );
        const overLimit = await app.request(`/carts/${cart.cart.id}/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessions.customer.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ categoryItemId: fixture.itemId, quantity: 5 }),
        });
        assert.equal(overLimit.status, 409);
        const estimate = await request(
          '/orders/checkout/estimate',
          'customer',
          'POST',
          { cartId: cart.cart.id },
        );
        assert.equal(Number(estimate.subtotal), 450);
        assert.equal(
          Number(estimate.totalAmount),
          Number(estimate.subtotal) +
            Number(estimate.deliveryFee) +
            Number(estimate.serviceCharge),
        );
        const placed = await request(
          '/orders/checkout',
          'customer',
          'POST',
          { cartId: cart.cart.id, paymentMethod: 'cash' },
          201,
        );
        const id = placed.order.id;
        assert.equal(placed.order.status, 'pending_confirmation');
        assert.equal(placed.payment.amount, estimate.totalAmount);
        await request(
          `/orders/business/${id}/approve`,
          'business',
          'POST',
          undefined,
          409,
        );
        const code = '7'.repeat(Number(process.env.DELIVERY_CODE_LENGTH ?? 5));
        await db
          .update(orders)
          .set({
            cancelExpiresAt: new Date(Date.now() - 1000),
            deliveryCodeHash: createHash('sha256').update(code).digest('hex'),
          })
          .where(eq(orders.id, id));
        await request(
          '/driver-dispatch/location',
          'driver',
          'POST',
          { lat: 8.9957, lng: 38.7855 },
          201,
        );
        await request(`/orders/business/${id}`, 'business');
        await request(`/orders/business/${id}/approve`, 'business', 'POST');
        const offer = await request(
          '/driver-dispatch/offers/current',
          'driver',
        );
        assert.equal(offer.offer.order.id, id);
        await request(
          `/driver-dispatch/offers/${offer.offer.id}/accept`,
          'driver',
          'POST',
        );
        await request(`/driver-dispatch/orders/${id}/start`, 'driver', 'POST');
        const tracking = await request(`/orders/${id}/tracking`, 'customer');
        assert.equal(tracking.driver.id, fixture.ids.driver);
        await request(
          `/driver-dispatch/orders/${id}/deliver`,
          'driver',
          'POST',
          { deliveryCode: code },
        );
        const detail = await request(`/orders/${id}`, 'customer');
        assert.equal(detail.order.status, 'delivered');
        assert.equal(detail.payment.status, 'paid');
        await request(
          `/orders/${id}/feedback`,
          'customer',
          'POST',
          { rating: 5, comment: 'Integration test delivery' },
          201,
        );
      },
    );
    await t.test(
      'package order and signed mobile payment return, provider verification mocked',
      async () => {
        const estimate = await request(
          '/orders/package/estimate',
          'customer',
          'POST',
          {
            pickup: { address: 'Demo pickup', lat: 8.9957, lng: 38.7855 },
            dropoff: { address: 'Demo destination', lat: 8.9948, lng: 38.7864 },
          },
        );
        const placed = await request(
          '/orders/package',
          'customer',
          'POST',
          {
            paymentMethod: 'telebirr',
            pickup: { address: 'Demo pickup', lat: 8.9957, lng: 38.7855 },
            dropoff: { address: 'Demo destination', lat: 8.9948, lng: 38.7864 },
            packageNote: 'Integration test package',
          },
          201,
        );
        assert.equal(placed.payment.amount, '200.00');
        assert.equal(placed.payment.amount, estimate.totalAmount);
        const init = await request(
          '/payments/telebirr/initialize',
          'customer',
          'POST',
          { orderId: placed.order.id, client: 'mobile' },
        );
        assert.match(chapaReturn, /mobile_state=/);
        verified = true;
        const callback = new URL(chapaReturn);
        const res = await app.request(callback.pathname + callback.search);
        const redirect = res.headers.get('location')!;
        assert.match(redirect, /^flashgo:\/\/payment-status/);
        assert.equal(
          new URL(redirect).searchParams.get('orderId'),
          placed.order.id,
        );
        assert.equal(
          (await request(`/orders/${placed.order.id}`, 'customer')).payment
            .status,
          'paid',
        );
        const forged = await app.request(
          `/payments/telebirr/verify?tx_ref=${init.txRef}&mobile_state=invalid`,
        );
        assert.match(forged.headers.get('location')!, /^https?:/);
        const valid = signMobilePaymentReturn(init.txRef);
        verified = false;
        const replay = await app.request(
          `/payments/telebirr/verify?tx_ref=${init.txRef}&mobile_state=${valid}`,
        );
        assert.match(replay.headers.get('location')!, /status=success/);
        assert.equal(
          (
            await db
              .select()
              .from(payments)
              .where(eq(payments.orderId, placed.order.id))
          )[0].status,
          'paid',
        );
      },
    );
    await t.test(
      'push device changes owner and read state cannot cross accounts',
      async () => {
        const token = `ExponentPushToken[test-${fixture.ids.customer}]`;
        await request('/mobile/devices', 'customer', 'POST', {
          token,
          platform: 'android',
        });
        const [notification] = await db
          .insert(notifications)
          .values({
            userId: fixture.ids.customer,
            type: 'test',
            title: 'Test',
            message: 'Private test message',
          })
          .returning();
        await request(
          `/mobile/notifications/${notification.notificationId}/read`,
          'business',
          'PATCH',
        );
        assert.equal(
          (
            await db
              .select()
              .from(notifications)
              .where(
                eq(notifications.notificationId, notification.notificationId),
              )
          )[0].readStatus,
          false,
        );
        await request(
          `/mobile/notifications/${notification.notificationId}/read`,
          'customer',
          'PATCH',
        );
        assert.equal(
          (
            await db
              .select()
              .from(notifications)
              .where(
                eq(notifications.notificationId, notification.notificationId),
              )
          )[0].readStatus,
          true,
        );
        await request('/mobile/devices', 'driver', 'POST', {
          token,
          platform: 'android',
        });
        const [device] = await db
          .select()
          .from(notificationDevices)
          .where(eq(notificationDevices.token, token));
        assert.equal(device.userId, fixture.ids.driver);
        const [session] = await db
          .select()
          .from(mobileSessions)
          .where(eq(mobileSessions.id, device.sessionId!));
        assert.equal(session.userId, fixture.ids.driver);
        await request('/mobile/devices', 'driver', 'DELETE', { token });
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await db.delete(orders).where(eq(orders.customerId, fixture.ids.customer));
    await db.delete(users).where(inArray(users.id, Object.values(fixture.ids)));
    await db
      .delete(categoryNameCatalog)
      .where(eq(categoryNameCatalog.id, fixture.categoryNameId));
    await closeDb();
  }
});
