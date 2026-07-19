"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PlayerRowActions({
  playerId,
  playerName,
  status,
  currentLevel,
  totalGoalsScored,
  totalGoalsConceded,
  bonusMatchesAllowed,
  canEditLevelScore,
}: {
  playerId: string;
  playerName: string;
  status: "ACTIVE" | "BLOCKED" | "DISABLED";
  currentLevel: number;
  totalGoalsScored: number;
  totalGoalsConceded: number;
  bonusMatchesAllowed: number;
  canEditLevelScore: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBonus, setEditingBonus] = useState(false);
  const [name, setName] = useState(playerName);
  const [level, setLevel] = useState(currentLevel);
  const [scored, setScored] = useState(totalGoalsScored);
  const [conceded, setConceded] = useState(totalGoalsConceded);
  const [bonusCount, setBonusCount] = useState(bonusMatchesAllowed);

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
    setEditingBonus(false);
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer définitivement ${playerName} ? Cette action est irréversible (score, matchs, tout sera perdu).`
      )
    ) {
      return;
    }
    setLoading(true);
    await fetch(`/api/admin/players/${playerId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  if (editingBonus) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-800/60 p-2 rounded-lg">
        <label className="text-xs text-gray-400">
          Matchs bonus accordés
          <input
            type="number"
            min={0}
            max={50}
            value={bonusCount}
            onChange={(e) => setBonusCount(Number(e.target.value))}
            className="w-16 ml-1 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          />
        </label>
        <button
          disabled={loading}
          onClick={() => act("set-bonus-matches", { bonusMatchesAllowed: bonusCount })}
          className="text-xs bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-600"
        >
          Enregistrer
        </button>
        <button
          disabled={loading}
          onClick={() => setEditingBonus(false)}
          className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600"
        >
          Annuler
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-800/60 p-2 rounded-lg">
        <label className="text-xs text-gray-400">
          Nom
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-28 ml-1 bg-gray-900 border border-gray-700 rounded px-1 py-0.5 text-xs text-white"
          />
        </label>
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
          onClick={async () => {
            if (name !== playerName) await act("rename", { name });
            await act("edit", {
              currentLevel: level,
              totalGoalsScored: scored,
              totalGoalsConceded: conceded,
            });
          }}
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
      <button
        disabled={loading}
        onClick={() => setEditingBonus(true)}
        className="text-xs bg-yellow-900/40 text-yellow-300 px-2 py-1 rounded hover:bg-yellow-900/70"
      >
        Matchs bonus
      </button>
      {canEditLevelScore && (
        <>
          <button
            disabled={loading}
            onClick={() => act("reset-progress")}
            className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
          >
            Réinitialiser
          </button>
          <button
            disabled={loading}
            onClick={handleDelete}
            className="text-xs bg-red-950 text-red-400 px-2 py-1 rounded hover:bg-red-900 border border-red-900"
          >
            Supprimer
          </button>
        </>
      )}
    </div>
  );
}
