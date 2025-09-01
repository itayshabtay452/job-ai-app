// app/jobs/[id]/error.tsx
"use client";

import { ErrorState } from "@/components/ErrorState";

export default function ErrorJobDetail({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <ErrorState
        title="שגיאה בטעינת פרטי המשרה"
        message={error?.message || "נסה לרענן או לנסות שוב בהמשך"}
        onRetry={reset}
      />
      {/* טיפ למפתחים: */}
      {/* <pre className="mt-3 text-[11px] text-slate-500 whitespace-pre-wrap">
        {error?.stack}
      </pre> */}
    </main>
  );
}
