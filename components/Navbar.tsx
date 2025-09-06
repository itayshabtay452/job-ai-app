// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resume", label: "Resume" },
  { href: "/jobs", label: "Jobs" },
  { href: "/metrics", label: "Metrics" },
];

function InitialBubble({ nameOrEmail }: { nameOrEmail: string }) {
  const initial = (nameOrEmail?.[0] || "U").toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="grid size-8 place-items-center rounded-full bg-slate-200 text-slate-700 text-sm font-semibold"
    >
      {initial}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession(); // "loading" | "authenticated" | "unauthenticated"

  const nameOrEmail = session?.user?.name || session?.user?.email || "User";
  const avatarUrl = session?.user?.image || null;

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="inline-block size-6 rounded-md bg-primary/10" aria-hidden="true" />
          <span className="font-bold tracking-tight">Job AI</span>
        </div>

        {/* Primary nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {links.map((l) => {
            const active =
              pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
                <Button variant={active ? "default" : "ghost"} className="px-3">
                  {l.label}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Right side: auth-aware */}
        <div className="flex items-center gap-2">
          {/* Loading session → skeleton */}
          {status === "loading" && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          )}

          {/* Unauthenticated → sign in */}
          {status === "unauthenticated" && (
            <Button
              onClick={() => signIn("github")}
              className="px-3"
              aria-label="Sign in with GitHub"
              title="Sign in with GitHub"
            >
              Sign in
            </Button>
          )}

          {/* Authenticated → avatar + menu */}
          {status === "authenticated" && (
            <details className="relative">
              <summary
                className="list-none inline-flex items-center gap-2 rounded-full p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer"
                aria-label="User menu"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <InitialBubble nameOrEmail={nameOrEmail} />
                )}
                <span className="hidden md:inline text-sm text-slate-700 max-w-[140px] truncate">
                  {nameOrEmail}
                </span>
              </summary>

              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border bg-white shadow-md"
              >
                <div className="px-3 py-2 text-xs text-slate-500">
                  מחובר כ־<span className="font-medium">{nameOrEmail}</span>
                </div>
                <div className="border-t" />
                <div className="p-1">
                  <MenuItem href="/dashboard" label="Dashboard" />
                  <MenuItem href="/resume" label="Resume" />
                  <MenuItem href="/jobs" label="Jobs" />
                </div>
                <div className="border-t" />
                <div className="p-1">
                  <button
                    role="menuitem"
                    onClick={() => signOut()}
                    className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </nav>
  );
}

function MenuItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
    >
      {label}
    </Link>
  );
}
