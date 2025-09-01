// app/jobs/[id]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingJobDetail() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      {/* כותרת / חברה / מיקום */}
      <div className="flex items-baseline gap-2">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* מטא-דאטה */}
      <Skeleton className="h-3 w-64" />

      {/* תיאור */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* תגיות סקילז */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>

      {/* קישור למקור */}
      <Skeleton className="h-4 w-40" />

      {/* פאנל התאמה — שלד מינימלי */}
      <div className="mt-6 rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <Skeleton className="h-6 w-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* עורך מכתב — שלד מינימלי */}
      <div className="mt-8 rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-md" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </main>
  );
}
