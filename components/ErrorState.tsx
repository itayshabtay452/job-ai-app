// components/ErrorState.tsx
import * as React from "react";

export function ErrorState({
  title = "אירעה שגיאה",
  message = "לא הצלחנו לטעון את התוכן",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl border bg-white p-4 text-sm"
    >
      <div className="text-red-600 font-medium">{title}</div>
      <div className="text-slate-600 mt-1">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs rounded-md border px-2 py-1 hover:bg-muted transition"
        >
          נסה שוב
        </button>
      )}
    </div>
  );
}
