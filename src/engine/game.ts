import { cardsLabel, fullDeck, type Card } from './cards';
import { describeScore, evaluate } from './evaluator';
import { defaultRng, randInt, shuffle, type Rng } from './random';

/**
 * Moteur de Texas Hold'em No-Limit.
 * Toutes les fonctions publiques renvoient un nouvel état (l'état reçu n'est jamais modifié).
 * Les montants sont des jetons entiers ; avec les blinds par défaut (5/10), 1 BB = 10 jetons.
 */

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionKind = 'fold' | 'check' | 'call' | 'raise';

export interface Action {
  type: ActionKind;
  /** Pour « raise » : montant total de la mise sur ce tour (« relancer à »). */
  amount?: number;
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  /** Profil de jeu pour les bots. */
  profile: string | null;
  stack: number;
  hole: Card[];
  /** Mise engagée sur le tour d'enchères en cours. */
  bet: number;
  /** Total engagé dans la main. */
  contributed: number;
  folded: boolean;
  allIn: boolean;
  /** A parlé depuis la dernière relance complète. */
  hasActed: boolean;
  /** Sans jetons : ne participe pas à la main. */
  sittingOut: boolean;
  /** Dernière action, affichée sur la table. */
  lastAction: string | null;
  /** Cartes retournées à l'abattage. */
  shown: boolean;
}

export interface HistoryAction {
  player: number;
  street: Street;
  type: ActionKind | 'blind';
  /** Jetons ajoutés par cette action. */
  amount: number;
  /** Mise totale du joueur sur le tour après l'action. */
  to: number;
  allIn: boolean;
  /** Mise à payer avant l'action. */
  facing: number;
  /** Taille du pot avant l'action. */
  potBefore: number;
}

export interface LogLine {
  street: Street;
  text: string;
  kind: 'info' | 'action' | 'board' | 'win';
}

export interface PotResult {
  amount: number;
  eligible: number[];
  winners: number[];
  label: string;
}

export interface HandResult {
  pots: PotResult[];
  showdown: boolean;
  /** Score de chaque joueur arrivé à l'abattage (null sinon). */
  scores: (number | null)[];
  handNames: (string | null)[];
  /** Gain net de la main pour chaque joueur, en jetons. */
  net: number[];
  summary: string;
}

export interface GameState {
  smallBlind: number;
  bigBlind: number;
  players: Player[];
  button: number;
  sbIndex: number;
  bbIndex: number;
  street: Street;
  board: Card[];
  deck: Card[];
  currentBet: number;
  /** Taille de la dernière relance complète (relance minimale suivante). */
  minRaise: number;
  toAct: number | null;
  lastAggressor: number | null;
  preflopAggressor: number | null;
  handNumber: number;
  history: HistoryAction[];
  log: LogLine[];
  result: HandResult | null;
  /** Libellé de position de chaque joueur pour la main (BTN, SB, BB, UTG, HJ, CO). */
  positions: (string | null)[];
  startStacks: number[];
}

export interface SeatConfig {
  id: string;
  name: string;
  isHuman: boolean;
  profile: string | null;
  stack: number;
}

export interface LegalActions {
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  pot: number;
}

const clone = <T>(x: T): T => structuredClone(x);

export function formatBB(chips: number, bigBlind: number): string {
  const v = chips / bigBlind;
  const rounded = Math.round(v * 10) / 10;
  return `${rounded.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB`;
}

export function createGame(seats: SeatConfig[], smallBlind = 5, bigBlind = 10): GameState {
  return {
    smallBlind,
    bigBlind,
    players: seats.map((s) => ({
      ...s,
      hole: [],
      bet: 0,
      contributed: 0,
      folded: false,
      allIn: false,
      hasActed: false,
      sittingOut: s.stack <= 0,
      lastAction: null,
      shown: false,
    })),
    button: -1,
    sbIndex: -1,
    bbIndex: -1,
    street: 'showdown',
    board: [],
    deck: [],
    currentBet: 0,
    minRaise: bigBlind,
    toAct: null,
    lastAggressor: null,
    preflopAggressor: null,
    handNumber: 0,
    history: [],
    log: [],
    result: null,
    positions: seats.map(() => null),
    startStacks: seats.map((s) => s.stack),
  };
}

// ——— Aides ———

