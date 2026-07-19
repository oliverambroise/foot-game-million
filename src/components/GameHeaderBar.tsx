"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatRemaining(ms: number) {
  if (ms <= 0) return "Terminé";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export default function GameHeaderBar() {
  const [closingAt, setClosingAt] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/game-settings")
      .then((r) => r.json())
      .then((d) => setClosingAt(d.closingAt ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = closingAt && now !== null ? new Date(closingAt).getTime() - now : null;

  return (
    <div className="w-full flex items-center justify-between px-3 py-2 bg-black/30 text-white text-xs sm:text-sm">
      <Link href="/classement" className="underline hover:text-yellow-300">
        🏆 Classement
      </Link>
      {remaining !== null && (
        <span className="font-mono">
          ⏳ Fermeture dans {formatRemaining(remaining)}
        </span>
      )}
    </div>
  );
}
