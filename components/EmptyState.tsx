// components/EmptyState.tsx
import * as React from "react";

export function EmptyState({
  title = "לא נמצאו פריטים",
  description,
  action,
}: {
  title?: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode; // למשל כפתור "נקה פילטרים"
}) {
  return (
    <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-600 space-y-2">
      <div className="font-medium text-slate-800">{title}</div>
      {description ? <div className="text-slate-500">{description}</div> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
