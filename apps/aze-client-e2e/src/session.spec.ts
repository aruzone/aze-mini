import { expect, test } from '@playwright/test';

// These are the seeded Demo User's, printed by `npx prisma db seed`.
const EMAIL = 'demo@example.com';
const PASSWORD = 'demo-password-change-me';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // The click only posts the action; the cookie is not set until the redirect
  // it answers with has landed.
  await expect(page).toHaveURL(/\/$/);
}

test.describe('the session', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('turns a visitor with no session away from an authenticated page', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('turns one away from the catalogue too', async ({ page }) => {
    await page.goto('/catalogue');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs a User in against the real API and remembers them', async ({ page }) => {
    await signIn(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading')).toContainText('Demo User');
    await expect(page.getByText(EMAIL)).toBeVisible();
  });

  // The whole point of the arrangement: the credential is in the cookie the
  // server set, and script running on the page cannot see it.
  test('keeps the token out of reach of browser script', async ({ page, context }) => {
    await signIn(page);

    const session = (await context.cookies()).find((c) => c.name === 'aze_session');
    expect(session?.httpOnly).toBe(true);
    await expect(page.evaluate(() => document.cookie)).resolves.not.toContain('aze_session');
  });

  test('says so when the credentials are wrong, and stays put', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill('not the password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('form').getByRole('alert')).toContainText(
      /invalid credentials/i,
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('renders catalogue rows the API actually returned', async ({ page }) => {
    await signIn(page);

    await page.getByRole('link', { name: /catalogue/i }).click();

    await expect(page).toHaveURL(/\/catalogue$/);
    await expect(page.getByRole('heading', { name: 'Field Notebook' })).toBeVisible();
  });

  test('turns the User back out again when they sign out', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
