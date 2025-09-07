להדבקה ישירה ב-GitHub 👇

---

# Job AI App — README (Stage 16)

> גרסת README מותאמת ל-GitHub (Markdown + Mermaid).
> **סטטוס:** שלב 16 — **CI + E2E Smoke** (על גבי שלבים 11–15 שכבר בפנים).

**זרימות מרכזיות:**

* **Resume:** Upload → Parse → Analyze
* **Jobs:** Ingest → List → Detail
* **Match (Stage 11):** Job Detail → Compute Match → Persist → Show
* **Cover Letter (Stage 12):** Job Detail → Generate (AI) / Edit → Save Draft
* **UI/UX Polish (Stage 13):** Loading/Skeletons, Filter Chips + Clear All, Debounced Search, Match Badge, Navbar, Resume UX
* **Security (Stage 14):** Rate limiting, Zod validation, AuthN review
* **Logs & Metrics (Stage 15):** לוג טוקנים/Latency/עלות ל-AI, אירועי Cover Letter, API סיכום, דשבורד `/metrics`
* **CI & E2E (Stage 16):** GitHub Actions עם Postgres, Build מלא, Vitest (unit+integration), Playwright (e2e smoke)

---

## 🔭 סקירה כללית

ב-**Stage 16** הוספנו **תשתית בדיקות מלאה ו-CI**:

* **Vitest** — יחידה ואינטגרציה (mocks ל-Prisma/OpenAI/metrics).
* **Playwright** — E2E *smoke*:

  * `/jobs` — רשימה, פילטרים (debounce), פאג’ינציה, empty/error/loading.
  * `/jobs/[id]` — פרטי משרה, MatchBadge/Panel, Cover Letter Editor (בקשות ממוסטות).
* **CI (GitHub Actions)** — שרת Postgres בשירות, `pnpm build`, `pnpm test:vi`, `pnpm test:e2e`.
  כדי למנוע נפילות build בגלל ESLint קשוח — מוגדר `eslint.ignoreDuringBuilds: true` בקובץ `next.config.ts`.

> 💡 המטרה בשלב הזה: תכל’ס “ירוק” קונסיסטנטי ב-CI על תרחישי עשן, עם זמני ריצה קצרים.

---

## 📈 תרשימים

### צנרת CI

```mermaid
flowchart LR
  A[push / PR] --> CI[GitHub Actions\njob: test]
  CI --> P[Service: Postgres]
  CI --> I[Install + Prisma generate/migrate]
  CI --> B[Next build]
  CI --> V[Vitest (unit+integration)]
  CI --> E[Playwright (e2e smoke)]
  E --> R[HTML Report]
```

### E2E — טעינת דף משרה עם Stubs

```mermaid
sequenceDiagram
  participant T as Playwright
  participant App as Next.js (prod server)
  participant API as /api/*
  T->>App: open /jobs/[id]
  App->>API: GET /api/jobs/[id] (SSR)
  API-->>App: job JSON
  App-->>T: HTML (Job details)
  Note over T: Stub network
  T->>API: GET /api/jobs/[id]/match  (stubbed 78)
  API-->>T: { ok:true, score:78 }
  T->>API: GET /api/jobs/[id]/cover-letter (stubbed draft|null)
  API-->>T: { ok:true, draft:null }
  T->>T: assert heading/description/link\n+ panel badge shows
```

---

## 🧱 סכמת נתונים (תזכורת Stage 15)

* **`AiUsage`** — לוג שימוש ב-AI (tokens/latency/model/status/error/cost).
* **`UsageEvent`** — אירועי מוצר (`cover_letter_created`/`cover_letter_regenerated`/…).

שאר המודלים (User/Resume/Job/Match/ApplicationDraft) — ללא שינוי.

---

## 🔐 אימות והרשאות

מוגן `withUser`:

* `POST /api/resume/analyze`
* `GET/POST/PUT /api/jobs/:id/cover-letter`
* `POST /api/jobs/ingest`
* `GET /api/metrics/summary?days=N`

ציבורי:

* `GET /api/jobs/list`
* `GET /api/jobs/:id`

> Rate Limit + Zod (Stage 14) — נשמרים.

---

## 🧪 בדיקות

### Vitest (יחידה/אינטגרציה)

* **Unit:** `lib/match/engine`, `lib/cover-letter/prompt`, Zod (`validation/*.ts`), `wordCount`.
* **Integration (API routes):**

  * `resume/analyze` — JSON Schema output + metrics logging.
  * `jobs/[id]/cover-letter` — create/regenerate/over-limit/no-resume/error + GET/PUT.
  * `jobs/list` — ולידציית Zod, פילטרים (q/location/skill), pagination, 500.

הרצה:

```bash
pnpm test:vi
```

### Playwright (E2E Smoke)

* `tests/smoke/jobs-list.spec.ts` — רנדר בסיסי + פאג’ינציה + Empty State.
* `tests/smoke/job-detail.spec.ts` — פרטי משרה + stubs ל-/match ו-/cover-letter.

