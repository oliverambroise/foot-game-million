import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { verifyAdminAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ADMIN_COOKIE = "fg_admin_access";

export function getAdminCookieName() {
  return ADMIN_COOKIE;
}

/** À utiliser dans les Server Components. Retourne null si non connecté. */
export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return resolveAdminFromToken(token);
}

/** À utiliser dans les Route Handlers (API admin). Retourne null si non connecté. */
export async function getAdminFromRequest(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return resolveAdminFromToken(token);
}

async function resolveAdminFromToken(token: string) {
  try {
    const payload = verifyAdminAccessToken(token);
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) return null;
    return admin;
  } catch {
    return null;
  }
}
