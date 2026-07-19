"use client";

import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [topN, setTopN] = useState(20);
  const [closingAt, setClosingAt] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [duration, setDuration] = useState(120);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bonusRoundMessage, setBonusRoundMessage] = useState("");
  const [bonusCtaUrl, setBonusCtaUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings;
        setTopN(s.leaderboardTopN);
        setClosingAt(s.closingAt ? new Date(s.closingAt).toISOString().slice(0, 16) : "");
        setMaintenance(s.maintenanceMode);
        setDuration(s.matchDurationSec);
        setBannerMessage(s.bannerMessage ?? "");
        setBonusRoundMessage(s.bonusRoundMessage ?? "");
        setBonusCtaUrl(s.bonusCtaUrl ?? "");
        setTermsUrl(s.termsUrl ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaderboardTopN: topN,
        closingAt: closingAt ? new Date(closingAt).toISOString() : null,
        maintenanceMode: maintenance,
        matchDurationSec: duration,
        bannerMessage: bannerMessage.trim() || null,
        bonusRoundMessage: bonusRoundMessage.trim() || null,
        bonusCtaUrl: bonusCtaUrl.trim() || null,
        termsUrl: termsUrl.trim() || null,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <p className="text-gray-400 text-sm">Chargement...</p>;

  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-xl font-bold">Paramètres du jeu</h1>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Nombre de joueurs affichés dans le classement (Top N)
        </label>
        <input
          type="number"
          min={1}
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Durée d&apos;un match (secondes)</label>
        <input
          type="number"
          min={10}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Date/heure de fermeture du jeu</label>
        <input
          type="datetime-local"
          value={closingAt}
          onChange={(e) => setClosingAt(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Laisser vide pour ne pas fermer automatiquement.</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={maintenance}
          onChange={(e) => setMaintenance(e.target.checked)}
        />
        Mode maintenance (bloque l&apos;accès aux joueurs, les données restent conservées)
      </label>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Message au-dessus de l&apos;aire de jeu
        </label>
        <textarea
          value={bannerMessage}
          onChange={(e) => setBannerMessage(e.target.value)}
          maxLength={300}
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          placeholder="Ex: Tournoi spécial ce week-end !"
        />
        <p className="text-xs text-gray-500 mt-1">Laisser vide pour ne rien afficher.</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Message des matchs bonus (conditions d&apos;accès)
        </label>
        <textarea
          value={bonusRoundMessage}
          onChange={(e) => setBonusRoundMessage(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          placeholder="Ex: Ces 4 matchs bonus sont offerts aux joueurs ayant partagé le jeu sur les réseaux."
        />
        <p className="text-xs text-gray-500 mt-1">
          Affiché aux joueurs qui ont accès aux 4 matchs bonus (activable individuellement
          depuis la page Joueurs).
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Lien du bouton &laquo;&nbsp;Cliquez pour gagner des matchs bonus&nbsp;&raquo;
        </label>
        <input
          type="text"
          value={bonusCtaUrl}
          onChange={(e) => setBonusCtaUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Affiché sous le message des matchs bonus. Laisser vide pour ne pas afficher de bouton.
        </p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Lien vers les règlements / politiques
        </label>
        <input
          type="text"
          value={termsUrl}
          onChange={(e) => setTermsUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Affiché comme lien lors de l&apos;acceptation obligatoire à l&apos;inscription.
        </p>
      </div>

      <button
        onClick={save}
        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
      >
        Enregistrer
      </button>
      {saved && <span className="text-green-400 text-sm ml-3">Enregistré ✓</span>}
    </div>
  );
}