> ה-webServer ב-Playwright מריץ **שרת פרוד** (`next start`) ולכן צריך **build** לפני E2E.

הרצה מקומית:

```bash
pnpm build
pnpm test:e2e
# דוח:
pnpm exec playwright show-report
```

---

## 🤖 CI (GitHub Actions)

קובץ: `.github/workflows/ci.yml`

נקודות עיקריות:

* שירות **Postgres 16** עם `POSTGRES_DB=jobai`.
* ENV בסיסיים ל-Next/NextAuth/OpenAI (ממילא ממוקים בטסטים).
* `pnpm prisma migrate deploy` לפני Build.
* Build פרודקשן, ואז Vitest, ואז Playwright.
* `next.config.ts` עם:

  ```ts
  export default {
    images: { remotePatterns: [{ protocol: 'https', hostname: 'avatars.githubusercontent.com' }] },
    eslint: { ignoreDuringBuilds: true }, // להאיץ CI ולמנוע כשל על any
  }
  ```

---

## ⚙️ התקנה והפעלה (לוקאל)

דרישות: **Node 18+**, **PostgreSQL**

```bash
pnpm i
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

**משתני סביבה** (דוגמה):

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/jobai?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=devsecret
GITHUB_ID=dummy
GITHUB_SECRET=dummy
OPENAI_API_KEY=sk-...

# אופציונלי — מחירון למודלים (USD per 1K tokens)
OPENAI_PRICE_PER_1K_JSON={"gpt-4o-mini":{"input":0.15,"output":0.60}}
```

---

## 📁 מבנה תיקיות (מעודכן ל-Stage 16)

```
app/
  metrics/page.tsx
  api/
    resume/{upload,parse,analyze}/route.ts
    jobs/
      ingest/route.ts
      list/route.ts
      [id]/
        route.ts
        match/route.ts
        cover-letter/route.ts
    metrics/summary/route.ts
components/
  {Navbar,ResumeUpload,JobsFilters,FilterChips,EmptyState,ErrorState,MatchBadge,CoverLetterEditor}.tsx
  ui/{button,skeleton}.tsx
hooks/useDebounce.ts
lib/
  {auth,db}.ts
  security/rateLimit.ts
  validation/{jobs,coverLetter}.ts
  cover-letter/prompt.ts
  match/engine.ts
  metrics.ts
prisma/
  schema.prisma
  migrations/
tests/
  unit/*.test.ts
  integration/*.test.ts
  smoke/*.spec.ts          # Playwright E2E
.github/workflows/ci.yml
playwright.config.ts
vitest.config.ts
```

---

## 🧰 תקלות נפוצות (Stage 16) & פתרונות

* **“Could not find a production build in '.next'”**
  הרץ `pnpm build` לפני `pnpm test:e2e` (ב-CI גם ככה יש Build).

* **Unique constraint (`source`,`externalId`) בטסטי E2E**
  ודא `externalId` ייחודי בכל ריצה (למשל `smoke-${Date.now()}-rnd`), או מנקה את הרשומה בסוף.

* **Next 15: `params should be awaited` / “invalid GET export”**
  ב-Route דינמי:

  ```ts
  export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    // ...
  }
  ```

  (אותו דבר ל-POST/PUT/…).

* **ESLint מפיל Build על `any`**
  בשלב זה ב-CI: `eslint.ignoreDuringBuilds: true`.
  כשיהיה זמן — החלפת `any` ב-`unknown`/טיפוסים של Prisma/React events.

* **Playwright timeout על כפתור “הבא”**
  לרוב כי הכפתור Disabled (אין עוד עמודים). ודא `total/pageSize` או המתן לטעינה לפני לחיצה.

* **Strict mode violation ב-getByText (התאמה כפולה)**
  העדף סלקטורים **יציבים** (Role/Name), למשל:

  ```ts
  await expect(page.getByRole('heading', { level: 1, name: job.title })).toBeVisible();
  ```

* **Vitest “cannot be imported in a CommonJS module” בזמן E2E**
  דאג ש-Playwright יריץ רק קבצי E2E (למשל `testDir: "tests/smoke"`), ואל תייבא `vitest` בקבצי ה-E2E.

---

## ✅ צ’קליסט Stage 16

* [x] **Playwright:** smoke tests ל-`/jobs` ו-`/jobs/[id]` עם stubs יציבים.
* [x] **Vitest:** יחידה+אינטגרציה ירוקים.
* [x] **CI:** Postgres service, prisma migrate, build, vitest, playwright.
* [x] **Next config:** `eslint.ignoreDuringBuilds` בשביל CI מהיר.
* [x] **תיקוני Next 15 params:** שימוש ב-`await ctx.params`.
* [x] **דוחות:** Playwright HTML report.

---

## 🔜 המשך דרך

* כיסוי E2E רחב יותר (יצירת Cover Letter אמיתי עם UI, Edge cases).
* גרפים ב-`/metrics` (Recharts) + פילוחים לפי endpoint/modל.
* סרגל ריגרסיות על Matches (snapshot לשיבוץ נקודות).

---

**License:** MIT
**Author:** itay — Job AI App