const inHand = (p: Player) => !p.sittingOut && !p.folded;
const canAct = (p: Player) => inHand(p) && !p.allIn;

export function potTotal(s: GameState): number {
  return s.players.reduce((a, p) => a + p.contributed, 0);
}

/** Index du prochain joueur (dans le sens horaire) vérifiant le prédicat. */
function nextIndex(s: GameState, from: number, pred: (p: Player, i: number) => boolean): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + k) % n) + n) % n;
    if (pred(s.players[i], i)) return i;
  }
  return -1;
}

function name(s: GameState, i: number): string {
  return s.players[i].isHuman ? 'Vous' : s.players[i].name;
}

function verb(s: GameState, i: number, human: string, other: string): string {
  return s.players[i].isHuman ? human : other;
}

function bb(s: GameState, chips: number): string {
  return formatBB(chips, s.bigBlind);
}

function log(s: GameState, text: string, kind: LogLine['kind'] = 'action') {
  s.log.push({ street: s.street, text, kind });
}

function computePositions(s: GameState): (string | null)[] {
  const out: (string | null)[] = s.players.map(() => null);
  const order: number[] = [];
  let i = s.button;
  do {
    if (!s.players[i].sittingOut) order.push(i);
    i = (i + 1) % s.players.length;
  } while (i !== s.button);
  const n = order.length;
  if (n === 2) {
    out[order[0]] = 'BTN';
    out[order[1]] = 'BB';
    return out;
  }
  out[order[0]] = 'BTN';
  out[order[1]] = 'SB';
  out[order[2]] = 'BB';
  const early = ['UTG', 'HJ', 'CO'].slice(3 - (n - 3));
  for (let k = 3; k < n; k++) out[order[k]] = early[k - 3] ?? 'MP';
  return out;
}

function postBlind(s: GameState, i: number, amount: number, label: string) {
  const p = s.players[i];
  const paid = Math.min(amount, p.stack);
  const potBefore = potTotal(s);
  p.stack -= paid;
  p.bet = paid;
  p.contributed = paid;
  if (p.stack === 0) p.allIn = true;
  p.lastAction = `${label} ${bb(s, paid)}`;
  s.history.push({ player: i, street: 'preflop', type: 'blind', amount: paid, to: paid, allIn: p.allIn, facing: 0, potBefore });
  log(s, `${name(s, i)} ${verb(s, i, 'payez', 'paie')} la ${label === 'SB' ? 'petite' : 'grosse'} blind (${bb(s, paid)})`);
}

// ——— Déroulé d'une main ———

export function activePlayerCount(s: GameState): number {
  return s.players.filter((p) => p.stack > 0).length;
}

export function startHand(state: GameState, rng: Rng = defaultRng): GameState {
  const s = clone(state);
  s.handNumber++;
  s.board = [];
  s.history = [];
  s.log = [];
  s.result = null;
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastAggressor = null;
  s.preflopAggressor = null;
  for (const p of s.players) {
    p.hole = [];
    p.bet = 0;
    p.contributed = 0;
    p.folded = false;
    p.allIn = false;
    p.hasActed = false;
    p.lastAction = null;
    p.shown = false;
    p.sittingOut = p.stack <= 0;
  }
  s.startStacks = s.players.map((p) => p.stack);
  const active = s.players.filter((p) => !p.sittingOut).length;
  if (active < 2) throw new Error('Il faut au moins deux joueurs avec des jetons.');

  if (s.button < 0) {
    const candidates = s.players.map((p, i) => (p.sittingOut ? -1 : i)).filter((i) => i >= 0);
    s.button = candidates[randInt(rng, candidates.length)];
  } else {
    s.button = nextIndex(s, s.button, (p) => !p.sittingOut);
  }
  if (active === 2) {
    s.sbIndex = s.button;
    s.bbIndex = nextIndex(s, s.button, (p) => !p.sittingOut);
  } else {
    s.sbIndex = nextIndex(s, s.button, (p) => !p.sittingOut);
    s.bbIndex = nextIndex(s, s.sbIndex, (p) => !p.sittingOut);
  }
  s.positions = computePositions(s);
  s.street = 'preflop';
  log(s, `Main n° ${s.handNumber} — bouton : ${name(s, s.button)}`, 'info');

  postBlind(s, s.sbIndex, s.smallBlind, 'SB');
  postBlind(s, s.bbIndex, s.bigBlind, 'BB');
  s.currentBet = s.bigBlind;

  s.deck = shuffle(fullDeck(), rng);
  for (let round = 0; round < 2; round++) {
    let i = s.sbIndex;
    for (let k = 0; k < active; k++) {
      s.players[i].hole.push(s.deck.pop()!);
      i = nextIndex(s, i, (p) => !p.sittingOut);
    }
  }
  const human = s.players.findIndex((p) => p.isHuman && !p.sittingOut);
  if (human >= 0) log(s, `Vous recevez ${cardsLabel(s.players[human].hole)}`, 'info');

  s.toAct = s.bbIndex;
  progress(s, s.bbIndex);
  return s;
}

