"use client";

import { useEffect, useState } from "react";

type Level = { levelNumber: number; difficulty: string; isOverridden: boolean };

const LABELS: Record<string, string> = {
  EASY: "Facile",
  MEDIUM: "Moyen",
  HARD: "Difficile",
  VERY_HARD: "Très difficile",
};

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/levels")
      .then((r) => r.json())
      .then((d) => setLevels(d.levels ?? []));
  }, []);

  async function updateDifficulty(levelNumber: number, difficulty: string) {
    setSaving(levelNumber);
    await fetch("/api/admin/levels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levelNumber, difficulty }),
    });
    setLevels((prev) =>
      prev.map((l) => (l.levelNumber === levelNumber ? { ...l, difficulty, isOverridden: true } : l))
    );
    setSaving(null);
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Difficulté des niveaux</h1>
      <p className="text-sm text-gray-400 mb-4">
        Barème par défaut : niveaux 1-8 Facile, 9-16 Moyen, 17-24 Difficile,
        25-32 Très difficile. Modifiable individuellement ci-dessous.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {levels.map((l) => (
          <div
            key={l.levelNumber}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col gap-2"
          >
            <span className="text-sm font-semibold">
              Niveau {l.levelNumber} {l.isOverridden && <span className="text-yellow-400">●</span>}
            </span>
            <select
              value={l.difficulty}
              disabled={saving === l.levelNumber}
              onChange={(e) => updateDifficulty(l.levelNumber, e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            >
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
