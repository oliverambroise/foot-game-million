import { NextResponse } from "next/server";

const ACCESS_COOKIE = "fg_access";
const REFRESH_COOKIE = "fg_refresh";

const isProd = process.env.NODE_ENV === "production";

/**
 * Pose les cookies de session. httpOnly + Secure + SameSite=strict:
 * inaccessibles en JavaScript (protection XSS contre le vol de token) et
 * non envoyés lors de requêtes cross-site (protection CSRF de base).
 */
export function setSessionCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 15 * 60, // 15 minutes, doit rester cohérent avec JWT_ACCESS_EXPIRES_IN
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/auth/refresh", maxAge: 0 });
}

export function getAccessTokenCookieName() {
  return ACCESS_COOKIE;
}

export function getRefreshTokenCookieName() {
  return REFRESH_COOKIE;
}
