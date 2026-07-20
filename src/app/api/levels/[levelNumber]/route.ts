import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { difficultyFromLevel } from "@/lib/game-engine";
import type { Difficulty as PrismaDifficulty } from "@prisma/client";

const DIFFICULTY_MAP: Record<number, PrismaDifficulty> = {
  1: "EASY",
  2: "MEDIUM",
  3: "HARD",
  4: "VERY_HARD",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ levelNumber: string }> }
) {
  const { levelNumber: raw } = await params;
  const levelNumber = Number(raw);
  if (!Number.isInteger(levelNumber) || levelNumber < 1) {
    return NextResponse.json({ error: "Niveau invalide" }, { status: 400 });
  }

  // Les niveaux bonus (>32) n'ont pas de réglage admin dédié: toujours facile.
  const levelConfig =
    levelNumber <= 32
      ? await prisma.levelConfig.findUnique({ where: { levelNumber } })
      : null;

  const difficulty: PrismaDifficulty =
    levelConfig?.difficulty ?? DIFFICULTY_MAP[difficultyFromLevel(levelNumber)];

  return NextResponse.json({ difficulty });
}
