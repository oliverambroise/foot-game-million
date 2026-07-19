"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GameHeaderBar from "@/components/GameHeaderBar";

type Me = {
  id: string;
  name: string;
  currentLevel: number;
  hasFinished: boolean;
  bonusMatchesAllowed: number;
  bonusMatchesPlayed: number;
};

type LeaderboardSelf = {
  rank: number;
  name: string;
  differential: number;
  goalsScored: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FinPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [self, setSelf] = useState<LeaderboardSelf | null>(null);
  const [closingAt, setClosingAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/leaderboard").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/game-settings").then((r) => (r.ok ? r.json() : null)),
    ]).then(([meData, lb, settings]) => {
      if (meData?.player) setMe(meData.player);
      if (lb?.self) setSelf(lb.self);
      if (settings?.closingAt) setClosingAt(settings.closingAt);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-950 text-white">
        Chargement...
      </main>
    );
  }

  const bonusAvailable = (me?.bonusMatchesAllowed ?? 0) > (me?.bonusMatchesPlayed ?? 0);

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-green-900 to-green-950 text-white">
      <GameHeaderBar />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
        <h1 className="text-3xl font-bold mb-2">🏁 Vous avez terminé !</h1>
        <p className="text-green-200 mb-2">
          Merci d&apos;avoir joué les 32 matchs, {me?.name}.
        </p>
        {closingAt && (
          <p className="text-green-300 text-xs mb-6">
            Les résultats définitifs seront publiés le {formatDate(closingAt)}.
          </p>
        )}

        {self && (
          <div className="bg-white/10 rounded-2xl px-8 py-6 mb-8 space-y-2">
            <p className="text-sm text-green-200">Votre différentiel</p>
            <p className="text-4xl font-mono font-bold">{self.differential}</p>
            <p className="text-sm text-green-200">
              Buts marqués: {self.goalsScored} · Classement:{" "}
              <span className="font-semibold">#{self.rank}</span>
            </p>
          </div>
        )}

        {bonusAvailable && (
          <Link
            href="/bonus"
            className="block w-full max-w-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full mb-3"
          >
            ⭐ Jouer mes matchs bonus ({(me?.bonusMatchesAllowed ?? 0) - (me?.bonusMatchesPlayed ?? 0)} restants)
          </Link>
        )}
      </div>
    </main>
  );
}