export function getLegalActions(s: GameState): LegalActions | null {
  if (s.toAct === null || s.result) return null;
  const p = s.players[s.toAct];
  const toCall = Math.min(s.currentBet - p.bet, p.stack);
  const maxRaiseTo = p.bet + p.stack;
  const minRaiseTo = Math.min(s.currentBet + s.minRaise, maxRaiseTo);
  const othersCanAct = s.players.some((q, i) => i !== s.toAct && canAct(q));
  const othersInHand = s.players.some((q, i) => i !== s.toAct && inHand(q) && q.bet + q.stack > s.currentBet);
  return {
    toCall,
    canCheck: p.bet >= s.currentBet,
    canRaise: p.stack > toCall && !p.hasActed && othersCanAct && othersInHand,
    minRaiseTo,
    maxRaiseTo,
    pot: potTotal(s),
  };
}

export function applyAction(state: GameState, action: Action): GameState {
  const s = clone(state);
  const legal = getLegalActions(s);
  if (!legal || s.toAct === null) throw new Error('Aucun joueur ne doit parler.');
  const i = s.toAct;
  const p = s.players[i];
  const potBefore = potTotal(s);
  const facing = legal.toCall;
  let type = action.type;
  if (type === 'call' && legal.toCall === 0) type = 'check';
  if (type === 'check' && !legal.canCheck) throw new Error('Impossible de checker : il y a une mise à payer.');
  if (type === 'raise' && !legal.canRaise) type = legal.toCall > 0 ? 'call' : 'check';

  switch (type) {
    case 'fold': {
      p.folded = true;
      p.lastAction = 'Couché';
      log(s, `${name(s, i)} ${verb(s, i, 'vous couchez', 'se couche')}`);
      s.history.push({ player: i, street: s.street, type: 'fold', amount: 0, to: p.bet, allIn: false, facing, potBefore });
      break;
    }
    case 'check': {
      p.lastAction = 'Parole';
      log(s, `${name(s, i)} ${verb(s, i, 'checkez', 'checke')}`);
      s.history.push({ player: i, street: s.street, type: 'check', amount: 0, to: p.bet, allIn: false, facing, potBefore });
      break;
    }
    case 'call': {
      const chips = legal.toCall;
      p.stack -= chips;
      p.bet += chips;
      p.contributed += chips;
      if (p.stack === 0) p.allIn = true;
      p.lastAction = p.allIn ? `Tapis ${bb(s, p.bet)}` : `Suit ${bb(s, p.bet)}`;
      log(
        s,
        p.allIn
          ? `${name(s, i)} ${verb(s, i, 'suivez', 'suit')} pour ${bb(s, chips)} et ${verb(s, i, 'êtes', 'est')} à tapis`
          : `${name(s, i)} ${verb(s, i, 'suivez', 'suit')} ${bb(s, chips)}`,
      );
      s.history.push({ player: i, street: s.street, type: 'call', amount: chips, to: p.bet, allIn: p.allIn, facing, potBefore });
      break;
    }
    case 'raise': {
      let to = Math.round(action.amount ?? legal.minRaiseTo);
      to = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, to));
      const chips = to - p.bet;
      const isBet = s.currentBet === 0;
      const raiseSize = to - s.currentBet;
      p.stack -= chips;
      p.bet = to;
      p.contributed += chips;
      if (p.stack === 0) p.allIn = true;
      if (raiseSize >= s.minRaise) {
        s.minRaise = raiseSize;
        for (const [j, q] of s.players.entries()) if (j !== i && canAct(q)) q.hasActed = false;
      }
      s.currentBet = to;
      s.lastAggressor = i;
      if (s.street === 'preflop') s.preflopAggressor = i;
      const word = isBet ? 'Mise' : 'Relance';
      p.lastAction = p.allIn ? `Tapis ${bb(s, to)}` : `${word} ${bb(s, to)}`;
      if (p.allIn) log(s, `${name(s, i)} ${verb(s, i, 'faites', 'fait')} tapis (${bb(s, to)})`);
      else if (isBet) log(s, `${name(s, i)} ${verb(s, i, 'misez', 'mise')} ${bb(s, to)}`);
      else log(s, `${name(s, i)} ${verb(s, i, 'relancez', 'relance')} à ${bb(s, to)}`);
      s.history.push({ player: i, street: s.street, type: 'raise', amount: chips, to, allIn: p.allIn, facing, potBefore });
      break;
    }
  }
  p.hasActed = true;
  progress(s, i);
  return s;
}

