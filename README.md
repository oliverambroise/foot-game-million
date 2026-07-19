# Défi Football — Application complète (v1)

Application web (PWA) : inscription, mini-jeu de football jouable (32
niveaux, difficulté croissante), classement, et panneau d'administration.

## ⚠️ Avant de lancer : générer la base de données

Le code a été écrit et vérifié (`tsc`, `eslint`, `next build` jusqu'au
bundling) mais je n'ai pas pu exécuter `prisma generate` dans mon
environnement de travail (accès réseau restreint vers les serveurs de
Prisma). Sur ta machine, avec un accès internet normal, ça fonctionne
directement — voir "Installation" ci-dessous.

## Installation (sur ta machine, pour tester avant de mettre en ligne)

Il te faut [Node.js](https://nodejs.org) installé (version 20 ou plus).

```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Le seed affiche dans le terminal :
- ton compte admin (`oliveramb8@gmail.com`) — mot de passe par défaut
  `Football2026!` (modifiable directement dans `prisma/seed.ts` avant de
  lancer le seed, ou depuis Mon compte une fois connecté à l'admin)
- 20 codes de participation de test

Ouvre `http://localhost:3000` → redirigé vers `/inscription`. Utilise un
code généré pour créer un joueur de test. Un lien discret "Administration"
est visible en bas de la page d'inscription, ou va directement sur
`http://localhost:3000/admin/login`.

## Ce qui est inclus dans cette version

- **Inscription / reconnexion** joueur (nom, téléphone, code de
  participation), sessions sécurisées (JWT, cookies httpOnly).
- **Mini-jeu jouable** : déplacement, dribble, tacle, tir, meneur (flèche
  jaune) avec bouton pour changer de meneur. 2 minutes par match.
- **32 niveaux** joués dans l'ordre imposé, difficulté croissante
  (1-8 facile, 9-16 moyen, 17-24 difficile, 25-32 très difficile),
  réglable niveau par niveau depuis l'admin.
- **Score et classement** (différentiel de buts, règles de départage
  complètes), Top N configurable, position du joueur toujours visible.
- **Panneau admin** : tableau de bord, gestion des joueurs (bloquer /
  débloquer / réinitialiser), génération et export de codes, réglage de la
  difficulté par niveau, paramètres globaux (durée du match, date de
  fermeture, mode maintenance, taille du Top classement).
- **PWA installable** (manifest + icônes + service worker basique).
- **Sécurité de base** : le score n'est jamais décidé par le téléphone du
  joueur — le serveur vérifie la durée du match et la cohérence du score
  avant de l'enregistrer ; mots de passe et tokens hachés ; limitation du
  nombre de tentatives (anti brute-force) ; en-têtes de sécurité HTTP.

## Ce qui n'est PAS encore inclus

Ces modules demandent des comptes/identifiants que seul toi peux fournir
(marchand MonCash/NatCash, service d'envoi d'email, etc.) :

- Paiement réel pour "Rejouer" (le bouton existe, le paiement est à
  brancher)
- Bonus de puissance achetables
- Défis, publicités, messages depuis l'admin
- Authentification à deux facteurs (2FA) par email pour l'admin
- Exports Excel/PDF (le CSV des codes est disponible)
- Sauvegardes automatiques, journal d'audit affiché dans l'interface

On pourra les ajouter une fois l'app en ligne et testée.

## Variables d'environnement (`.env`)

Déjà configuré pour un test en local (SQLite). **Avant la mise en ligne**,
change `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` par des valeurs longues
et aléatoires (voir guide de déploiement fourni séparément).
