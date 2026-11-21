import { expect, test } from '@playwright/test';

// Runs the UI in a regular browser (no Tauri), so it covers the signed-out shell only.
// Signed-in flows are covered by unit tests with mocked Tauri commands and a faked Drive.
test('loads the app shell without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TrackWorth' })).toBeVisible();
  await expect(page).toHaveTitle('TrackWorth');
  await expect(page.getByRole('note')).toContainText('desktop app');
  expect(errors).toEqual([]);
});
