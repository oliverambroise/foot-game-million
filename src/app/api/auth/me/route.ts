import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPlayerAccessToken } from "@/lib/auth";
import { getAccessTokenCookieName } from "@/lib/cookies";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(getAccessTokenCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let payload;
  try {
    payload = verifyPlayerAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  const player = await prisma.player.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      currentLevel: true,
      hasFinished: true,
      status: true,
      bonusRoundUnlocked: true,
      bonusMatchesPlayed: true,
    },
  });

  if (!player || player.status !== "ACTIVE") {
    return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 403 });
  }

  // C'est ici que le client sait exactement où reprendre: le niveau courant
  // vient de la base de données, jamais du localStorage/client.
  return NextResponse.json({ player });
}
