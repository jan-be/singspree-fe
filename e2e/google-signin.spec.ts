import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The sign-in page around Google: the button where the server has it, the way
 * back without an account yet, and why it did not work. And the mailed link,
 * which fills in the code and waits: opened by itself it would sign this
 * browser in to whoever sent it. The API is stubbed, so no backend is needed.
 */
const answer = (route: Route, body: object) => route.fulfill({ json: { success: true, ...body } });

const sam = {
  id: 2, username: 'Sam', email: 'sam@gmail.com', createdAt: '2026-01-01T00:00:00.000Z', avatar: null,
  hasPassword: false, isAdmin: false, passkeys: [], google: { email: 'sam@gmail.com' },
  privacy: {}, influencerMode: false, rustPartyPage: false, voicesOnSpeakers: false,
};

/** The API of a signed-out browser; `google`: whether the server has the sign-in. Resolves to what was sent where. */
const stubApi = async (page: Page, { google = true }: { google?: boolean } = {}) => {
  const sent: Record<string, unknown> = {};
  await page.route('**/api/auth/me', route => answer(route, { user: null }));
  await page.route('**/api/auth/providers', route => answer(route, { google }));
  await page.route('**/api/auth/google/start', route => {
    sent.start = route.request().postDataJSON();
    return answer(route, { url: `${new URL(page.url()).origin}/?came-from=google` });
  });
  await page.route('**/api/auth/google/pending', route => answer(route, { email: 'sam@gmail.com', name: 'Sam' }));
  await page.route('**/api/auth/google/finish', route => {
    sent.finish = route.request().postDataJSON();
    return answer(route, { user: sam, created: true });
  });
  await page.route('**/api/auth/email/verify', route => {
    sent.verify = route.request().postDataJSON();
    return answer(route, { user: sam, created: false });
  });
  await page.route('**/api/me/best', route => answer(route, { data: {} }));
  return sent;
};

test('the button is there when the server has Google, and asks it where to go', async ({ page }) => {
  const sent = await stubApi(page);
  await page.goto('/login?next=/settings');
  const button = page.locator('[data-google-signin]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page).toHaveURL(/came-from=google/);
  expect(sent.start).toMatchObject({ next: '/settings', link: false });
});

test('without it there is no button', async ({ page }) => {
  await stubApi(page, { google: false });
  await page.goto('/login');
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('[data-google-signin]')).toHaveCount(0);
});

test('back without an account: a display name, prefilled, with the terms next to it', async ({ page }) => {
  const sent = await stubApi(page);
  await page.goto('/login?google=name&next=/settings');
  const name = page.locator('#auth-username');
  await expect(name).toHaveValue('Sam');
  await expect(page.getByTestId('signup-terms')).toBeVisible();
  await expect(page.getByText('sam@gmail.com')).toBeVisible();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect.poll(() => sent.finish).toMatchObject({ username: 'Sam' });
});

test('back with an error says why', async ({ page }) => {
  await stubApi(page);
  await page.goto('/login?google_error=address');
  await expect(page.getByRole('alert')).toContainText(/connect google in your settings/i);
});

test('a link from the mail fills in the code and waits for the button', async ({ page }) => {
  const sent = await stubApi(page);
  await page.goto('/login?email=sam%40gmail.com&code=123456');
  await expect(page.locator('#auth-code')).toHaveValue('123456');
  await page.waitForTimeout(300);
  expect(sent.verify, 'not on its own').toBeUndefined();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect.poll(() => sent.verify).toMatchObject({ email: 'sam@gmail.com', code: '123456' });
});
