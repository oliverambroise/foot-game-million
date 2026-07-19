"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FootballGame from "@/components/game/FootballGame";
import GameHeaderBar from "@/components/GameHeaderBar";
import { authFetch } from "@/lib/client-fetch";

type Player = {
  id: string;
  name: string;
  currentLevel: number;
  hasFinished: boolean;
};

type Screen = "loading" | "pre-match" | "playing" | "post-match" | "error";

export default function JeuPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [matchDurationSec, setMatchDurationSec] = useState(120);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
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
      const settings = settingsRes.ok ? await settingsRes.json() : { matchDurationSec: 120 };

      if (cancelled) return;

      if (settings.maintenanceMode) {
        setErrorMsg("Le jeu est actuellement en maintenance. Revenez plus tard.");
        setScreen("error");
        return;
      }
      if (settings.closingAt && new Date() > new Date(settings.closingAt)) {
        setErrorMsg("Le parcours est terminé. Merci d'avoir joué !");
        setScreen("error");
        return;
      }

      setMatchDurationSec(settings.matchDurationSec ?? 120);
      setBannerMessage(settings.bannerMessage ?? null);
      setPlayer(me.player);

      if (me.player.hasFinished) {
        router.replace("/fin");
        return;
      }
      setScreen("pre-match");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleFinish(result: {
    goalsScored: number;
    goalsConceded: number;
    durationMs: number;
    shotsAttempted: number;
  }) {
    if (!player) return;
    setLastResult({ goalsScored: result.goalsScored, goalsConceded: result.goalsConceded });

    try {
      const res = await authFetch("/api/matches/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelNumber: player.currentLevel, ...result }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(
            "Votre session a expiré. Reconnectez-vous avec votre téléphone et votre code — votre progression est conservée."
          );
        } else {
          setErrorMsg(data.error || "Erreur lors de l'enregistrement du match.");
        }
        setScreen("error");
        return;
      }

      setPlayer((prev) => (prev ? { ...prev, ...data.player } : prev));
      setScreen("post-match");
    } catch {
      setErrorMsg("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setScreen("error");
    }
  }

  function continueToNextLevel() {
    if (player?.hasFinished) {
      router.push("/fin");
      return;
    }
    setScreen("pre-match");
  }

  if (screen === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-950 text-white">
        Chargement de votre partie...
      </main>
    );
  }

  if (screen === "error") {
    return (
      <main className="min-h-screen flex flex-col bg-green-950 text-white">
        <GameHeaderBar />
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="max-w-sm">{errorMsg}</p>
        </div>
      </main>
    );
  }

  if (!player) return null;

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-green-900 to-green-950">
      <GameHeaderBar />
      {bannerMessage && (
        <div className="bg-yellow-500 text-black text-sm font-medium text-center px-4 py-2">
          {bannerMessage}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {screen === "pre-match" && (
          <div className="text-center text-white space-y-4">
            <h1 className="text-2xl font-bold">Niveau {player.currentLevel} / 32</h1>
            <p className="text-green-200 text-sm max-w-xs mx-auto">
              Utilisez les flèches pour vous déplacer, Dribble pour accélérer avec le
              ballon, Passe pour l&apos;envoyer à un coéquipier, Tacle pour le récupérer, et
              Tir pour marquer. La flèche jaune indique votre meneur — changez-le à tout
              moment.
            </p>
            <button
              onClick={() => setScreen("playing")}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full"
            >
              C&apos;est parti !
            </button>
          </div>
        )}

        {screen === "playing" && (
          <FootballGame
            levelNumber={player.currentLevel}
            matchDurationSec={matchDurationSec}
            onFinish={handleFinish}
          />
        )}

        {screen === "post-match" && lastResult && (
          <div className="text-center text-white space-y-4">
            <h2 className="text-xl font-bold">Match terminé</h2>
            <p className="text-3xl font-mono">
              {lastResult.goalsScored} - {lastResult.goalsConceded}
            </p>
            <p className="text-green-200 text-sm">
              {lastResult.goalsScored > lastResult.goalsConceded
                ? "Victoire ! Direction le niveau suivant."
                : lastResult.goalsScored === lastResult.goalsConceded
                ? "Match nul. Direction le niveau suivant."
                : "Défaite, mais vous continuez le parcours quand même."}
            </p>
            <button
              onClick={continueToNextLevel}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full"
            >
              {player.hasFinished ? "Voir mon classement final" : "Niveau suivant"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
