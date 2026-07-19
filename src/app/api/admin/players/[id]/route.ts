import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/admin-auth";

const schema = z.object({
  action: z.enum([
    "block",
    "unblock",
    "disable",
    "activate",
    "reset-progress",
    "edit",
    "enable-bonus",
    "disable-bonus",
  ]),
  note: z.string().max(500).optional(),
  currentLevel: z.number().int().min(1).max(32).optional(),
  totalGoalsScored: z.number().int().min(0).max(9999).optional(),
  totalGoalsConceded: z.number().int().min(0).max(9999).optional(),
});

// Actions qui modifient le niveau ou le score: réservées aux admins complets
// (le rôle MANAGER peut gérer les codes, bloquer/débloquer les joueurs et
// activer/désactiver leur accès au parcours bonus, mais jamais toucher au
// niveau ou au score).
const ADMIN_ONLY_ACTIONS = new Set(["edit", "reset-progress"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  if (admin.role === "MANAGER" && ADMIN_ONLY_ACTIONS.has(parsed.data.action)) {
    return NextResponse.json(
      { error: "Un gestionnaire ne peut pas modifier le niveau ou le score d'un joueur" },
      { status: 403 }
    );
  }

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });

  let updateData: Record<string, unknown> = {};
  switch (parsed.data.action) {
    case "block":
      updateData = { status: "BLOCKED" };
      break;
    case "unblock":
    case "activate":
      updateData = { status: "ACTIVE" };
      break;
    case "disable":
      updateData = { status: "DISABLED" };
      break;
    case "reset-progress":
      updateData = {
        currentLevel: 1,
        hasFinished: false,
        totalGoalsScored: 0,
        totalGoalsConceded: 0,
        totalDurationMs: 0,
        matchesPlayed: 0,
        bonusMatchesPlayed: 0,
      };
      break;
    case "enable-bonus":
      updateData = { bonusRoundUnlocked: true };
      break;
    case "disable-bonus":
      updateData = { bonusRoundUnlocked: false };
      break;
    case "edit": {
      const edit: Record<string, unknown> = {};
      if (parsed.data.currentLevel !== undefined) {
        edit.currentLevel = parsed.data.currentLevel;
        edit.hasFinished = parsed.data.currentLevel >= 32 ? player.hasFinished : false;
      }
      if (parsed.data.totalGoalsScored !== undefined) {
        edit.totalGoalsScored = parsed.data.totalGoalsScored;
      }
      if (parsed.data.totalGoalsConceded !== undefined) {
        edit.totalGoalsConceded = parsed.data.totalGoalsConceded;
      }
      updateData = edit;
      break;
    }
  }

  await prisma.$transaction([
    prisma.player.update({ where: { id }, data: updateData }),
    ...(parsed.data.action === "reset-progress"
      ? [prisma.match.deleteMany({ where: { playerId: id } })]
      : []),
    prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: `PLAYER_${parsed.data.action.toUpperCase().replace(/-/g, "_")}`,
        targetType: "Player",
        targetId: id,
        metadata: parsed.data.note ?? null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
