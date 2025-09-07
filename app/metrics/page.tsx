// app/metrics/page.tsx
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth"; // ← שימוש בהלפר שלך שמחזיר משתמש עם id
import Link from "next/link";

export const runtime = "nodejs";

type Summary = {
  days: number;
  ai: {
    calls: number;
    prompt: number;
    completion: number;
    total: number;
    costUsd: number | null;
    avgLatencyMs: number;
  };
  coverLetters: {
    created: number;
    regenerated: number;
    total: number;
  };
};

async function getSummary(userId: string, days = 7): Promise<Summary> {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const aiAgg = await prisma.aiUsage.aggregate({
    _count: { _all: true },
    _sum: {
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      latencyMs: true,
      costUsd: true,
    },
    where: { userId, createdAt: { gte: from } },
  });

  const calls = aiAgg._count._all;
  const avgLatencyMs = calls > 0 ? Math.round((aiAgg._sum.latencyMs ?? 0) / calls) : 0;
  const costUsd =
    aiAgg._sum.costUsd !== null && aiAgg._sum.costUsd !== undefined
      ? Number(aiAgg._sum.costUsd)
      : null;

  const [created, regenerated] = await Promise.all([
    prisma.usageEvent.count({
      where: { userId, type: "cover_letter_created", createdAt: { gte: from } },
    }),
    prisma.usageEvent.count({
      where: { userId, type: "cover_letter_regenerated", createdAt: { gte: from } },
    }),
  ]);

  return {
    days,
    ai: {
      calls,
      prompt: aiAgg._sum.promptTokens ?? 0,
      completion: aiAgg._sum.completionTokens ?? 0,
      total: aiAgg._sum.totalTokens ?? 0,
      costUsd,
      avgLatencyMs,
    },
    coverLetters: {
      created,
      regenerated,
      total: created + regenerated,
    },
  };
}

function DaysPicker({ active }: { active: number }) {
  const options = [7, 14, 30];
  return (
    <div className="flex items-center gap-2">
      {options.map((d) => {
        const isActive = d === active;
        return (
          <Link
            key={d}
            href={`/metrics?days=${d}`}
            className={[
              "px-3 py-1.5 rounded-full text-sm border",
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-slate-100"
            ].join(" ")}
          >
            אחרון {d} ימים
          </Link>
        );
      })}
    </div>
  );
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ✅ יחזיר user עם id, או יבצע redirect/throw אם לא מחובר (לפי ההלפר שלך)
  const { id: userId } = await requireUser();

  const sp = await searchParams;
  const daysParam = Array.isArray(sp?.days) ? sp.days[0] : sp?.days;
  const days = Number.isFinite(Number(daysParam))
    ? Math.max(1, Math.min(365, Number(daysParam)))
    : 7;

  const data = await getSummary(userId, days);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      {/* כותרת + בורר טווח ימים */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold">מדדים</h1>
        <DaysPicker active={data.days} />
      </div>

      {/* שורת KPI ראשית */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-600">AI Usage</h2>
          <div className="mt-2 space-y-1.5 text-sm">
            <div>Calls: <b>{data.ai.calls}</b></div>
            <div>
              Total Tokens: <b>{data.ai.total}</b>{" "}
              <span className="text-slate-500">
                (Prompt {data.ai.prompt} / Completion {data.ai.completion})
              </span>
            </div>
            <div>Avg Latency: <b>{data.ai.avgLatencyMs}</b> ms</div>
            <div>
              Cost:{" "}
              <b>{data.ai.costUsd === null ? "—" : `$${data.ai.costUsd.toFixed(4)}`}</b>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-600">Cover Letters</h2>
          <div className="mt-2 space-y-1.5 text-sm">
            <div>Created: <b>{data.coverLetters.created}</b></div>
            <div>Regenerated: <b>{data.coverLetters.regenerated}</b></div>
            <div>Total: <b>{data.coverLetters.total}</b></div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-600">Quick Links</h2>
          <div className="mt-2 space-y-1.5 text-sm">
            <Link
              className="text-blue-600 underline"
              href={`/api/metrics/summary?days=${data.days}`}
            >
              Raw JSON
            </Link>
            <p className="text-slate-500">הנתונים מסוכמים עבור המשתמש הנוכחי בלבד.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
