import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role === "MANAGER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let settings = await prisma.gameSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) settings = await prisma.gameSettings.create({ data: { id: "singleton" } });
  return NextResponse.json({ settings });
}

const schema = z.object({
  leaderboardTopN: z.number().int().min(1).max(1000).optional(),
  closingAt: z.string().datetime().nullable().optional(),
  maintenanceMode: z.boolean().optional(),
  matchDurationSec: z.number().int().min(10).max(600).optional(),
  bannerMessage: z.string().max(300).nullable().optional(),
  bonusRoundMessage: z.string().max(500).nullable().optional(),
  bonusCtaUrl: z.string().max(500).nullable().optional(),
  termsUrl: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role === "MANAGER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.closingAt !== undefined) {
    data.closingAt = parsed.data.closingAt ? new Date(parsed.data.closingAt) : null;
  }

  const settings = await prisma.gameSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  await prisma.auditLog.create({
    data: { adminId: admin.id, action: "GAME_SETTINGS_UPDATED", metadata: JSON.stringify(parsed.data) },
  });

  return NextResponse.json({ settings });
}
