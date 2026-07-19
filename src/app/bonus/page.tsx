"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FootballGame from "@/components/game/FootballGame";
import GameHeaderBar from "@/components/GameHeaderBar";
import { authFetch } from "@/lib/client-fetch";

type Player = {
  bonusRoundUnlocked: boolean;
  bonusMatchesPlayed: number;
  hasFinished: boolean;
};

type Screen = "loading" | "intro" | "playing" | "post-match" | "done" | "error";

export default function BonusPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [matchDurationSec, setMatchDurationSec] = useState(120);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);
  const [bonusCtaUrl, setBonusCtaUrl] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ goalsScored: number; goalsConceded: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [meRes, settingsRes] = await Promise.all([
        authFetch("/api/auth/me"),
        fetch("/api/game-settings"),
      ]);
      if (cancelled) return;

      if (!meRes.ok) {
        router.replace("/inscription");
        return;
      }
      const me = await meRes.json();
      const settings = settingsRes.ok ? await settingsRes.json() : {};
      if (cancelled) return;

      if (!me.player.hasFinished || !me.player.bonusRoundUnlocked || me.player.bonusMatchesPlayed >= 4) {
        router.replace("/fin");
        return;
      }

      setMatchDurationSec(settings.matchDurationSec ?? 120);
      setBonusMessage(settings.bonusRoundMessage ?? null);
      setBonusCtaUrl(settings.bonusCtaUrl ?? null);
      setPlayer(me.player);
      setScreen("intro");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleFinish(result: { goalsScored: number; goalsConceded: number; durationMs: number }) {
    setLastResult({ goalsScored: result.goalsScored, goalsConceded: result.goalsConceded });
    try {
      const res = await authFetch("/api/matches/bonus-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Erreur lors de l'enregistrement du match bonus.");
        setScreen("error");
        return;
      }
      setPlayer((prev) => (prev ? { ...prev, bonusMatchesPlayed: data.player.bonusMatchesPlayed } : prev));
      setScreen(data.player.bonusMatchesPlayed >= 4 ? "done" : "post-match");
    } catch {
      setErrorMsg("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setScreen("error");
    }
  }

  if (screen === "loading" || !player) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-950 text-white">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-green-900 to-green-950">
      <GameHeaderBar />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center text-white">
        {screen === "intro" && (
          <div className="space-y-4 max-w-sm">
            <h1 className="text-2xl font-bold">⭐ Matchs bonus</h1>
            {bonusMessage && (
              <p className="text-green-200 text-sm bg-white/10 rounded-xl px-4 py-3">
                {bonusMessage}
              </p>
            )}
            {bonusCtaUrl && (
              <a
                href={bonusCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-full text-sm"
              >
                👉 Cliquez pour gagner des matchs bonus
              </a>
            )}
            <p className="text-green-200 text-sm">
              Match bonus {player.bonusMatchesPlayed + 1} / 4 — niveau facile, pour
              améliorer votre score.
            </p>
            <button
              onClick={() => setScreen("playing")}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full"
            >
              Jouer
            </button>
          </div>
        )}

        {screen === "playing" && (
          <FootballGame
            levelNumber={33 + player.bonusMatchesPlayed}
            matchDurationSec={matchDurationSec}
            onFinish={handleFinish}
          />
        )}

        {screen === "post-match" && lastResult && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Match bonus terminé</h2>
            <p className="text-3xl font-mono">
              {lastResult.goalsScored} - {lastResult.goalsConceded}
            </p>
            <button
              onClick={() => setScreen("intro")}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full"
            >
              Match bonus suivant
            </button>
          </div>
        )}

        {screen === "done" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">🎉 4 matchs bonus terminés !</h2>
            <p className="text-green-200 text-sm">Votre score final a été mis à jour.</p>
            <button
              onClick={() => router.push("/fin")}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full"
            >
              Voir mon classement
            </button>
          </div>
        )}

        {screen === "error" && <p className="max-w-sm">{errorMsg}</p>}
      </div>
    </main>
  );
}
