import { Locator, Page, expect, test } from '@playwright/test';

// These are the seeded Demo User's, printed by `npx prisma db seed`.
const EMAIL = 'demo@example.com';
const PASSWORD = 'demo-password-change-me';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * The contrast between an element's text and whatever is actually painted
 * behind it, from the browser's own computed styles. Asserting the ratio is
 * what makes the accessibility claim checkable; asserting the hex values would
 * only restate the token block back to itself.
 */
function contrastRatio(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const channels = (value: string) =>
      (value.match(/[\d.]+/g) ?? []).map(Number);

    // An element with no background of its own shows its ancestor's, so the
    // pairing a reader actually sees is the first opaque one above it.
    const backgroundBehind = (from: Element) => {
      let current: Element | null = from;
      while (current) {
        const [r, g, b, alpha = 1] = channels(
          getComputedStyle(current).backgroundColor,
        );
        if (alpha > 0) {
          return [r, g, b];
        }
        current = current.parentElement;
      }
      return [255, 255, 255];
    };

    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb
        .slice(0, 3)
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.03928
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4),
        );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const foreground = luminance(channels(getComputedStyle(node).color));
    const background = luminance(backgroundBehind(node));
    const [lighter, darker] =
      foreground > background ? [foreground, background] : [background, foreground];

    return (lighter + 0.05) / (darker + 0.05);
  });
}

const bodyBackground = (page: Page) =>
  page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);

async function showRefusal(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  return page.locator('form').getByRole('alert');
}

test.describe('the shell', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('wraps the sign-in page in the same landmarks as the rest', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
  });

  test('wraps an authenticated page in them too', async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
  });

  test('offers the wordmark as the way home', async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole('banner').getByRole('link')).toHaveAttribute('href', '/');
  });

  test('offers sign-out on an authenticated page', async ({ page }) => {
    await signIn(page);

    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Sign out' }),
    ).toBeVisible();
  });

  // The action slot is what keeps the shell from offering a User an action that
  // makes no sense for the page they are on.
  test('offers no sign-out to a visitor who is not signed in', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  });
});

test.describe('the document outline', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('gives the sign-in page exactly one level-one heading', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('gives every authenticated page exactly one', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    await page.goto('/catalogue');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});

test.describe('the colour scheme', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.afterEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
  });

  // Proves the dark tokens are wired to the page rather than merely declared.
  test('follows the scheme the machine asks for', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    const light = await bodyBackground(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await bodyBackground(page);

    expect(dark).not.toBe(light);
  });

  test('keeps body text readable in both schemes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    const body = page.getByRole('heading', { level: 1 });

    expect(await contrastRatio(body)).toBeGreaterThanOrEqual(4.5);

    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await contrastRatio(body)).toBeGreaterThanOrEqual(4.5);
  });

  // The message most at risk of being tuned for one scheme and lost in the
  // other is the one a User most needs to read.
  test('keeps a refusal readable in both schemes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const refusal = await showRefusal(page);
    await expect(refusal).toBeVisible();

    expect(await contrastRatio(refusal)).toBeGreaterThanOrEqual(4.5);

    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await contrastRatio(refusal)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('keyboard focus', () => {
  test('is visible on a control reached by tabbing', async ({ page }) => {
    await page.goto('/login');
    const button = page.getByRole('button', { name: 'Sign in' });
    const outlineOf = () =>
      button.evaluate((node) => {
        const { outlineStyle, outlineWidth } = getComputedStyle(node);
        return `${outlineStyle} ${outlineWidth}`;
      });

    const resting = await outlineOf();

    // Tabbing rather than .focus(): :focus-visible is about how the focus was
    // acquired, and a programmatic focus would not match it on a button.
    await page.getByLabel('Password').click();
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();

    const focused = await outlineOf();
    expect(focused).not.toBe(resting);
    expect(focused).not.toContain('none');
  });
});

test.describe('a narrow viewport', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  const fitsHorizontally = (page: Page) =>
    page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return scrollWidth <= clientWidth;
    });

  test('scrolls the sign-in page vertically only', async ({ page }) => {
    await page.goto('/login');

    expect(await fitsHorizontally(page)).toBe(true);
  });

  test('scrolls the authenticated pages vertically only', async ({ page }) => {
    await signIn(page);
    expect(await fitsHorizontally(page)).toBe(true);

    await page.goto('/catalogue');
    expect(await fitsHorizontally(page)).toBe(true);
  });
});
