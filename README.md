Job AI App — README (Stage 10)

מטרת המסמך: גרסת README מותאמת ל-GitHub (Markdown + Mermaid) שמציגה חזותית את הזרימה Upload → Parse → Analyze, ולצידה זרימת Jobs: Ingest → List → Detail, מפרטת API, הגדרות, ותיקיות.

טיפ: GitHub מציג תרשימי Mermaid אוטומטית. אם פלטפורמה אחרת לא תומכת—אפשר להחליף ל-PNG/ASCII.

🔭 סקירה כללית

האפליקציה מבצעת שני צירים עיקריים:

קורות חיים

העלאת PDF → שמירה זמנית (TMP)

Parsing (חילוץ טקסט) → שמירה ל-DB (Prisma/Postgres)

ניתוח AI (Structured JSON: skills/tools/dbs/years/highlights) → שמירה ל-DB והצגה ב-UI

משרות

Ingest מפיד מדומה (בהמשך: מקורות אמיתיים) עם נורמליזציה ואיחוד שדות

List API עם פילטרים (q/location/skill) + עמודים

Detail: דף /jobs/[id] + API נקודתי

📈 תרשימי זרימה
קורות חיים — רצף (Upload → Parse → Analyze)
sequenceDiagram
  participant C as Client (ResumeUpload)
  participant U as /api/resume/upload
  participant P as /api/resume/parse
  participant A as /api/resume/analyze
  participant DB as Postgres

  C->>U: POST multipart/form-data (file.pdf)
  U-->>C: { ok, id, bytes }
  C->>P: POST { id }
  P->>DB: upsert Resume (text)
  P-->>C: { ok, resumeId, pageCount, chars } | { ok, status:needs_ocr }
  C->>A: POST
  A->>DB: update Resume (skills,json + yearsExp)
  A-->>C: { ok, resumeId, profile, yearsExp }

משרות — Ingest → List → Detail
flowchart LR
  subgraph FE[Frontend]
    JobsPage[/jobs/]
    JobDetail[/jobs/:id/]
  end

  subgraph API[Backend API]
    Ingest[/POST /api/jobs/ingest/]
    List[/GET /api/jobs/list/]
    Show[/GET /api/jobs/:id/]
  end

  Data[Feed JSON/CSV] -->|normalize| Ingest -->|upsert by (source,externalId)| DB[(Postgres)]
  FE -.->|fetch| List --> DB
  FE -.->|fetch| Show --> DB

  JobsPage -->|click job| JobDetail

🧱 סכמת נתונים (Prisma)

Resume (Stage 9):

text: String — טקסט מלא מה-PDF

skills: Json — אובייקט מובנה מה-AI { skills[], tools[], dbs[], years, highlights[] }

yearsExp: Int? — עיגול/נרמול של years

userId: String @unique — רשומה אחת לכל משתמש

updatedAt @updatedAt

Job (Stage 10 — עדכונים חשובים):

source: String — מזהה מקור (mockA/mockB/...)

externalId: String — מזהה חיצוני ייחודי בתוך המקור

title: String, company: String, location: String?, description: String, url: String?

skillsRequired: String[] — מערך מחרוזות (lowercase) לנורמליזציה ולפילטור יעיל

createdAt: DateTime @default(now())

אינדקסים/ייחודיות:

@@unique([source, externalId]) — מניעת כפילויות בין מקורות

@@index([createdAt]) — מיון אחרון־קודם מהיר

Match / ApplicationDraft — ללא שינוי בשלב 10 (ישמשו בשלבים הבאים).

🔐 אימות גלובלי

lib/auth.ts מספק authOptions, auth(), requireUser(), ו-withUser(handler).

דוגמה (NextAuth API):

// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };


ה-ingest מוגן ע"י withUser (דרושה התחברות). ה-list/detail ציבוריים לקריאה.

🧪 API
1) POST /api/resume/upload

קלט: multipart/form-data → שדה file (PDF ≤ 5MB)

ולידציה: סיומת .pdf, חתימת %PDF

פעולה: שמירה זמנית ל-TMP (resume-<id>.pdf)

פלט: 200 { ok, id, bytes }

curl -X POST \
  -F "file=@/path/to/resume.pdf;type=application/pdf" \
  http://localhost:3000/api/resume/upload

2) POST /api/resume/parse

קלט: JSON { id }

פעולה: קריאת PDF זמני → pdf-parse → שמירה ל-DB (upsert לפי userId)

פלט:

200 { ok, resumeId, pageCount, chars }

או 200 { ok, id, status:"needs_ocr", pageCount }

curl -X POST -H "Content-Type: application/json" \
  -d '{"id":"<tmp-id>"}' http://localhost:3000/api/resume/parse

3) POST /api/resume/analyze

קלט: ללא גוף (מבוסס על Resume.text של המשתמש)

פעולה: קריאה ל-OpenAI עם JSON Schema strict

פלט: 200 { ok, resumeId, profile, yearsExp }

דוגמה לפלט:

{
  "profile": {
    "skills": ["typescript","react","next.js"],
    "tools": ["git","docker"],
    "dbs": ["postgres","mongodb"],
    "years": 2.5,
    "highlights": ["built full-stack features", "optimized queries"]
  }
}

4) POST /api/jobs/ingest (Stage 10)

דרוש לוגין (מוגן ב-withUser)

קלט: (dev) משתמש בפיד דמה (data/jobs-feed.json)

