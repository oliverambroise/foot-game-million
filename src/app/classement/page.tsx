"use client";

import { useEffect, useState } from "react";

type Row = {
  rank: number;
  name: string;
  differential: number;
  goalsScored: number;
  matchesPlayed: number;
  hasFinished: boolean;
};

type SelfRow = { rank: number; name: string; differential: number; goalsScored: number };

export default function ClassementPage() {
  const [top, setTop] = useState<Row[]>([]);
  const [self, setSelf] = useState<SelfRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setTop(data.top ?? []);
        setSelf(data.self ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const selfInTop = self && top.some((r) => r.rank === self.rank);

  return (
    <main className="min-h-screen bg-green-950 text-white px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6">🏆 Classement</h1>

      {loading ? (
        <p className="text-center text-green-200">Chargement...</p>
      ) : (
        <div className="max-w-md mx-auto space-y-1.5">
          {top.map((row) => (
            <div
              key={row.rank}
              className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-2.5 text-sm"
            >
              <span className="w-8 font-bold text-yellow-400">#{row.rank}</span>
              <span className="flex-1 truncate">{row.name}</span>
              <span className="font-mono">{row.differential > 0 ? `+${row.differential}` : row.differential}</span>
            </div>
          ))}

          {top.length === 0 && (
            <p className="text-center text-green-300 text-sm">
              Aucun match joué pour le moment.
            </p>
          )}

          {self && !selfInTop && (
            <>
              <div className="text-center text-green-400 text-xs py-2">⋯</div>
              <div className="flex items-center justify-between bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-4 py-2.5 text-sm">
                <span className="w-8 font-bold text-yellow-400">#{self.rank}</span>
                <span className="flex-1 truncate">{self.name} (vous)</span>
                <span className="font-mono">
                  {self.differential > 0 ? `+${self.differential}` : self.differential}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
