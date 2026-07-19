import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/auth";
import { randomInt } from "crypto";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ admins });
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MANAGER"]),
});

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generateTempPassword(): string {
  return Array.from({ length: 12 }, () => PASSWORD_ALPHABET[randomInt(0, PASSWORD_ALPHABET.length)]).join("");
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const created = await prisma.adminUser.create({
    data: { email: parsed.data.email, role: parsed.data.role, passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: "ADMIN_ACCOUNT_CREATED",
      targetType: "AdminUser",
      targetId: created.id,
      metadata: `role=${parsed.data.role}`,
    },
  });

  return NextResponse.json({
    admin: { id: created.id, email: created.email, role: created.role },
    tempPassword,
  });
}
