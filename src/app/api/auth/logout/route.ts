import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPlayerAccessToken } from "@/lib/auth";
import { getAccessTokenCookieName, clearSessionCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(getAccessTokenCookieName())?.value;

  if (token) {
    try {
      const payload = verifyPlayerAccessToken(token);
      // Révocation immédiate: un refresh token déjà émis ne pourra plus
      // être utilisé après cette déconnexion.
      await prisma.player.update({
        where: { id: payload.sub },
        data: { refreshTokenHash: null },
      });
    } catch {
      // Token déjà invalide/expiré: rien à révoquer, on efface juste les cookies.
    }
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
