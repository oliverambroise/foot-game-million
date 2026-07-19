import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  // Échoue tôt et bruyamment plutôt que de signer des tokens avec un secret
  // undefined (ce qui serait une faille de sécurité silencieuse).
  throw new Error(
    "JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être définis dans .env"
  );
}

export type PlayerTokenPayload = {
  sub: string; // player id
  type: "player";
};

export type AdminTokenPayload = {
  sub: string; // admin id
  type: "admin";
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER";
};

// --- Mots de passe -----------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  const SALT_ROUNDS = 12;
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// --- Tokens joueur -------------------------------------------------------

export function signPlayerAccessToken(playerId: string): string {
  const payload: PlayerTokenPayload = { sub: playerId, type: "player" };
  return jwt.sign(payload, ACCESS_SECRET!, { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions);
}

export function signPlayerRefreshToken(playerId: string): string {
  const payload: PlayerTokenPayload = { sub: playerId, type: "player" };
  return jwt.sign(payload, REFRESH_SECRET!, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyPlayerAccessToken(token: string): PlayerTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET!) as PlayerTokenPayload;
  if (decoded.type !== "player") throw new Error("Type de token invalide");
  return decoded;
}

export function verifyPlayerRefreshToken(token: string): PlayerTokenPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET!) as PlayerTokenPayload;
  if (decoded.type !== "player") throw new Error("Type de token invalide");
  return decoded;
}

// --- Tokens admin (base posée ici, complété en Phase 7 avec la 2FA) -----

export function signAdminAccessToken(
  adminId: string,
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER"
): string {
  const payload: AdminTokenPayload = { sub: adminId, type: "admin", role };
  return jwt.sign(payload, ACCESS_SECRET!, { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAdminAccessToken(token: string): AdminTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET!) as AdminTokenPayload;
  if (decoded.type !== "admin") throw new Error("Type de token invalide");
  return decoded;
}

// --- Codes de participation ----------------------------------------------

/**
 * Génère un code de participation lisible et difficile à deviner.
 * Format: FOOT-XXXX-XXXX (caractères alphanumériques majuscules, sans
 * caractères ambigus comme 0/O ou 1/I).
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateParticipationCode(): string {
  const randomBlock = () => {
    let block = "";
    for (let i = 0; i < 4; i++) {
      block += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
    }
    return block;
  };
  return `FOOT-${randomBlock()}-${randomBlock()}`;
}
