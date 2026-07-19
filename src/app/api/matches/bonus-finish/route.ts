import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPlayerAccessToken } from "@/lib/auth";
import { getAccessTokenCookieName } from "@/lib/cookies";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

const finishSchema = z.object({
  goalsScored: z.number().int().min(0).max(50),
  goalsConceded: z.number().int().min(0).max(50),
  durationMs: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`bonus-finish:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 });
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
  const { goalsScored, goalsConceded, durationMs } = parsed.data;

  const settings = await prisma.gameSettings.findUnique({ where: { id: "singleton" } });
  const expectedDurationMs = (settings?.matchDurationSec ?? 120) * 1000;
  if (Math.abs(durationMs - expectedDurationMs) > 5000) {
    return NextResponse.json({ error: "Durée de match invalide" }, { status: 422 });
  }
  if (settings?.maintenanceMode) {
    return NextResponse.json({ error: "Le jeu est actuellement en maintenance" }, { status: 503 });
  }

  const player = await prisma.player.findUnique({ where: { id: payload.sub } });
  if (!player || player.status !== "ACTIVE") {
    return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 403 });
  }
  if (!player.hasFinished) {
    return NextResponse.json({ error: "Terminez d'abord les 32 matchs" }, { status: 409 });
  }
  if (!player.bonusRoundUnlocked) {
    return NextResponse.json({ error: "Le parcours bonus n'est pas activé pour ce compte" }, { status: 403 });
  }
  if (player.bonusMatchesPlayed >= 4) {
    return NextResponse.json({ error: "Les 4 matchs bonus ont déjà été joués" }, { status: 409 });
  }

  const levelNumber = 32 + player.bonusMatchesPlayed + 1;

  try {
    const updatedPlayer = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.match.create({
        data: {
          playerId: player.id,
          levelNumber,
          goalsScored,
          goalsConceded,
          durationMs,
          difficulty: "EASY",
          finishedAt: new Date(),
        },
      });

      return tx.player.update({
        where: { id: player.id },
        data: {
          bonusMatchesPlayed: { increment: 1 },
          totalGoalsScored: { increment: goalsScored },
          totalGoalsConceded: { increment: goalsConceded },
          totalDurationMs: { increment: durationMs },
          matchesPlayed: { increment: 1 },
        },
      });
    });

    return NextResponse.json({
      player: { bonusMatchesPlayed: updatedPlayer.bonusMatchesPlayed },
      match: { goalsScored, goalsConceded, levelNumber },
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Ce match bonus a déjà été enregistré" }, { status: 409 });
    }
    console.error("Erreur finish bonus:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
