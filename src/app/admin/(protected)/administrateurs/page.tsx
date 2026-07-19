"use client";

import { useEffect, useState, useCallback } from "react";

type AdminRow = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER";
  isActive: boolean;
  createdAt: string;
};

export default function AdminAdministrateursPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MANAGER">("MANAGER");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<{ email: string; tempPassword: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/admins")
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setAdmins(d.admins ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "Erreur lors de la création");
      return;
    }
    setNewAccount({ email: data.admin.email, tempPassword: data.tempPassword });
    setEmail("");
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isActive ? "deactivate" : "activate" }),
    });
    load();
  }

  if (loading) return <p className="text-gray-400 text-sm">Chargement...</p>;

  if (forbidden) {
    return (
      <p className="text-gray-400 text-sm">
        Cette page est réservée au super-administrateur.
      </p>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super-admin",
    ADMIN: "Admin",
    MANAGER: "Gestionnaire",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-2">Administrateurs</h1>
      <p className="text-sm text-gray-400 mb-4">
        Un <strong>gestionnaire</strong> peut bloquer/débloquer les joueurs,
        gérer les codes de participation et activer/désactiver l&apos;accès
        aux matchs bonus — mais ne peut jamais modifier le niveau ou le
        score d&apos;un joueur. Un <strong>admin</strong> a accès à tout,
        sauf la gestion des autres comptes admin.
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-64"
            placeholder="nouveau@exemple.com"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Rôle</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "MANAGER")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="MANAGER">Gestionnaire</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !email}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          {creating ? "Création..." : "Créer le compte"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {newAccount && (
        <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 mb-6 text-sm">
          <p className="text-green-300 mb-1">Compte créé pour {newAccount.email}</p>
          <p className="text-green-200">
            Mot de passe temporaire :{" "}
            <span className="font-mono font-bold">{newAccount.tempPassword}</span>
          </p>
          <p className="text-green-400 text-xs mt-1">
            Transmets-le à la personne concernée — il ne sera plus affiché ensuite.
          </p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="py-2 pr-3">Email</th>
            <th className="py-2 pr-3">Rôle</th>
            <th className="py-2 pr-3">Statut</th>
            <th className="py-2 pr-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id} className="border-b border-gray-900">
              <td className="py-2 pr-3">{a.email}</td>
              <td className="py-2 pr-3">{ROLE_LABELS[a.role]}</td>
              <td className="py-2 pr-3">
                {a.isActive ? (
                  <span className="text-green-400">Actif</span>
                ) : (
                  <span className="text-red-400">Désactivé</span>
                )}
              </td>
              <td className="py-2 pr-3">
                {a.role !== "SUPER_ADMIN" && (
                  <button
                    onClick={() => toggleActive(a.id, a.isActive)}
                    className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
                  >
                    {a.isActive ? "Désactiver" : "Réactiver"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
