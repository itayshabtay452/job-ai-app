"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center">Loading...</main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center gap-4">
      {session ? (
        <>
          <div>Hi {session.user?.name || session.user?.email}</div>
          <Button onClick={() => signOut()}>Sign out</Button>
        </>
      ) : (
        <Button onClick={() => signIn("github")}>Sign in with GitHub</Button>
      )}
    </main>
  );
}
