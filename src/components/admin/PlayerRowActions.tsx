"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PlayerRowActions({
  playerId,
  status,
  currentLevel,
  totalGoalsScored,
  totalGoalsConceded,
  bonusRoundUnlocked,
  canEditLevelScore,
}: {
  playerId: string;
  status: "ACTIVE" | "BLOCKED" | "DISABLED";
  currentLevel: number;
  totalGoalsScored: number;
  totalGoalsConceded: number;
  bonusRoundUnlocked: boolean;
  canEditLevelScore: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState(currentLevel);
  const [scored, setScored] = useState(totalGoalsScored);
  const [conceded, setConceded] = useState(totalGoalsConceded);

  async function act(action: string, extra?: Record<string, unknown>) {
    if (action === "reset-progress" && !confirm("Réinitialiser toute la progression de ce joueur ?")) {
      return;
    }
    setLoading(true);
    await fetch(`/api/admin/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-800/60 p-2 rounded-lg">
        <label className="text-xs text-gray-400">
          Niveau
          <input
            type="number"
            min={1}
            max={32}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="w-14 ml-1 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          />
        </label>
        <label className="text-xs text-gray-400">
          Buts marqués
          <input
            type="number"
            min={0}
            value={scored}
            onChange={(e) => setScored(Number(e.target.value))}
            className="w-16 ml-1 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          />
        </label>
        <label className="text-xs text-gray-400">
          Buts encaissés
          <input
            type="number"
            min={0}
            value={conceded}
            onChange={(e) => setConceded(Number(e.target.value))}
            className="w-16 ml-1 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          />
        </label>
        <button
          disabled={loading}
          onClick={() =>
            act("edit", {
              currentLevel: level,
              totalGoalsScored: scored,
              totalGoalsConceded: conceded,
            })
          }
          className="text-xs bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-600"
        >
          Enregistrer
        </button>
        <button
          disabled={loading}
          onClick={() => setEditing(false)}
          className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {canEditLevelScore && (
        <button
          disabled={loading}
          onClick={() => setEditing(true)}
          className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded hover:bg-blue-900"
        >
          Modifier
        </button>
      )}
      {status !== "BLOCKED" ? (
        <button
          disabled={loading}
          onClick={() => act("block")}
          className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-900"
        >
          Bloquer
        </button>
      ) : (
        <button
          disabled={loading}
          onClick={() => act("unblock")}
          className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded hover:bg-green-900"
        >
          Débloquer
        </button>
      )}
      {bonusRoundUnlocked ? (
        <button
          disabled={loading}
          onClick={() => act("disable-bonus")}
          className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-1 rounded hover:bg-yellow-900"
        >
          Retirer bonus
        </button>
      ) : (
        <button
          disabled={loading}
          onClick={() => act("enable-bonus")}
          className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-900/60"
        >
          Activer bonus
        </button>
      )}
      {canEditLevelScore && (
        <button
          disabled={loading}
          onClick={() => act("reset-progress")}
          className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
