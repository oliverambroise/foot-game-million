import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPlayerAccessToken } from "@/lib/auth";
import { getAccessTokenCookieName } from "@/lib/cookies";

type RankedPlayer = {
  id: string;
  name: string;
  totalGoalsScored: number;
  totalGoalsConceded: number;
  totalDurationMs: number;
  matchesPlayed: number;
  hasFinished: boolean;
  createdAt: Date;
};

export async function GET(req: NextRequest) {
  const settings = await prisma.gameSettings.findUnique({ where: { id: "singleton" } });
  const topN = settings?.leaderboardTopN ?? 20;

  const players = await prisma.player.findMany({
    where: { matchesPlayed: { gt: 0 }, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      totalGoalsScored: true,
      totalGoalsConceded: true,
      totalDurationMs: true,
      matchesPlayed: true,
      hasFinished: true,
      createdAt: true,
    },
  });

  // Règles de classement (voir cahier des charges):
  // 1. plus grand différentiel  2. plus de buts marqués
  // 3. temps total le plus court  4. premier arrivé à ce score
  const ranked = players
    .map((p: RankedPlayer) => ({
      ...p,
      differential: p.totalGoalsScored - p.totalGoalsConceded,
    }))
    .sort((a: RankedPlayer & { differential: number }, b: RankedPlayer & { differential: number }) => {
      if (b.differential !== a.differential) return b.differential - a.differential;
      if (b.totalGoalsScored !== a.totalGoalsScored)
        return b.totalGoalsScored - a.totalGoalsScored;
      if (a.totalDurationMs !== b.totalDurationMs) return a.totalDurationMs - b.totalDurationMs;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  const top = ranked.slice(0, topN).map((p: RankedPlayer & { differential: number }, idx: number) => ({
    rank: idx + 1,
    name: p.name,
    differential: p.differential,
    goalsScored: p.totalGoalsScored,
    matchesPlayed: p.matchesPlayed,
    hasFinished: p.hasFinished,
  }));

  // Position du joueur connecté, même s'il n'est pas dans le Top affiché
  let self = null;
  const token = req.cookies.get(getAccessTokenCookieName())?.value;
  if (token) {
    try {
      const payload = verifyPlayerAccessToken(token);
      const idx = ranked.findIndex((p: RankedPlayer) => p.id === payload.sub);
      if (idx !== -1) {
        const p = ranked[idx];
        self = {
          rank: idx + 1,
          name: p.name,
          differential: p.differential,
          goalsScored: p.totalGoalsScored,
        };
      }
    } catch {
      // pas connecté / token expiré: on renvoie juste le classement public
    }
  }

  return NextResponse.json({ top, self, totalPlayers: ranked.length });
}
