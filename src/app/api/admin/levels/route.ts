import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { difficultyFromLevel } from "@/lib/game-engine";

const DIFFICULTY_MAP = ["EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role === "MANAGER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const overrides = await prisma.levelConfig.findMany();
  const overrideMap = new Map(
    overrides.map((o: { levelNumber: number; difficulty: string }) => [o.levelNumber, o.difficulty])
  );

  const levels = Array.from({ length: 32 }, (_, i) => {
    const levelNumber = i + 1;
    const defaultDifficulty = DIFFICULTY_MAP[difficultyFromLevel(levelNumber) - 1];
    return {
      levelNumber,
      difficulty: overrideMap.get(levelNumber) ?? defaultDifficulty,
      isOverridden: overrideMap.has(levelNumber),
    };
  });

  return NextResponse.json({ levels });
}

const patchSchema = z.object({
  levelNumber: z.number().int().min(1).max(32),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "VERY_HARD"]),
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  await prisma.levelConfig.upsert({
    where: { levelNumber: parsed.data.levelNumber },
    create: { levelNumber: parsed.data.levelNumber, difficulty: parsed.data.difficulty },
    update: { difficulty: parsed.data.difficulty },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: "LEVEL_DIFFICULTY_CHANGED",
      targetType: "LevelConfig",
      targetId: String(parsed.data.levelNumber),
      metadata: parsed.data.difficulty,
    },
  });

  return NextResponse.json({ ok: true });
}
