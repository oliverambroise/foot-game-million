"use client";

import { useEffect, useState, useCallback } from "react";

type Code = { id: string; code: string; isUsed: boolean; createdAt: string };

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [justGenerated, setJustGenerated] = useState<string[]>([]);

  const load = useCallback(() => {
    fetch("/api/admin/codes")
      .then((r) => r.json())
      .then((d) => setCodes(d.codes ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const data = await res.json();
    setJustGenerated(data.codes ?? []);
    setLoading(false);
    load();
  }

  function downloadCsv() {
    const csv = "code,utilise\n" + codes.map((c) => `${c.code},${c.isUsed ? "oui" : "non"}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codes-participation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const usedCount = codes.filter((c) => c.isUsed).length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Codes de participation</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre à générer</label>
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          {loading ? "Génération..." : "Générer"}
        </button>
        <button
          onClick={downloadCsv}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          Exporter en CSV
        </button>
        <span className="text-sm text-gray-400 ml-auto">
          {usedCount} / {codes.length} utilisés
        </span>
      </div>

      {justGenerated.length > 0 && (
        <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-green-300 mb-2">
            {justGenerated.length} nouveaux codes générés — à distribuer aux joueurs :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-xs text-green-200">
            {justGenerated.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-gray-900">
                <td className="py-1.5 pr-3 font-mono">{c.code}</td>
                <td className="py-1.5 pr-3">
                  {c.isUsed ? (
                    <span className="text-gray-500">Utilisé</span>
                  ) : (
                    <span className="text-green-400">Disponible</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
