import { test, expect } from '@playwright/test';
import { prisma } from '../../lib/db';

test.describe('Job detail smoke', () => {
    test('renders job details + stubs client panels', async ({ page }) => {
        // externalId ייחודי כדי לא להתנגש עם @@unique([source, externalId])
        const extId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // זרע משרה לבדיקה
        const job = await prisma.job.create({
            data: {
                source: 'smoke',
                externalId: extId,
                title: 'Playwright QA',
                company: 'ACME',
                location: 'Tel Aviv',
                description: 'Test job description',
                skillsRequired: ['react', 'typescript'],
                url: 'https://example.com/job',
            },
            select: { id: true, title: true, company: true },
        });

        // 1) לזייף סשן של NextAuth כדי שהקליינט ינהג כ-"authenticated"
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

        // 2) ליירט /match ולספור פניות בפועל
        let matchCalled = 0;
        await page.route('**/api/jobs/*/match', async (route) => {
            matchCalled++;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    match: {
                        score: 78,
                        reasons: ['skill overlap: react'],
                        breakdown: { matched: ['react'], missing: [], extra: [], coverage: 0.5 },
                    },
                }),
            });
        });

        // 3) ליירט /cover-letter (GET/POST/PUT) כדי שהעורך יעבוד בלי אוטנטיקציה אמיתית
        await page.route('**/api/jobs/*/cover-letter', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: true, draft: null }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        draft: {
                            id: 'd1',
                            coverLetter: 'Hello hiring manager...',
                            updatedAt: new Date().toISOString(),
                        },
                        maxWords: 220,
                    }),
                });
            }
        });

        // 4) ניווט לעמוד המשרה
        await page.goto(`/jobs/${job.id}`);

        // אסרטים יציבים: כותרת, תיאור, קישור חיצוני
        await expect(page.getByRole('heading', { level: 1, name: job.title })).toBeVisible();
        const desc = page.locator('main .prose p.whitespace-pre-wrap').first();
        await expect(desc).toHaveText('Test job description');
        await expect(page.getByRole('link', { name: /קישור למשרה/ })).toBeVisible();

        // 5) המתנה לכך שבאמת נשלחה בקשת /match (בזכות הסשן המזויף)
        await expect.poll(() => matchCalled, { timeout: 10_000, intervals: [200, 400] }).toBeGreaterThan(0);

        // 6) ניקוי — מחיקת המשרה שנוצרה
        await prisma.job.delete({ where: { id: job.id } });
    });
});
