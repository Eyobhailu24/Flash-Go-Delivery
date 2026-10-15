import { test, expect } from '@playwright/test';

test('guest catalog and Amharic switch render at phone width', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/customer');
  await expect(
    page.getByText('What would you like today?', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Nearby Restaurant', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('FlashGo Demo Kitchen', { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: 'screenshots/customer-en.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await expect(page.getByText('ዛሬ ምን ይፈልጋሉ?', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'screenshots/customer-am.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

for (const [role, phone, title] of [
  ['customer', '+251900000001', 'What would you like today?'],
  ['business', '+251900000002', 'Dashboard'],
  ['driver', '+251900000003', 'Current delivery'],
  ['admin', '+251900000004', 'Overview'],
]) {
  test(`${role} signs in and renders its protected area`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/auth/login');
    await page.getByLabel('Phone number', { exact: true }).fill(phone);
    await page
      .getByLabel('Password', { exact: true })
      .fill(process.env.MOBILE_DEMO_PASSWORD || 'FlashGoDemo!2026');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    if (role === 'business')
      await expect(
        page.getByText('FlashGo Demo Kitchen', { exact: true }).first(),
      ).toBeVisible();
    if (role === 'driver')
      await expect(
        page.getByText('No delivery offers right now', { exact: true }),
      ).toBeVisible();
    if (role === 'business')
      await expect(page.getByText('—', { exact: true })).toHaveCount(0);
    if (role === 'customer')
      await expect(
        page.getByText('FlashGo Demo Kitchen', { exact: true }).first(),
      ).toBeVisible();
    await expect(
      page.getByText('Something went wrong', { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `screenshots/${role}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(errors).toEqual([]);
  });
}
