"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resume", label: "Resume" },
  { href: "/jobs", label: "Jobs" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        <div className="font-bold">Job AI</div>

        <div className="flex items-center gap-2">
          {links.map((l) => {
            const active =
              pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href}>
                <Button variant={active ? "default" : "ghost"}>{l.label}</Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
