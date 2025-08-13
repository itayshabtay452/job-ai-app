// #region Imports
"use client";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
// #endregion

// #region Component
export default function Home() {
  // #region Session hook
  const { data: session, status } = useSession();
  // #endregion

  // #region Loading state
  if (status === "loading") return <main className="p-6">Loading…</main>;
  // #endregion

  // #region Unauthenticated view
  if (!session)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Button onClick={() => signIn("github")}>Sign in with GitHub</Button>
      </main>
    );
  // #endregion

  // #region Derived user fields
  const nameOrEmail = session.user?.name || session.user?.email || "User";
  const img = session.user?.image;
  // #endregion

  // #region Authenticated view
  return (
    <main className="flex min-h-screen items-center justify-center gap-4">
      {/* #region Avatar */}
      {img ? (
        <Image src={img} alt="avatar" width={48} height={48} className="rounded-full" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
          {(nameOrEmail[0] || "U").toUpperCase()}
        </div>
      )}
      {/* #endregion */}

      <div>ברוך הבא, {nameOrEmail}!</div>

      {/* #region Sign out */}
      <Button variant="outline" onClick={() => signOut()}>
        Sign out
      </Button>
      {/* #endregion */}
    </main>
  );
}
// #endregion
