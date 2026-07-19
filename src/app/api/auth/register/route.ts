import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registerSchema, normalizePhone } from "@/lib/validation";
import {
  signPlayerAccessToken,
  signPlayerRefreshToken,
  hashPassword,
} from "@/lib/auth";
import { setSessionCookies } from "@/lib/cookies";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // --- Rate limiting anti brute-force / anti spam d'inscriptions ---
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`register:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }

  // --- Validation stricte des entrées ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, phone, participationCode } = parsed.data;
  const normalizedPhone = normalizePhone(phone);

  try {
    const player = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Le code doit exister et ne pas déjà être utilisé
      const code = await tx.participationCode.findUnique({
        where: { code: participationCode },
      });

      if (!code) {
        throw new AppError("Code de participation invalide", 404);
      }
      if (code.isUsed) {
        throw new AppError("Ce code de participation a déjà été utilisé", 409);
      }

      // 2. Le numéro de téléphone ne doit pas déjà être enregistré
      const existingPlayer = await tx.player.findUnique({
        where: { phone: normalizedPhone },
      });
      if (existingPlayer) {
        throw new AppError(
          "Ce numéro de téléphone est déjà associé à un joueur. Utilisez la reconnexion.",
          409
        );
      }

      // 3. Création du joueur + verrouillage du code dans la même transaction
      //    (évite une "course" où deux inscriptions simultanées utiliseraient
      //    le même code)
      const created = await tx.player.create({
        data: {
          name,
          phone: normalizedPhone,
          currentLevel: 1,
          acceptedTermsAt: new Date(),
          participationCode: { connect: { id: code.id } },
        },
      });

      await tx.participationCode.update({
        where: { id: code.id },
        data: { isUsed: true, usedAt: new Date() },
      });

      return created;
    });

    // --- Émission des tokens de session ---
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
      },
    });
    setSessionCookies(res, { accessToken, refreshToken });
    return res;
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Erreur inscription joueur:", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'inscription" },
      { status: 500 }
    );
  }
}

class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
