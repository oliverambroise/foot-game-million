import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signPlayerAccessToken, signPlayerRefreshToken, hashPassword } from "@/lib/auth";
import { setSessionCookies } from "@/lib/cookies";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

// Reconnexion simplifiée: le code de participation suffit (il est unique
// par joueur), plus besoin de ressaisir le numéro de téléphone.
const loginSchema = z.object({
  participationCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^FOOT-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Code de participation invalide"),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`login:${ip}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const code = await prisma.participationCode.findUnique({
    where: { code: parsed.data.participationCode },
    include: { player: true },
  });

  const genericError = () =>
    NextResponse.json({ error: "Code invalide ou non associé à un compte" }, { status: 401 });

  if (!code || !code.player) return genericError();
  const player = code.player;

  if (player.status === "BLOCKED") {
    return NextResponse.json(
      { error: "Ce compte a été bloqué. Contactez l'organisateur." },
      { status: 403 }
    );
  }
  if (player.status === "DISABLED") {
    return NextResponse.json({ error: "Ce compte est désactivé." }, { status: 403 });
  }

  const accessToken = signPlayerAccessToken(player.id);
  const refreshToken = signPlayerRefreshToken(player.id);
  const refreshTokenHash = await hashPassword(refreshToken);

  await prisma.player.update({
    where: { id: player.id },
    data: { refreshTokenHash },
  });

  const res = NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      currentLevel: player.currentLevel,
      hasFinished: player.hasFinished,
    },
  });
  setSessionCookies(res, { accessToken, refreshToken });
  return res;
}
