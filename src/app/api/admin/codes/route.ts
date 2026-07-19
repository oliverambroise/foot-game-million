import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { generateParticipationCode } from "@/lib/auth";

const schema = z.object({ count: z.number().int().min(1).max(500) });

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const codes = Array.from({ length: parsed.data.count }, () => generateParticipationCode());

  await prisma.participationCode.createMany({
    data: codes.map((code) => ({ code, createdByAdminId: admin.id })),
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: "CODES_GENERATED",
      metadata: `count=${parsed.data.count}`,
    },
  });

  return NextResponse.json({ codes });
}

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const codes = await prisma.participationCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ codes });
}
