// Moteur de simulation du match — logique pure, sans DOM/Canvas, pour
// pouvoir être testée avec Node et utilisée telle quelle par le composant
// React de rendu (src/components/game/FootballGame.tsx).

export const FIELD_W = 100;
export const FIELD_H = 60;
export const GOAL_WIDTH = 18; // centré sur l'axe Y
export const GOAL_DEPTH = 3;
export const TEAM_SIZE = 5;

export type Direction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right"
  | null;

export type DifficultyLevel = 1 | 2 | 3 | 4; // 1=facile ... 4=très difficile

export type Vec = { x: number; y: number };

export type Entity = {
  id: string;
  team: "home" | "away";
  x: number;
  y: number;
  vx: number;
  vy: number;
  isLeader: boolean; // "meneur"
};

export type BallState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string | null;
  shotInFlight: boolean; // true seulement quand le ballon vole après un vrai tir (jamais après une passe)
  cooldownPlayerId: string | null; // joueur qui vient de tirer/passer: ne peut pas le reprendre tout de suite
  cooldownFrames: number;
  saveRolled: boolean; // empêche de retirer au sort l'arrêt du gardien plusieurs fois pour le même tir
};

export type MatchInput = {
  direction: Direction;
  dribble: boolean;
  tackle: boolean;
  shoot: boolean;
  pass: boolean;
  switchLeader: boolean;
};

export type MatchState = {
  home: Entity[];
  away: Entity[];
  ball: BallState;
  clockMs: number; // temps restant
  goalsHome: number;
  goalsAway: number;
  shotsAttempted: number;
  finished: boolean;
  lastGoalAt: number | null;
  rngSeed: number;
  awayHoldFrames: number; // images consécutives où l'adversaire garde le ballon (anti temps mort)
};

const DIFFICULTY_PARAMS: Record<
  DifficultyLevel,
  {
    aiSpeed: number;
    aiReaction: number;
    tackleSuccess: number;
    aiShotAccuracy: number;
    keeperSaveChance: number;
  }
> = {
  1: { aiSpeed: 0.4, aiReaction: 0.35, tackleSuccess: 0.1, aiShotAccuracy: 0.06, keeperSaveChance: 0.02 },
  2: { aiSpeed: 0.55, aiReaction: 0.5, tackleSuccess: 0.28, aiShotAccuracy: 0.22, keeperSaveChance: 0.1 },
  3: { aiSpeed: 0.91, aiReaction: 0.88, tackleSuccess: 0.62, aiShotAccuracy: 0.68, keeperSaveChance: 0.42 },
  4: { aiSpeed: 0.9, aiReaction: 0.88, tackleSuccess: 0.74, aiShotAccuracy: 0.8, keeperSaveChance: 0.56 },
};

export function difficultyFromLevel(levelNumber: number): DifficultyLevel {
  if (levelNumber > 32) return 1; // parcours bonus: toujours facile
  if (levelNumber <= 8) return 1;
  if (levelNumber <= 16) return 2;
  if (levelNumber <= 24) return 3;
  return 4;
}

/** Convertit la difficulté stockée en base (texte) vers le niveau 1-4 du moteur. */
export function difficultyLevelFromLabel(
  label: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD"
): DifficultyLevel {
  switch (label) {
    case "EASY":
      return 1;
    case "MEDIUM":
      return 2;
    case "HARD":
      return 3;
    case "VERY_HARD":
      return 4;
  }
}

