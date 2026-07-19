import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const prisma = new PrismaClient();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  const block = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
  return `FOOT-${block()}-${block()}`;
}

async function main() {
  // --- Premier administrateur ---
  const adminEmail = "oliveramb8@gmail.com";

  // Mot de passe par défaut — MODIFIE CETTE LIGNE avant de déployer si tu
  // veux ton propre mot de passe (change juste le texte entre guillemets).
  // Change-le aussi APRÈS ta première connexion, une fois la fonction
  // "changer le mot de passe" disponible (Phase 7).
  const DEFAULT_ADMIN_PASSWORD = "Football2026!";

  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });

    console.log("\n=== ADMINISTRATEUR CRÉÉ ===");
    console.log(`Email: ${adminEmail}`);
    console.log(`Mot de passe: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log("⚠️  Pense à le changer une fois en ligne.\n");
  } else {
    console.log(`Admin ${adminEmail} existe déjà, on ne le recrée pas.`);
  }

  // --- Lot de codes de participation pour tester l'inscription ---
  const codesToCreate = 20;
  const codes: string[] = [];
  for (let i = 0; i < codesToCreate; i++) {
    codes.push(generateCode());
  }

  await prisma.participationCode.createMany({
    data: codes.map((code) => ({ code })),
    skipDuplicates: true,
  });

  console.log(`=== ${codesToCreate} CODES DE PARTICIPATION CRÉÉS ===`);
  codes.forEach((c) => console.log(c));
  console.log("");

  // --- Paramètres de jeu par défaut ---
  await prisma.gameSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  console.log("Paramètres de jeu initialisés (valeurs par défaut).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
