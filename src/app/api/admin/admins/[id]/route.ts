import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/admin-auth";

const schema = z.object({ action: z.enum(["activate", "deactivate"]) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas désactiver votre propre compte" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  await prisma.adminUser.update({
    where: { id },
    data: { isActive: parsed.data.action === "activate" },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: parsed.data.action === "activate" ? "ADMIN_ACCOUNT_ACTIVATED" : "ADMIN_ACCOUNT_DEACTIVATED",
      targetType: "AdminUser",
      targetId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
