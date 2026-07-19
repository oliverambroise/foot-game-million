import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, signAdminAccessToken } from "@/lib/auth";
import { getAdminCookieName } from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  // Fenêtre stricte: c'est la porte d'entrée vers toute l'administration.
  const rl = rateLimit(`admin-login:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  const genericError = () =>
    NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });

  if (!admin || !admin.isActive) return genericError();

  const ok = await verifyPassword(parsed.data.password, admin.passwordHash);

  await prisma.adminLoginLog.create({
    data: { adminId: admin.id, ipAddress: ip, userAgent: req.headers.get("user-agent"), success: ok },
  });

  if (!ok) return genericError();

  const token = signAdminAccessToken(admin.id, admin.role);
  const res = NextResponse.json({ ok: true, admin: { email: admin.email, role: admin.role } });
  res.cookies.set(getAdminCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h — la 2FA/rotation plus fine arrive en Phase 7
  });
  return res;
}
