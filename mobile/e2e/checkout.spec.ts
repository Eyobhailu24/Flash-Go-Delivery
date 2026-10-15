import { randomInt, randomUUID } from 'node:crypto';
import { test, expect, request as createRequest } from '@playwright/test';

let fixture:
  | { id: string; token: string; refreshToken: string; apiUrl: string }
  | undefined;
test.afterEach(async () => {
  if (!fixture) return;
  const cleanup = await createRequest.newContext({ timeout: 15_000 });
  try {
    expect(
      (
        await cleanup.delete(`${fixture.apiUrl}/users/${fixture.id}`, {
          headers: { Authorization: `Bearer ${fixture.token}` },
        })
      ).ok(),
    ).toBeTruthy();
    await cleanup.post(`${fixture.apiUrl}/auth/mobile/logout`, {
      data: { refreshToken: fixture.refreshToken },
    });
  } finally {
    fixture = undefined;
    await cleanup.dispose();
  }
});

test('customer searches, adds a meal, sees server pricing and edits a map address', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const apiUrl = process.env.MOBILE_API_URL || 'http://localhost:3001';
  const password = process.env.MOBILE_DEMO_PASSWORD || 'FlashGoDemo!2026';
  const adminLogin = await request.post(`${apiUrl}/auth/mobile/login`, {
    data: { phoneNumber: '+251900000004', password },
  });
  expect(adminLogin.ok()).toBeTruthy();
  const admin = await adminLogin.json();
  const headers = { Authorization: `Bearer ${admin.accessToken}` };
  const phoneNumber = `+2519${randomInt(10_000_000, 99_999_999)}`;
  const created = await request.post(`${apiUrl}/users`, {
    headers,
    data: {
      fullName: 'Mobile UI Test',
      email: `ui-${randomUUID()}@example.test`,
      phoneNumber,
      password,
      role: 'customer',
      status: 'active',
    },
  });
  expect(created.status()).toBe(201);
  const { user } = await created.json();
  fixture = {
    id: user.id,
    token: admin.accessToken,
    refreshToken: admin.refreshToken,
    apiUrl,
  };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    expect(
      (
        await request.patch(`${apiUrl}/users/${user.id}`, {
          headers,
          data: { isVerified: true },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.post(`${apiUrl}/profiles/customers`, {
          headers,
          data: {
            userId: user.id,
            addresses: [
              {
                address: 'Demo address, Bole',
                lat: 8.9948,
                lng: 38.7864,
                isDefault: true,
              },
            ],
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto('/auth/login');
    await page.getByLabel('Phone number', { exact: true }).fill(phoneNumber);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/customer$/);
    await page.goto('/customer/menu');
    await page.getByPlaceholder('Search', { exact: true }).fill('Demo Tibs');
    await expect(page.getByText('Demo Tibs', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: 'Add to cart', exact: true })
      .click();
    await expect(
      page.getByText('Added to cart', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cart', exact: true }).click();
    await page.getByRole('button', { name: 'Checkout', exact: true }).click();
    await expect(page.getByText('325.00 Birr', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'screenshots/checkout.png', fullPage: true });

    // A delayed geocoder response must not overwrite a manually entered address.
    await page.route('https://api.bigdatacloud.net/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: { locality: 'Old geocoder address', countryName: 'Ethiopia' },
      });
    });
    await page
      .getByRole('button', { name: 'Choose location', exact: true })
      .click();
    const reverseRequest = page.waitForRequest(
      (request) => request.url().includes('api.bigdatacloud.net'),
      { timeout: 20_000 },
    );
    const reverseResponse = page.waitForResponse(
      (response) => response.url().includes('api.bigdatacloud.net'),
      { timeout: 20_000 },
    );
    await page
      .frameLocator('iframe[title="Delivery map"]')
      .locator('#map.leaflet-container')
      .click({ position: { x: 240, y: 220 } });
    await reverseRequest;
    await page
      .getByLabel('Address', { exact: true })
      .fill('Manual apartment entrance');
    await reverseResponse;
    await expect(page.getByLabel('Address', { exact: true })).toHaveValue(
      'Manual apartment entrance',
    );
    await page
      .getByRole('button', { name: 'Confirm location', exact: true })
      .click();
    await expect(
      page.getByText('Manual apartment entrance', { exact: true }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    /* Fixture cleanup runs in afterEach, including after timeouts. */
  }
});
