/**
 * Rate limiter en mémoire, simple fenêtre glissante par clé (ex: IP+route).
 *
 * LIMITATION CONNUE: ceci vit dans la mémoire du process Next.js. Sur un
 * déploiement multi-instance (plusieurs conteneurs/serveurs), chaque
 * instance a son propre compteur. C'est suffisant pour la Phase 1 et le
 * développement, mais DOIT être remplacé par un rate limit basé sur Redis
 * (prévu dans l'architecture globale) avant la mise en production réelle,
 * sans quoi la protection anti brute-force est contournable en répartissant
 * les requêtes entre instances.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Nettoyage périodique pour éviter une fuite mémoire sur les buckets expirés. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/** Extrait une IP client depuis les en-têtes de la requête (proxy-aware). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
