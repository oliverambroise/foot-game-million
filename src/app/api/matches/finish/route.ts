import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPlayerAccessToken } from "@/lib/auth";
import { getAccessTokenCookieName } from "@/lib/cookies";
import { difficultyFromLevel } from "@/lib/game-engine";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
import type { Difficulty as PrismaDifficulty } from "@prisma/client";

const finishSchema = z.object({
  levelNumber: z.number().int().min(1).max(32),
  goalsScored: z.number().int().min(0).max(50),
  goalsConceded: z.number().int().min(0).max(50),
  durationMs: z.number().int().min(0),
  shotsAttempted: z.number().int().min(0).max(200),
});

const DIFFICULTY_MAP: Record<number, PrismaDifficulty> = {
  1: "EASY",
  2: "MEDIUM",
  3: "HARD",
  4: "VERY_HARD",
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`match-finish:${ip}`, { limit: 60, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  const token = req.cookies.get(getAccessTokenCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let payload;
  try {
    payload = verifyPlayerAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = finishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { levelNumber, goalsScored, goalsConceded, durationMs } = parsed.data;

  const settings = await prisma.gameSettings.findUnique({ where: { id: "singleton" } });
  const expectedDurationMs = (settings?.matchDurationSec ?? 120) * 1000;

  // --- Vérifications de vraisemblance côté serveur ---
  // Le client ne fait jamais autorité sur le score: on rejette ce qui est
  // physiquement incohérent avec les règles du moteur de jeu. Un but peut
  // venir d'un tir, d'une passe qui termine au fond, ou du ballon porté
  // jusqu'à la ligne — donc pas de comparaison stricte avec le nombre de tirs.
  if (Math.abs(durationMs - expectedDurationMs) > 5000) {
    return NextResponse.json({ error: "Durée de match invalide" }, { status: 422 });
  }

  const player = await prisma.player.findUnique({ where: { id: payload.sub } });
  if (!player || player.status !== "ACTIVE") {
    return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 403 });
  }

  if (settings?.maintenanceMode) {
    return NextResponse.json({ error: "Le jeu est actuellement en maintenance" }, { status: 503 });
  }
  if (settings?.closingAt && new Date() > settings.closingAt) {
    return NextResponse.json({ error: "Le jeu est fermé" }, { status: 503 });
  }

  // Le joueur doit jouer les niveaux dans l'ordre, exactement celui où il en est
  if (levelNumber !== player.currentLevel) {
    return NextResponse.json(
      { error: "Ce niveau n'est pas votre niveau courant" },
      { status: 409 }
    );
  }
  if (player.hasFinished) {
    return NextResponse.json({ error: "Parcours déjà terminé" }, { status: 409 });
  }

  // Difficulté: config admin spécifique au niveau si elle existe, sinon barème par défaut
  const levelConfig = await prisma.levelConfig.findUnique({ where: { levelNumber } });
  const difficultyEnum: PrismaDifficulty =
    levelConfig?.difficulty ?? DIFFICULTY_MAP[difficultyFromLevel(levelNumber)];

  try {
    const isLastLevel = levelNumber >= 32;

    const updatedPlayer = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.match.create({
        data: {
          playerId: player.id,
          levelNumber,
          goalsScored,
          goalsConceded,
          durationMs,
          difficulty: difficultyEnum,
          finishedAt: new Date(),
        },
      });

      return tx.player.update({
        where: { id: player.id },
        data: {
          currentLevel: isLastLevel ? player.currentLevel : player.currentLevel + 1,
          hasFinished: isLastLevel,
          totalGoalsScored: { increment: goalsScored },
          totalGoalsConceded: { increment: goalsConceded },
          totalDurationMs: { increment: durationMs },
          matchesPlayed: { increment: 1 },
        },
      });
    });

    return NextResponse.json({
      player: {
        currentLevel: updatedPlayer.currentLevel,
        hasFinished: updatedPlayer.hasFinished,
      },
      match: { goalsScored, goalsConceded, levelNumber },
    });
  } catch (err: unknown) {
    // Contrainte unique (playerId, levelNumber): ce niveau a déjà été soumis
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Ce niveau a déjà été enregistré" }, { status: 409 });
    }
    console.error("Erreur finish match:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