/** Fin de tour d'enchères : tous les joueurs pouvant parler ont égalisé et parlé. */
function isRoundComplete(s: GameState): boolean {
  const actors = s.players.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1) {
    const p = actors[0];
    const othersInHand = s.players.filter((q) => inHand(q) && q !== p).length;
    if (othersInHand === 0) return true;
    return p.bet >= s.currentBet && (p.hasActed || s.players.every((q) => q === p || !inHand(q) || q.allIn));
  }
  return actors.every((p) => p.hasActed && p.bet === s.currentBet);
}

function progress(s: GameState, from: number) {
  const remaining = s.players.map((p, i) => (inHand(p) ? i : -1)).filter((i) => i >= 0);
  if (remaining.length === 1) {
    awardUncontested(s, remaining[0]);
    return;
  }
  if (isRoundComplete(s)) {
    const actors = s.players.filter(canAct).length;
    if (actors <= 1) {
      // Plus personne ne peut miser : on déroule le board jusqu'à la rivière.
      while (s.board.length < 5) dealNextStreet(s);
      showdown(s);
      return;
    }
    if (s.street === 'river') {
      showdown(s);
      return;
    }
    dealNextStreet(s);
    s.toAct = nextIndex(s, s.button, canAct);
    return;
  }
  s.toAct = nextIndex(s, from, (p) => canAct(p) && (!p.hasActed || p.bet < s.currentBet));
}

