// app/api/jobs/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs"; // חשוב: Prisma רץ על Node, לא Edge

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      source: true,
      externalId: true,
      title: true,
      company: true,
      location: true,
      description: true,
      skillsRequired: true,
      url: true,
      createdAt: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}
