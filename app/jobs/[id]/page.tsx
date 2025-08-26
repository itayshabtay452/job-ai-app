import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import JobMatchPanel from "@/components/JobMatchPanel"; // ← ייבוא רגיל של Client Component
import CoverLetterEditor from "@/components/CoverLetterEditor"; // ← חדש

// נשאיר את המטא-דאטה של Next:
export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      source: true,
      externalId: true,
      title: true,
      company: true,
      location: true,
      description: true,
      skillsRequired: true,
      url: true,
      createdAt: true,
    },
  });

  if (!job) return notFound();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <span className="text-slate-500">— {job.company}</span>
        {job.location && (
          <span className="ml-auto text-sm text-slate-500">{job.location}</span>
        )}
      </div>

      <div className="text-xs text-slate-500">
        מקור: {job.source} · externalId: {job.externalId} · נוצר:{" "}
        {new Date(job.createdAt).toLocaleString()}
      </div>

      <div className="prose max-w-none">
        <p className="whitespace-pre-wrap">{job.description}</p>
      </div>

      {job.skillsRequired.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.skillsRequired.map((s) => (
            <span
              key={s}
              className="rounded-full border px-2 py-0.5 text-xs bg-slate-50"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {job.url && (
        <div>
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            קישור למשרה באתר המקור
          </a>
        </div>
      )}

      {/* פנל ציון התאמה (Client) */}
      <JobMatchPanel jobId={job.id} />
      <CoverLetterEditor jobId={job.id} maxWords={220} />
    </main>
  );
}
