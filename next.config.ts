import type { NextConfig } from "next";

const securityHeaders = [
  // Empêche l'app d'être embarquée dans une <iframe> tierce (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Empêche le navigateur de "deviner" un type MIME différent du déclaré
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limite les infos envoyées dans l'en-tête Referer vers d'autres sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive l'accès par défaut aux capteurs/caméra/micro/géoloc pour cette app
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
