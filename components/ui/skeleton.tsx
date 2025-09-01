// components/ui/skeleton.tsx
import * as React from "react";
import { cn } from "@/lib/utils"; // מניחים שקיים (משמש כבר ב-Button). אם לא - TODO: להוסיף utils.

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
