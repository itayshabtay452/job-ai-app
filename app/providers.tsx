//C:\Users\itays\Desktop\33\job-ai-app\app\providers.tsx

"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
