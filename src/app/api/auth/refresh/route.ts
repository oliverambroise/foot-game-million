import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPlayerRefreshToken,
  signPlayerAccessToken,
  signPlayerRefreshToken,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import {
  setSessionCookies,
  clearSessionCookies,
  getRefreshTokenCookieName,
} from "@/lib/cookies";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`refresh:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de tentatives." }, { status: 429 });
  }

  const refreshToken = req.cookies.get(getRefreshTokenCookieName())?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let payload;
  try {
    payload = verifyPlayerRefreshToken(refreshToken);
  } catch {
    const res = NextResponse.json({ error: "Session expirée" }, { status: 401 });
    clearSessionCookies(res);
    return res;
  }

  const player = await prisma.player.findUnique({ where: { id: payload.sub } });

  if (!player || !player.refreshTokenHash) {
    const res = NextResponse.json({ error: "Session invalide" }, { status: 401 });
    clearSessionCookies(res);
    return res;
  }

  // Vérifie que ce refresh token est bien celui enregistré en base
  // (permet une révocation immédiate: logout, blocage admin, rotation).
  const matches = await verifyPassword(refreshToken, player.refreshTokenHash);
  if (!matches) {
    const res = NextResponse.json({ error: "Session invalide" }, { status: 401 });
    clearSessionCookies(res);
    return res;
  }

  if (player.status !== "ACTIVE") {
    const res = NextResponse.json({ error: "Compte inactif" }, { status: 403 });
    clearSessionCookies(res);
    return res;
  }

  // Rotation du refresh token à chaque utilisation (limite la fenêtre
  // d'exploitation si un token venait à fuiter).
  const newAccessToken = signPlayerAccessToken(player.id);
  const newRefreshToken = signPlayerRefreshToken(player.id);
  const newRefreshTokenHash = await hashPassword(newRefreshToken);

  await prisma.player.update({
    where: { id: player.id },
    data: { refreshTokenHash: newRefreshTokenHash },
  });

  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
  return res;
}
