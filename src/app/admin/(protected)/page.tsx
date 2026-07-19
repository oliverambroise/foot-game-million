import { prisma } from "@/lib/db";

export default async function AdminDashboard() {
  const [totalPlayers, finishedPlayers, blockedPlayers, matchesPlayed, totalCodes, usedCodes] =
    await Promise.all([
      prisma.player.count(),
      prisma.player.count({ where: { hasFinished: true } }),
      prisma.player.count({ where: { status: "BLOCKED" } }),
      prisma.match.count(),
      prisma.participationCode.count(),
      prisma.participationCode.count({ where: { isUsed: true } }),
    ]);

  const cards = [
    { label: "Joueurs inscrits", value: totalPlayers },
    { label: "Parcours terminés", value: finishedPlayers },
    { label: "Joueurs bloqués", value: blockedPlayers },
    { label: "Matchs joués", value: matchesPlayed },
    { label: "Codes générés", value: totalCodes },
    { label: "Codes utilisés", value: usedCodes },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Tableau de bord</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-6">
        Les graphiques temps réel, les exports Excel/CSV/PDF et les revenus
        (bonus, rejoue) arrivent avec les modules Paiement/Bonus (Phase 6).
      </p>
    </div>
  );
}
