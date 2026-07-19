"use client";

/**
 * Fait un fetch authentifié. Si la réponse est 401 (session expirée), tente
 * un rafraîchissement silencieux du token puis rejoue la requête une fois.
 * Évite qu'un match en cours se termine sur une erreur "non authentifié"
 * simplement parce que le joueur a pris plus de temps que prévu entre deux
 * écrans.
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
  if (!refreshRes.ok) return res; // vraiment déconnecté, on laisse l'appelant gérer

  return fetch(input, init);
}
