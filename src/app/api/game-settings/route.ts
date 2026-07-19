import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let settings = await prisma.gameSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    settings = await prisma.gameSettings.create({ data: { id: "singleton" } });
  }
  return NextResponse.json({
    matchDurationSec: settings.matchDurationSec,
    closingAt: settings.closingAt,
    maintenanceMode: settings.maintenanceMode,
    leaderboardTopN: settings.leaderboardTopN,
    termsUrl: settings.termsUrl,
    bannerMessage: settings.bannerMessage,
    bonusRoundMessage: settings.bonusRoundMessage,
    bonusCtaUrl: settings.bonusCtaUrl,
  });
}