// Petit générateur pseudo-aléatoire déterministe (mulberry32) pour que la
// simulation reste reproductible/testable si besoin d'un seed fixe.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createInitialMatchState(
  matchDurationSec: number,
  seed = Date.now()
): MatchState {
  const home: Entity[] = [];
  const away: Entity[] = [];

  const homeXs = [15, 30, 30, 45, 45];
  const homeYs = [30, 15, 45, 20, 40];
  for (let i = 0; i < TEAM_SIZE; i++) {
    home.push({
      id: `home-${i}`,
      team: "home",
      x: homeXs[i],
      y: homeYs[i],
      vx: 0,
      vy: 0,
      isLeader: i === 0,
    });
  }

  const awayXs = [85, 70, 70, 55, 55];
  const awayYs = [30, 15, 45, 20, 40];
  for (let i = 0; i < TEAM_SIZE; i++) {
    away.push({
      id: `away-${i}`,
      team: "away",
      x: awayXs[i],
      y: awayYs[i],
      vx: 0,
      vy: 0,
      isLeader: false,
    });
  }

  return {
    home,
    away,
    ball: { x: FIELD_W / 2, y: FIELD_H / 2, vx: 0, vy: 0, ownerId: null, shotInFlight: false, cooldownPlayerId: null, cooldownFrames: 0, saveRolled: false },
    clockMs: matchDurationSec * 1000,
    goalsHome: 0,
    goalsAway: 0,
    shotsAttempted: 0,
    finished: false,
    lastGoalAt: null,
    rngSeed: seed,
    awayHoldFrames: 0,
  };
}

