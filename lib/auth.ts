// lib/auth.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: "database" },
};

// helper רשמי
export async function auth() {
  return getServerSession(authOptions);
}

// נחזיר רק מה שצריך בפועל
export type BasicUser = { id: string; email: string | null };

export async function requireUser(): Promise<BasicUser> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }, // ← מחזירים צורה מינימלית יציבה
  });
  if (!user) {
    throw Object.assign(new Error("user not found"), { status: 401 });
  }
  return user;
}

type AuthedHandler = (req: Request, ctx: { user: BasicUser }) => Promise<Response>;

export function withUser(handler: AuthedHandler) {
  return async (req: Request) => {
    try {
      const user = await requireUser();
      return handler(req, { user });
    } catch (e: any) {
      const code = e?.status === 401 ? 401 : 500;
      return NextResponse.json({ error: e?.message ?? "auth error" }, { status: code });
    }
  };
}
