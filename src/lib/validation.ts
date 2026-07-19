import { z } from "zod";

// Numéro haïtien: 8 chiffres, avec ou sans indicatif +509.
// On normalise ensuite au format +509XXXXXXXX.
const HAITI_PHONE_REGEX = /^(\+?509)?\s?[0-9]{8}$/;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(80, "Le nom est trop long")
    // Autorise lettres (avec accents), espaces, apostrophes, tirets
    .regex(/^[\p{L}\s'-]+$/u, "Le nom contient des caractères invalides"),
  phone: z
    .string()
    .trim()
    .regex(HAITI_PHONE_REGEX, "Numéro de téléphone invalide (format haïtien attendu)"),
  participationCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^FOOT-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Code de participation invalide"),
  acceptedTerms: z
    .boolean()
    .refine((v) => v === true, { message: "Vous devez accepter les règlements pour continuer" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Normalise un numéro saisi vers le format +509XXXXXXXX */
export function normalizePhone(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  const last8 = digitsOnly.slice(-8);
  return `+509${last8}`;
}