function dealNextStreet(s: GameState) {
  for (const p of s.players) {
    p.bet = 0;
    p.hasActed = false;
    if (inHand(p) && !p.allIn) p.lastAction = null;
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastAggressor = null;
  if (s.board.length === 0) {
    s.street = 'flop';
    s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
    log(s, `Flop : ${cardsLabel(s.board)}`, 'board');
  } else if (s.board.length === 3) {
    s.street = 'turn';
    s.board.push(s.deck.pop()!);
    log(s, `Turn : ${cardsLabel(s.board)}`, 'board');
  } else {
    s.street = 'river';
    s.board.push(s.deck.pop()!);
    log(s, `River : ${cardsLabel(s.board)}`, 'board');
  }
}

/** Rend la partie d'une mise que personne n'a pu suivre. */
function refundUncalled(s: GameState) {
  let top = -1;
  let topAmt = -1;
  let second = 0;
  s.players.forEach((p, i) => {
    if (p.contributed > topAmt) {
      second = Math.max(second, topAmt);
      topAmt = p.contributed;
      top = i;
    } else second = Math.max(second, p.contributed);
  });
  const extra = topAmt - second;
  if (top >= 0 && extra > 0) {
    const p = s.players[top];
    p.contributed -= extra;
    p.stack += extra;
    p.bet = Math.max(0, p.bet - extra);
    if (p.stack > 0) p.allIn = false;
    log(s, `${name(s, top)} ${verb(s, top, 'récupérez', 'récupère')} ${bb(s, extra)} non suivis`, 'info');
  }
}

function finish(s: GameState, result: Omit<HandResult, 'net' | 'summary'>, summary: string) {
  s.toAct = null;
  for (const p of s.players) p.bet = 0;
  s.result = {
    ...result,
    net: s.players.map((p, i) => p.stack - s.startStacks[i]),
    summary,
  };
}

function awardUncontested(s: GameState, winner: number) {
  refundUncalled(s);
  const pot = potTotal(s);
  s.players[winner].stack += pot;
  log(s, `${name(s, winner)} ${verb(s, winner, 'remportez', 'remporte')} ${bb(s, pot)} sans abattage`, 'win');
  finish(
    s,
    {
      pots: [{ amount: pot, eligible: [winner], winners: [winner], label: 'Pot' }],
      showdown: false,
      scores: s.players.map(() => null),
      handNames: s.players.map(() => null),
    },
    `${name(s, winner)} ${verb(s, winner, 'remportez', 'remporte')} ${bb(s, pot)}`,
  );
}

/** Découpe le pot en pot principal et pots annexes. */
export function buildPots(players: Pick<Player, 'contributed' | 'folded' | 'sittingOut'>[]): { amount: number; eligible: number[] }[] {
  const levels = Array.from(
    new Set(players.filter((p) => !p.folded && !p.sittingOut && p.contributed > 0).map((p) => p.contributed)),
  ).sort((a, b) => a - b);
  const pots: { amount: number; eligible: number[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.contributed, level) - prev);
    const eligible = players
      .map((p, i) => (!p.folded && !p.sittingOut && p.contributed >= level ? i : -1))
      .filter((i) => i >= 0);
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  // Jetons au-delà du dernier niveau (joueurs couchés) : ajoutés au dernier pot.
  const total = players.reduce((a, p) => a + p.contributed, 0);
  const counted = pots.reduce((a, p) => a + p.amount, 0);
  if (pots.length && total > counted) pots[pots.length - 1].amount += total - counted;
  return pots;
}

function showdown(s: GameState) {
  refundUncalled(s);
  s.street = 'showdown';
  const scores: (number | null)[] = s.players.map((p) =>
    inHand(p) ? evaluate([...p.hole, ...s.board]) : null,
  );
  const handNames = scores.map((sc) => (sc === null ? null : describeScore(sc)));
  // Abattage : chaque main restante est retournée.
  s.players.forEach((p, i) => {
    if (inHand(p)) {
      p.shown = true;
      log(s, `${name(s, i)} ${verb(s, i, 'montrez', 'montre')} ${cardsLabel(p.hole)} — ${handNames[i]}`, 'info');
    }
  });

  const pots = buildPots(s.players);
  const results: PotResult[] = [];
  const n = s.players.length;
  const seatOrder = (i: number) => (i - s.button - 1 + n) % n;
  pots.forEach((pot, k) => {
    let best = -1;
    for (const i of pot.eligible) best = Math.max(best, scores[i]!);
    const winners = pot.eligible.filter((i) => scores[i] === best).sort((a, b) => seatOrder(a) - seatOrder(b));
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      s.players[w].stack += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
    }
    const label = pots.length === 1 ? 'Pot' : k === 0 ? 'Pot principal' : `Pot annexe ${k}`;
    results.push({ amount: pot.amount, eligible: pot.eligible, winners, label });
    const who = winners.map((w) => name(s, w)).join(' et ');
    const plural = winners.length > 1 || s.players[winners[0]].isHuman;
    log(
      s,
      `${who} ${plural ? (winners.length > 1 ? 'se partagent' : 'remportez') : 'remporte'} ${label.toLowerCase()} (${bb(s, pot.amount)}) avec ${handNames[winners[0]]}`,
      'win',
    );
  });

  const main = results[0];
  const mainWinners = main.winners.map((w) => name(s, w)).join(' et ');
  const summary =
    main.winners.length > 1
      ? `Partage : ${mainWinners} (${handNames[main.winners[0]]})`
      : `${mainWinners} ${s.players[main.winners[0]].isHuman ? 'gagnez' : 'gagne'} avec ${handNames[main.winners[0]]}`;
  finish(s, { pots: results, showdown: true, scores, handNames }, summary);
}

// ——— Gestion de la table entre deux mains ———

export function setPlayer(state: GameState, index: number, patch: Partial<SeatConfig>): GameState {
  const s = clone(state);
  Object.assign(s.players[index], patch);
  s.players[index].sittingOut = s.players[index].stack <= 0;
  return s;
}

export function isHandOver(s: GameState): boolean {
  return s.result !== null;
}

/** Joueurs encore en jeu (non couchés) dans la main. */
export function playersInHand(s: GameState): number[] {
  return s.players.map((p, i) => (inHand(p) ? i : -1)).filter((i) => i >= 0);
}
