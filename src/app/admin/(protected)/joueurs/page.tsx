import { prisma } from "@/lib/db";
import PlayerRowActions from "@/components/admin/PlayerRowActions";
import { getCurrentAdmin } from "@/lib/admin-auth";

type PlayerRow = {
  id: string;
  name: string;
  phone: string;
  status: "ACTIVE" | "BLOCKED" | "DISABLED";
  currentLevel: number;
  hasFinished: boolean;
  totalGoalsScored: number;
  totalGoalsConceded: number;
  bonusMatchesAllowed: number;
  bonusMatchesPlayed: number;
  createdAt: Date;
};

export default async function AdminPlayersPage() {
  const admin = await getCurrentAdmin();
  const isManager = admin?.role === "MANAGER";

  const players = await prisma.player.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      currentLevel: true,
      hasFinished: true,
      totalGoalsScored: true,
      totalGoalsConceded: true,
      bonusMatchesAllowed: true,
      bonusMatchesPlayed: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Joueurs ({players.length})</h1>
      {isManager && (
        <p className="text-xs text-gray-500 mb-3">
          Compte gestionnaire: vous pouvez bloquer/débloquer les joueurs et
          déterminer leur nombre de matchs bonus, mais pas modifier leur
          niveau, leur score ou leur nom.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="py-2 pr-3">Nom</th>
              <th className="py-2 pr-3">Téléphone</th>
              <th className="py-2 pr-3">Niveau</th>
              <th className="py-2 pr-3">Diff.</th>
              <th className="py-2 pr-3">Statut</th>
              <th className="py-2 pr-3">Bonus</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p: PlayerRow) => (
              <tr key={p.id} className="border-b border-gray-900">
                <td className="py-2 pr-3">{p.name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{p.phone}</td>
                <td className="py-2 pr-3">
                  {p.hasFinished ? "Terminé" : `${p.currentLevel} / 32`}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {p.totalGoalsScored - p.totalGoalsConceded}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={
                      p.status === "ACTIVE"
                        ? "text-green-400"
                        : p.status === "BLOCKED"
                        ? "text-red-400"
                        : "text-gray-500"
                    }
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {p.bonusMatchesAllowed > 0 ? (
                    <span className="text-yellow-400">
                      {p.bonusMatchesPlayed}/{p.bonusMatchesAllowed}
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <PlayerRowActions
                    playerId={p.id}
                    playerName={p.name}
                    status={p.status}
                    currentLevel={p.currentLevel}
                    totalGoalsScored={p.totalGoalsScored}
                    totalGoalsConceded={p.totalGoalsConceded}
                    bonusMatchesAllowed={p.bonusMatchesAllowed}
                    canEditLevelScore={!isManager}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && (
          <p className="text-gray-500 text-sm mt-4">Aucun joueur inscrit pour le moment.</p>
        )}
      </div>
    </div>
  );
}
