import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * A passkey prompt or a password manager's popup closing focuses the tab just
 * as its sign-in comes back, and AuthContext then asks /auth/me. Sent before
 * the cookie changed, the answer tells of the time before: it must not undo
 * what happened here. The API is stubbed, so the order is the test's and no
 * backend is needed.
 */
const singer = {
  id: 1, username: 'Singer', email: 'singer@example.com', createdAt: '2026-01-01T00:00:00.000Z', avatar: null,
  hasPassword: true, isAdmin: false, passkeys: [],
};

const answer = (route: Route, body: object) => route.fulfill({ json: { success: true, ...body } });

/** /auth/me answers with `user`; `heldBack()` catches the next request instead, resolving to its unanswered route */
const stubMe = async (page: Page, user: object | null) => {
  let catchOne: ((route: Route) => void) | null = null;
  await page.route('**/api/auth/me', route => {
    if (!catchOne) return answer(route, { user });
    catchOne(route);
    catchOne = null;
  });
  await page.route('**/api/me/best', route => answer(route, { data: {} }));
  return { heldBack: () => new Promise<Route>(resolve => { catchOne = resolve; }) };
};

/** The tab gets the focus back while `path` is under way; resolves to the check that sets off, held back, once it is answered */
const focusDuring = async (page: Page, path: string, me: Awaited<ReturnType<typeof stubMe>>, reply: object) => {
  let check: Promise<Route> | null = null;
  await page.route(path, async route => {
    check = me.heldBack();
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
    await check;
    await answer(route, reply);
  });
  return async (user: object | null) => {
    await answer(await check!, { user });
    await page.waitForTimeout(200); // for React to take it, or not
  };
};

const signInLink = (page: Page) => page.getByRole('link', { name: 'Sign in', exact: true });
const accountButton = (page: Page) => page.locator('button', { hasText: singer.username });

test('a check sent before the sign-in landed does not undo it', async ({ page }) => {
  const me = await stubMe(page, null);
  await page.route('**/api/auth/lookup', route => answer(route, { exists: true, hasPasskey: false, hasPassword: true }));
  const answerCheck = await focusDuring(page, '**/api/auth/password/login', me, { user: singer });

  await page.goto('/login');
  await page.fill('#auth-email', singer.email);
  await page.keyboard.press('Enter');
  await page.fill('#auth-password', 'a-password');
  await page.keyboard.press('Enter');
  await expect(accountButton(page)).toBeVisible();
  await expect(page).toHaveURL('/');

  await answerCheck(null);
  await expect(accountButton(page)).toBeVisible();
  await expect(signInLink(page)).toHaveCount(0);
});

test('a check sent before the sign-out landed does not undo it', async ({ page }) => {
  const me = await stubMe(page, singer);
  const answerCheck = await focusDuring(page, '**/api/auth/logout', me, {});

  await page.goto('/');
  await accountButton(page).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(signInLink(page)).toBeVisible();

  await answerCheck(singer);
  await expect(signInLink(page)).toBeVisible();
  await expect(accountButton(page)).toHaveCount(0);
});
