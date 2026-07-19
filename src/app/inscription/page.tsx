"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GameHeaderBar from "@/components/GameHeaderBar";

type FormMode = "register" | "login";

export default function InscriptionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>("register");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsUrl, setTermsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/game-settings")
      .then((r) => r.json())
      .then((d) => setTermsUrl(d.termsUrl ?? null))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { name, phone, participationCode: code, acceptedTerms }
          : { participationCode: code };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      router.push("/jeu");
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-green-900 to-green-950">
      <GameHeaderBar />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-sm bg-white/95 rounded-2xl shadow-xl p-6 [color-scheme:light]"
        style={{ colorScheme: "light" }}
      >
        <h1 className="text-2xl font-bold text-green-900 text-center mb-1">
          ⚽ Défi Football
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          32 matchs. Un seul classement. À vous de jouer.
        </p>

        <div className="flex mb-6 rounded-lg overflow-hidden border border-green-800/20">
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === "register"
                ? "bg-green-800 text-white"
                : "bg-white text-green-900"
            }`}
          >
            Nouveau joueur
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-green-800 text-white"
                : "bg-white text-green-900"
            }`}
          >
            J&apos;ai déjà un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Ex: Jean Baptiste"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 3712 3456"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-green-700"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code de participation
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FOOT-XXXX-XXXX"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-wide text-gray-900 bg-white placeholder:text-gray-400 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          {mode === "register" && (
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                J&apos;accepte{" "}
                {termsUrl ? (
                  <a
                    href={termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-green-800"
                  >
                    les règlements et politiques
                  </a>
                ) : (
                  "les règlements et politiques"
                )}{" "}
                du jeu.
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-800 hover:bg-green-900 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition"
          >
            {loading
              ? "Veuillez patienter..."
              : mode === "register"
              ? "Commencer à jouer"
              : "Reprendre ma partie"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-5">
          {mode === "register"
            ? "Un code de participation vous a été remis par l'organisateur."
            : "Entrez simplement votre code — inutile de ressaisir votre téléphone."}
        </p>
      </div>

      <Link
        href="/admin/login"
        className="mt-6 text-xs text-green-300/60 hover:text-green-200 underline"
      >
        Administration
      </Link>
      </div>
    </main>
  );
}
