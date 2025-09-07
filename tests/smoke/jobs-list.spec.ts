import { test, expect } from '@playwright/test';

test.describe('Jobs list smoke', () => {
  test('renders list, paginates, and shows empty state', async ({ page }) => {
    // 1) סשן NextAuth מזויף
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { name: 'Test User', email: 'test@example.com', image: null },
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      });
    });

    // 2) יירוט /api/jobs/list — total>20 כדי לאפשר מעבר לעמוד 3 (pageSize=10 בצד הלקוח)
    await page.route('**/api/jobs/list**', async (route) => {
      const url = new URL(route.request().url());
      const pageNum = Number(url.searchParams.get('page') ?? '1');
      const pageSize = 10;
      const total = 21; // => ceil(21/10)=3 עמודים

      if (pageNum === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            total,
            page: 1,
            pageSize,
            items: [
              {
                id: 'j1',
                title: 'Frontend Engineer',
                company: 'ACME',
                location: 'Tel Aviv',
                skillsRequired: ['react', 'typescript'],
                url: 'https://example.com/j1',
                createdAt: new Date().toISOString(),
              },
              {
                id: 'j2',
                title: 'Backend Developer',
                company: 'Beta Corp',
                location: 'Remote',
                skillsRequired: ['node', 'postgres'],
                url: null,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
        return;
      }

      if (pageNum === 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            total,
            page: 2,
            pageSize,
            items: [
              {
                id: 'j3',
                title: 'DevOps Engineer',
                company: 'Gamma Ltd',
                location: 'Haifa',
                skillsRequired: ['docker', 'k8s'],
                url: 'https://example.com/j3',
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
        return;
      }

      // עמוד 3 ומעלה — ריק
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          total,
          page: pageNum,
          pageSize,
          items: [],
        }),
      });
    });

    // 3) יירוט /match כדי שלא יכשיל את העמוד
    await page.route('**/api/jobs/*/match', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          match: { score: 70, reasons: [], breakdown: { matched: [], missing: [], extra: [], coverage: null } },
        }),
      });
    });

    // 4) ניווט ובדיקות
    await page.goto('/jobs');

    await expect(page.getByRole('heading', { level: 1, name: 'משרות' })).toBeVisible();
    await expect(page.getByText(/נמצאו \d+ משרות/)).toBeVisible();

    // עמוד 1
    await expect(page.getByRole('link', { name: 'Frontend Engineer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Backend Developer' })).toBeVisible();

    // עמוד 2
    await expect(page.getByRole('button', { name: 'הבא' })).toBeEnabled();
    await page.getByRole('button', { name: 'הבא' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole('link', { name: 'DevOps Engineer' })).toBeVisible();

    // עמוד 3 (ריק)
    await expect(page.getByRole('button', { name: 'הבא' })).toBeEnabled();
    await page.getByRole('button', { name: 'הבא' }).click();
    await expect(page).toHaveURL(/page=3/);
    await expect(page.getByText('לא נמצאו משרות תואמות')).toBeVisible();
  });
});