פעולה:

נורמליזציה לשדות אחידים (טיפול בכתיב/רווחים/רישיות, המרת skills למערך lowercase ודילול כפילויות)

upsert לפי (source, externalId) (אידמפוטנטי)

פלט: 200 { ok, total, created, updated, skipped }

curl -X POST http://localhost:3000/api/jobs/ingest

5) GET /api/jobs/list (Stage 10)

פרמטרים:

q — חיפוש חופשי ב־title/company/location/description (case-insensitive)

location — פילטר מיקום (contains)

skill — פילטר לפי סקיל מתוך skillsRequired (lowercase)

page (ברירת מחדל 1), pageSize (ברירת מחדל 20, מקס' 50)

פלט:
200 { ok, total, page, pageSize, items: [{ id, title, company, location, skillsRequired, url, createdAt }] }

דוגמאות:

# כל המשרות (דף 1)
curl "http://localhost:3000/api/jobs/list"

# חיפוש חופשי
curl "http://localhost:3000/api/jobs/list?q=engineer"

# פילטר מיקום
curl "http://localhost:3000/api/jobs/list?location=tel%20aviv"

# פילטר סקיל (שמור lowercase)
curl "http://localhost:3000/api/jobs/list?skill=react"

# עמוד 2, גודל 10
curl "http://localhost:3000/api/jobs/list?page=2&pageSize=10"

6) GET /api/jobs/[id] (Stage 10)

קלט: id כמקטע URL

פעולה: שליפת משרה

פלט: 200 { ok, job:{ ... } } או 404 { error:"not found" }

🖥️ UI
ResumeUpload (Stage 9)

שלבים: uploading → parsing → analyzing → done/error

אוטומציה מלאה: לאחר Upload קורא ל-Parse; אם תקין—ממשיך ל-Analyze; מציג את הפרופיל המובנה.

Jobs (Stage 10)

/jobs – עמוד רשימת המשרות:

פילטרים: q / location / skill (Client), דפדוף page/pageSize

טעינה מ־/api/jobs/list

כרטיס לכל משרה עם תגיות skills וקישור חיצוני (אם קיים)

לחיצה על כותרת המשרה → ניווט לדף פרטים

/jobs/[id] – דף פרטי משרה:

שליפה ישירה מ־DB (Server Component)

מציג מקור, externalId, תיאור ו־skills

קישור חיצוני למשרה (במידה וקיים)

⚙️ התקנה והפעלה

דרישות: Node 18+, PostgreSQL

npm i
npx prisma migrate dev && npx prisma generate
npm run dev

משתני סביבה
DATABASE_URL=postgres://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
GITHUB_ID=... 
GITHUB_SECRET=...
OPENAI_API_KEY=sk-...     # שרת בלבד


חשוב: אל תדחוף .env/.env.local לריפו. שמור טמפלייט נקי ב-.env.local.example.

📁 מבנה תיקיות (עיקרי)
app/
  api/
    auth/[...nextauth]/route.ts
    resume/
      upload/route.ts
      parse/route.ts
      analyze/route.ts
    jobs/
      ingest/route.ts        # Stage 10
      list/route.ts          # Stage 10
      [id]/route.ts          # Stage 10
  jobs/
    page.tsx                 # Stage 10 (UI רשימה + פילטרים)
    [id]/page.tsx            # Stage 10 (UI פרטים)

components/
  ResumeUpload.tsx
  JobsFilters.tsx            # Stage 10

lib/
  auth.ts
  db.ts
  jobs/                      # Stage 10 (normalizers)
  match/                     # Stage 11 (בעתיד)

data/
  jobs-feed.json            # Stage 10 (פיד דמה)

prisma/
  schema.prisma
  migrations/

types/
  pdf-parse.d.ts

🧰 תקלות ופתרונות מהירים

/jobs ריק → כנראה לא הרצתי ingest.
הרץ POST /api/jobs/ingest (מחובר). לאחר מכן /jobs יציג הכל.

פילטר skill לא מחזיר תוצאות → ודא שהפרמטר lowercase (למשל react).
הצד השרת מחפש ב-String[] עם has.

401 ב־/api/jobs/ingest → דרושה התחברות (NextAuth).

פרפורמנס חיפוש חופשי → לנתונים קטנים זה בסדר. בהמשך: pg_trgm/FTS.

pdf-parse ENOENT → לייבא מה-subpath: pdf-parse/lib/pdf-parse.js.

אין שכבת טקסט → needs_ocr (שלב OCR עתידי).

✅ צ׳קליסט Stage 10

 נורמליזציית פיד משרות לאחידות שדות

 upsert לפי (source, externalId) — אידמפוטנטי

 שינוי Job.skillsRequired ל־String[] (lowercase)

 GET /api/jobs/list עם פילטרים + עמודים

 /jobs — UI עם פילטרים/דפדוף

 GET /api/jobs/[id] + /jobs/[id] — דף פרטים

🔜 המשך דרך

Stage 11: מנוע התאמה (Match Engine v1) — ציון לפי כיסוי סקילז + “סיבות” (הסברים)

Stage 11.1: הוספת ניסיון/מיקום לשקלול

OCR ל-PDF סרוקים (Tesseract/Cloud Vision)

Queue/Worker ל-PDF כבדים

Ajv Validation ל-Schema בצד שרת

דשבורד להצגת פרופיל ושיפור הפרומפט

License: MIT
Author: itay — Job AI App