function dirToVec(dir: Direction): Vec {
  switch (dir) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up-left":
      return { x: -0.7071, y: -0.7071 };
    case "up-right":
      return { x: 0.7071, y: -0.7071 };
    case "down-left":
      return { x: -0.7071, y: 0.7071 };
    case "down-right":
      return { x: 0.7071, y: 0.7071 };
    default:
      return { x: 0, y: 0 };
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampToField(e: { x: number; y: number }) {
  e.x = Math.max(2, Math.min(FIELD_W - 2, e.x));
  e.y = Math.max(2, Math.min(FIELD_H - 2, e.y));
}

const PLAYER_BASE_SPEED = 0.75;
const DRIBBLE_SPEED_MULT = 1.15;
const CONTROL_RADIUS = 4.2;
const LEADER_CONTROL_RADIUS = 7; // le meneur (contrôlé par le joueur) récupère plus facilement un ballon libre
const TACKLE_RADIUS = 4.5;

/**
 * Choisit le coéquipier le plus "stratégiquement placé" pour recevoir une
 * passe automatique: privilégie celui qui est avancé vers le but adverse et
 * loin de tout adversaire, en restant à une distance de passe raisonnable.
 */
function pickStrategicTeammate(from: Entity, teammates: Entity[], away: Entity[]): Entity {
  let best = teammates[0];
  let bestScore = -Infinity;
  for (const t of teammates) {
    const distFromLeader = dist(t, from);
    if (distFromLeader > 45) continue; // trop loin pour une passe fiable
    let nearestOpp = Infinity;
    for (const a of away) {
      const d = dist(a, t);
      if (d < nearestOpp) nearestOpp = d;
    }
    const score = t.x + nearestOpp * 0.4 - distFromLeader * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/**
 * Avance la simulation d'un pas de temps `dtMs`, en fonction des entrées du
 * joueur humain (équipe "home") et de la difficulté (pilote l'IA).
 * Fonction pure: ne modifie pas `state`, retourne un nouvel état.
 */
export function stepMatch(
  state: MatchState,
  input: MatchInput,
  dtMs: number,
  difficulty: DifficultyLevel
): MatchState {
  if (state.finished) return state;

  const rand = mulberry32(state.rngSeed + Math.floor(state.clockMs));
  const dt = dtMs / 16.67; // normalisation ~60fps
  const params = DIFFICULTY_PARAMS[difficulty];

  const home = state.home.map((p) => ({ ...p }));
  const away = state.away.map((p) => ({ ...p }));
  const ball = { ...state.ball };

  const originalLeader = home.find((p) => p.isLeader)!;

  // Anti temps-mort: compte les images consécutives où l'adversaire garde
  // le ballon sans avancer ni tirer (calculé sur l'état précédent).
  const awayWasHolding = state.ball.ownerId?.startsWith("away") ?? false;
  const awayHoldFrames = awayWasHolding ? state.awayHoldFrames + 1 : 0;

  // --- Changement de meneur ---
  // Si le meneur actuel a le ballon: on ne bascule pas juste le contrôle,
  // on effectue une PASSE AUTOMATIQUE vers le coéquipier le mieux placé
  // (le plus avancé, le moins marqué), qui devient le nouveau meneur.
  if (input.switchLeader && ball.ownerId === originalLeader.id) {
    const teammates = home.filter((p) => p.id !== originalLeader.id);
    const target = pickStrategicTeammate(originalLeader, teammates, away);
    const dx = target.x - ball.x;
    const dy = target.y - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const PASS_POWER = 1.7;
    ball.vx = (dx / d) * PASS_POWER;
    ball.vy = (dy / d) * PASS_POWER;
    ball.ownerId = null;
    ball.shotInFlight = false;
    ball.cooldownPlayerId = originalLeader.id;
    ball.cooldownFrames = 18;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    home.forEach((p) => (p.isLeader = p.id === target.id));
    return finalizeStep({ ...state, home, away, ball, awayHoldFrames }, dtMs, params.keeperSaveChance);
  }

  // Sinon (le meneur n'a pas le ballon): bascule simple vers le coéquipier
  // le plus proche du ballon.
  if (input.switchLeader) {
    const candidates = home.filter((p) => p.id !== originalLeader.id);
    let closest = candidates[0];
    let bestDist = dist(closest, ball);
    for (const c of candidates) {
      const d = dist(c, ball);
      if (d < bestDist) {
        bestDist = d;
        closest = c;
      }
    }
    home.forEach((p) => (p.isLeader = p.id === closest.id));
  }

  const activeLeader = home.find((p) => p.isLeader)!;

  // --- Déplacement du meneur (contrôlé par le joueur) ---
  const dirVec = dirToVec(input.direction);
  const hasBall = ball.ownerId === activeLeader.id;
  const speed = PLAYER_BASE_SPEED * (hasBall && input.dribble ? DRIBBLE_SPEED_MULT : 1);
  activeLeader.vx = dirVec.x * speed;
  activeLeader.vy = dirVec.y * speed;
  activeLeader.x += activeLeader.vx * dt;
  activeLeader.y += activeLeader.vy * dt;
  clampToField(activeLeader);

  // --- Coéquipiers (IA de soutien simple: se placent en formation autour
  //     de la position du meneur, légèrement orientés vers le but adverse) ---
  const supportSpots = [
    { dx: -12, dy: -10 },
    { dx: -12, dy: 10 },
    { dx: 10, dy: -14 },
    { dx: 10, dy: 14 },
  ];
  let spotIdx = 0;
  for (const p of home) {
    if (p.isLeader) continue;
    const spot = supportSpots[spotIdx % supportSpots.length];
    spotIdx++;
    const targetX = activeLeader.x + spot.dx;
    const targetY = activeLeader.y + spot.dy;
    const toTarget = { x: targetX - p.x, y: targetY - p.y };
    const d = Math.hypot(toTarget.x, toTarget.y) || 1;
    const moveSpeed = PLAYER_BASE_SPEED * 0.55;
    p.vx = (toTarget.x / d) * moveSpeed;
    p.vy = (toTarget.y / d) * moveSpeed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampToField(p);
  }

  // --- IA adverse ---
  // away[0] est le gardien: il reste toujours près de sa propre cage (x proche
  // de FIELD_W) et suit le ballon latéralement. Les 4 autres défendent en
  // ligne resserrée devant leur but, et les DEUX plus proches du porteur
  // pressent activement dès que "home" a le ballon — un seul défenseur ne
  // suffisait pas à empêcher de foncer tout droit sans opposition.
  const ballCarrierIsHome = ball.ownerId?.startsWith("home");

  // Détermine les deux défenseurs (hors gardien) les plus proches du ballon,
  // pour qu'ils soient ceux qui pressent ce tour-ci.
  const outfieldAway = away.slice(1);
  const pressOrder = [...outfieldAway].sort((a, b) => dist(a, ball) - dist(b, ball));
  const pressingIds = new Set(pressOrder.slice(0, 2).map((p) => p.id));

  for (let i = 0; i < away.length; i++) {
    const p = away[i];
    let targetX: number, targetY: number;
    const isGoalkeeper = i === 0;

    if (isGoalkeeper) {
      // Le gardien colle sa ligne, ajuste juste sa position verticale selon
      // le ballon, et sort un peu si le porteur adverse est tout proche.
      const closeToGoal = ballCarrierIsHome && ball.x > FIELD_W - 18;
      targetX = closeToGoal ? FIELD_W - 10 : FIELD_W - 6;
      targetY = Math.max(
        FIELD_H / 2 - GOAL_WIDTH / 2 + 2,
        Math.min(FIELD_H / 2 + GOAL_WIDTH / 2 - 2, ball.y)
      );
    } else if (ballCarrierIsHome && pressingIds.has(p.id)) {
      // Pressing actif à deux sur le porteur du ballon
      targetX = ball.x;
      targetY = ball.y;
    } else if (!ballCarrierIsHome && ball.ownerId?.startsWith("away")) {
      // L'équipe adverse attaque vers le but de "home" (x=0)
      const carrier = away.find((a) => a.id === ball.ownerId)!;
      if (p.id === carrier.id) {
        targetX = Math.max(6, ball.x - 20);
        targetY = FIELD_H / 2 + (i - 2) * 6;
      } else {
        targetX = carrier.x + 10 + i * 3;
        targetY = FIELD_H / 2 + (i - 2) * 8;
      }
    } else {
      // Ligne défensive resserrée, proche de leur propre but plutôt qu'au
      // milieu du terrain, avec un léger suivi du ballon en profondeur
      const depthFollow = ballCarrierIsHome ? Math.max(0, (ball.x - 50) * 0.3) : 0;
      targetX = FIELD_W - 22 + depthFollow + (i % 2) * 6;
      targetY = 12 + i * 9;
    }

    const toTarget = { x: targetX - p.x, y: targetY - p.y };
    const d = Math.hypot(toTarget.x, toTarget.y) || 1;
    const speedMult = isGoalkeeper ? 1.1 : 1;
    const moveSpeed = PLAYER_BASE_SPEED * params.aiSpeed * params.aiReaction * speedMult;
    p.vx = (toTarget.x / d) * moveSpeed;
    p.vy = (toTarget.y / d) * moveSpeed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampToField(p);
  }

  // --- Possession du ballon ---
  const allPlayers = [...home, ...away];
  const cooldownActive = ball.cooldownPlayerId !== null && ball.cooldownFrames > 0;
  if (ball.ownerId === null) {
    // Priorité au meneur (contrôlé par le joueur): s'il est raisonnablement
    // proche, il récupère le ballon avant tout le monde — ça évite la
    // frustration de ne jamais pouvoir tirer faute d'avoir le ballon.
    // Exception: s'il vient tout juste de tirer/passer (cooldown actif), il
    // ne peut pas le reprendre instantanément — sinon le tir/la passe n'a
    // visuellement aucun effet.
    const leaderOnCooldown = cooldownActive && ball.cooldownPlayerId === activeLeader.id;
    if (!leaderOnCooldown && dist(activeLeader, ball) < LEADER_CONTROL_RADIUS) {
      ball.ownerId = activeLeader.id;
    } else {
      let closest: Entity | null = null;
      let bestDist = Infinity;
      for (const p of allPlayers) {
        if (cooldownActive && p.id === ball.cooldownPlayerId) continue;
        const d = dist(p, ball);
        if (d < CONTROL_RADIUS && d < bestDist) {
          bestDist = d;
          closest = p;
        }
      }
      if (closest) ball.ownerId = closest.id;
    }
  }
  if (ball.cooldownFrames > 0) ball.cooldownFrames -= 1;
  else ball.cooldownPlayerId = null;

  // Le joueur "home" qui porte le ballon devient automatiquement le meneur
  // (flèche), même s'il ne s'agissait pas du meneur précédent — par exemple
  // après un ballon récupéré sur un rebond ou une interception.
  if (ball.ownerId && ball.ownerId.startsWith("home")) {
    home.forEach((p) => (p.isLeader = p.id === ball.ownerId));
  }

  // --- Tacle ---
  if (input.tackle && ball.ownerId && ball.ownerId.startsWith("away")) {
    const d = dist(activeLeader, ball);
    if (d < TACKLE_RADIUS) {
      const success = rand() < 1 - params.tackleSuccess; // plus la difficulté est haute, plus l'IA résiste
      if (success) {
        ball.ownerId = activeLeader.id;
        ball.vx = 0;
        ball.vy = 0;
      }
    }
  }
  // Tacle de l'IA adverse sur le porteur du ballon — s'applique à N'IMPORTE
  // QUEL joueur "home" qui porte le ballon, pas seulement le meneur. Avant,
  // un coéquipier (contrôlé par l'IA de soutien) qui récupérait le ballon
  // était totalement intouchable, ce qui permettait de marquer sans aucune
  // opposition simplement en le laissant avancer.
  if (ball.ownerId && ball.ownerId.startsWith("home")) {
    const carrier = home.find((p) => p.id === ball.ownerId)!;
    for (const p of away) {
      const d = dist(p, carrier);
      if (d < TACKLE_RADIUS && rand() < params.tackleSuccess * 0.35) {
        ball.ownerId = p.id;
        break;
      }
    }
  }

  // --- Passe ---
  if (input.pass && ball.ownerId === activeLeader.id) {
    const teammates = home.filter((p) => p.id !== activeLeader.id);
    let target: Entity = teammates[0];
    let bestDist = Infinity;
    for (const t of teammates) {
      const d = dist(t, activeLeader);
      if (d < bestDist) {
        bestDist = d;
        target = t;
      }
    }
    const dx = target.x - ball.x;
    const dy = target.y - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const PASS_POWER = 1.7;
    ball.vx = (dx / d) * PASS_POWER;
    ball.vy = (dy / d) * PASS_POWER;
    ball.ownerId = null;
    ball.shotInFlight = false;
    ball.cooldownPlayerId = activeLeader.id;
    ball.cooldownFrames = 18;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    return finalizeStep({ ...state, home, away, ball, awayHoldFrames }, dtMs, params.keeperSaveChance);
  }

  // --- Tir ---
  if (input.shoot && ball.ownerId === activeLeader.id) {
    const goalX = FIELD_W; // but adverse à droite
    const goalY = FIELD_H / 2 + (rand() - 0.5) * 6; // légère imprécision
    const dx = goalX - ball.x;
    const dy = goalY - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const SHOT_POWER = 2.6;
    ball.vx = (dx / d) * SHOT_POWER;
    ball.vy = (dy / d) * SHOT_POWER;
    ball.ownerId = null;
    ball.shotInFlight = true;
    ball.saveRolled = false;
    ball.cooldownPlayerId = activeLeader.id;
    ball.cooldownFrames = 18;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    return finalizeStep({
      ...state,
      home,
      away,
      ball,
      awayHoldFrames,
      shotsAttempted: state.shotsAttempted + 1,
    }, dtMs, params.keeperSaveChance);
  }

  // Tir IA adverse quand elle est proche de son but cible (x proche de 0),
  // OU forcé après une possession trop longue (anti temps-mort): sans cette
  // règle, l'IA pouvait parfois garder le ballon indéfiniment sans jamais
  // tirer ni progresser, mettant le match en pause de fait.
  const STALL_THRESHOLD_FRAMES = 200 - params.aiShotAccuracy * 150; // ~1.2s à 3.3s selon la difficulté
  if (ball.ownerId?.startsWith("away")) {
    const carrier = away.find((a) => a.id === ball.ownerId)!;
    const forcedByStall = awayHoldFrames >= STALL_THRESHOLD_FRAMES;
    // Portée de tir proportionnelle à la difficulté: aux niveaux élevés,
    // l'IA n'attend pas d'être collée au but pour tirer — elle est plus
    // efficace et vigilante, elle tente sa chance de plus loin.
    const shotRange = 16 + params.aiShotAccuracy * 26;
    const shotChance = 0.02 * params.aiShotAccuracy * 5;
    if (forcedByStall || (carrier.x < shotRange && rand() < shotChance)) {
      const goalX = 0;
      const goalY = FIELD_H / 2 + (rand() - 0.5) * (10 - params.aiShotAccuracy * 8);
      const dx = goalX - ball.x;
      const dy = goalY - ball.y;
      const d = Math.hypot(dx, dy) || 1;
      const SHOT_POWER = 2.4;
      ball.vx = (dx / d) * SHOT_POWER;
      ball.vy = (dy / d) * SHOT_POWER;
      ball.ownerId = null;
      ball.shotInFlight = true;
    }
  }

  // --- Le ballon suit son porteur, ou vole librement ---
  if (ball.ownerId) {
    const owner = allPlayers.find((p) => p.id === ball.ownerId)!;
    ball.x = owner.x + (owner.team === "home" ? 1.5 : -1.5);
    ball.y = owner.y;
    ball.vx = 0;
    ball.vy = 0;
  } else {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= 0.985; // frottement
    ball.vy *= 0.985;
  }

  return finalizeStep({ ...state, home, away, ball, awayHoldFrames }, dtMs, params.keeperSaveChance);
}

function finalizeStep(state: MatchState, dtMs: number, keeperSaveChance: number): MatchState {
  const ball = { ...state.ball };
  let { goalsHome, goalsAway } = state;
  let lastGoalAt = state.lastGoalAt;

  // Le gardien peut arrêter un tir cadré: on ne tire au sort qu'une seule
  // fois par tir, au moment où le ballon entre dans sa zone d'action. C'est
  // ce qui permet un réglage fin et progressif de la difficulté — sans ça,
  // un tir cadré marquait presque toujours, quel que soit le niveau.
  const SAVE_RADIUS = 9;
  if (ball.shotInFlight && ball.ownerId === null && !ball.saveRolled && ball.x > FIELD_W - 14) {
    const keeper = state.away[0];
    if (keeper && dist(ball, keeper) < SAVE_RADIUS) {
      ball.saveRolled = true;
      const saveRand = mulberry32(state.rngSeed + Math.floor(ball.x * 97) + 555)();
      if (saveRand < keeperSaveChance) {
        ball.ownerId = keeper.id;
        ball.vx = 0;
        ball.vy = 0;
        ball.shotInFlight = false;
      }
    }
  }

  const inGoalY = ball.y > FIELD_H / 2 - GOAL_WIDTH / 2 && ball.y < FIELD_H / 2 + GOAL_WIDTH / 2;

  let scored = false;
  if (ball.ownerId?.startsWith("away")) {
    // Le gardien (ou un autre joueur adverse) tient le ballon: pas de but
    // possible tant qu'il le tient, même si la position chevauche la ligne
    // au moment précis de l'arrêt.
  } else if (ball.x >= FIELD_W - 0.5 && inGoalY) {
    goalsHome += 1;
    scored = true;
  } else if (ball.x <= 0.5 && inGoalY) {
    goalsAway += 1;
    scored = true;
  } else if (ball.ownerId === null) {
    // Rebond sur les bords du terrain (hors cage) — uniquement pour un
    // ballon libre (un ballon transporté reste calé sur son porteur)
    if (ball.x < 0.5 || ball.x > FIELD_W - 0.5) ball.vx *= -0.6;
    if (ball.y < 0.5 || ball.y > FIELD_H - 0.5) ball.vy *= -0.6;
    ball.x = Math.max(0.5, Math.min(FIELD_W - 0.5, ball.x));
    ball.y = Math.max(0.5, Math.min(FIELD_H - 0.5, ball.y));
  }

  let home = state.home;
  let away = state.away;
  let resetBall = ball;
  let awayHoldFrames = state.awayHoldFrames;

  if (scored) {
    lastGoalAt = state.clockMs;
    const fresh = createInitialMatchState(120); // repositionnement seulement
    home = fresh.home.map((p, i) => ({ ...p, isLeader: state.home[i]?.isLeader ?? p.isLeader }));
    away = fresh.away;
    resetBall = { x: FIELD_W / 2, y: FIELD_H / 2, vx: 0, vy: 0, ownerId: null, shotInFlight: false, cooldownPlayerId: null, cooldownFrames: 0, saveRolled: false };
    awayHoldFrames = 0;
  }

  const clockMs = Math.max(0, state.clockMs - dtMs);
  const finished = clockMs <= 0;

  return {
    ...state,
    home,
    away,
    ball: resetBall,
    goalsHome,
    goalsAway,
    clockMs,
    finished,
    lastGoalAt,
    awayHoldFrames,
  };
}
