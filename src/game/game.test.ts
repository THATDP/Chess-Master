import { Chess } from 'chess.js';
import { afterEach, describe, expect, it } from 'vitest';
import '../engines';
import { CHESSJS_AI_ID, defaultSettingsFor, getEngineDescriptor } from '../engines';
import { ChessClock } from './clock';
import { GameController, type GameConfig } from './GameController';
import { materialFromFen } from './material';
import { exportPgn, parsePgn, splitPgnGames } from './pgn';
import { getGameStatus, timeoutResult } from './status';
import { TIME_CONTROLS, UNLIMITED, formatClock, getTimeControl } from './timeControls';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const easy = () => ({ ...defaultSettingsFor(getEngineDescriptor(CHESSJS_AI_ID)!, 'easy') });

function config(over: Partial<GameConfig> = {}): GameConfig {
  return {
    engineId: CHESSJS_AI_ID,
    engineName: 'Chess.js AI',
    levelLabel: 'Fácil',
    engineSettings: easy(),
    playerColor: 'w',
    timeControl: UNLIMITED,
    ...over,
  };
}

const controllers: GameController[] = [];
function make(over: Partial<GameConfig> = {}, cb = { minEngineDelayMs: 0 }) {
  const g = new GameController(cb);
  controllers.push(g);
  g.start(config(over));
  return g;
}
afterEach(() => {
  controllers.splice(0).forEach((g) => g.dispose());
});

/** Sem engine respondendo: o jogador joga pelos dois lados em testes de regras. */
function twoSided(fen?: string) {
  // jogador = branco; usamos chess.js diretamente nos testes de regras puras
  return new Chess(fen);
}

describe('regras (chess.js) — fim de partida', () => {
  it('xeque-mate (mate do louco)', () => {
    const c = twoSided();
    ['f3', 'e5', 'g4', 'Qh4#'].forEach((m) => c.move(m));
    const s = getGameStatus(c);
    expect(s).toMatchObject({ over: true, result: '0-1', reason: 'checkmate', winner: 'b' });
  });
  it('afogamento', () => {
    const s = getGameStatus(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
    expect(s).toMatchObject({ over: true, result: '1/2-1/2', reason: 'stalemate' });
  });
  it('material insuficiente (K x K, K+B x K, K+N x K)', () => {
    for (const fen of ['8/8/4k3/8/8/4K3/8/8 w - - 0 1', '8/8/4k3/8/8/4K3/5B2/8 w - - 0 1', '8/8/4k3/8/8/4K3/5N2/8 w - - 0 1']) {
      expect(getGameStatus(new Chess(fen))).toMatchObject({ over: true, reason: 'insufficient' });
    }
    expect(getGameStatus(new Chess('8/8/4k3/8/8/4K3/5R2/8 w - - 0 1')).over).toBe(false);
  });
  it('tripla repetição', () => {
    const c = new Chess();
    for (let i = 0; i < 2; i++) ['Nf3', 'Nf6', 'Ng1', 'Ng8'].forEach((m) => c.move(m));
    expect(getGameStatus(c)).toMatchObject({ over: true, reason: 'threefold', result: '1/2-1/2' });
  });
  it('regra dos 50 lances', () => {
    expect(getGameStatus(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'))).toMatchObject({
      over: true,
      reason: 'fifty-move',
    });
    expect(getGameStatus(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 99 80')).over).toBe(false);
  });
  it('xeque é sinalizado', () => {
    const c = new Chess();
    ['e4', 'f6', 'Qh5+'].forEach((m) => c.move(m));
    expect(getGameStatus(c)).toMatchObject({ over: false, check: true });
  });
  it('tempo esgotado: derrota, ou empate se o adversário não pode dar mate', () => {
    expect(timeoutResult(new Chess(), 'w')).toEqual({ result: '0-1', reason: 'timeout' });
    expect(timeoutResult(new Chess('8/8/4k3/8/8/4K3/5B2/8 w - - 0 1'), 'b')).toMatchObject({ result: '1/2-1/2' });
    expect(timeoutResult(new Chess('8/8/4k3/8/8/4K3/5R2/8 w - - 0 1'), 'b')).toMatchObject({ result: '1-0' });
  });
});

describe('GameController — lances', () => {
  it('rejeita lances ilegais sem alterar o estado', () => {
    const g = make({ playerColor: 'w' }, { minEngineDelayMs: 100000 });
    const before = g.chess.fen();
    expect(g.playMove('e2', 'e5')).toBeNull(); // peão não anda 3
    expect(g.playMove('e7', 'e5')).toBeNull(); // peça adversária
    expect(g.playMove('a1', 'a3')).toBeNull(); // torre bloqueada
    expect(g.playMove('e1', 'e2')).toBeNull(); // casa ocupada
    expect(g.playMove('z9', 'a1')).toBeNull();
    expect(g.chess.fen()).toBe(before);
    expect(g.playMove('e2', 'e4')?.san).toBe('e4');
  });

  it('não permite mover fora da vez nem enquanto o adversário pensa', () => {
    const g = make({ playerColor: 'w' }, { minEngineDelayMs: 100000 });
    g.playMove('e2', 'e4');
    expect(g.getView().thinking).toBe(true);
    expect(g.playMove('d2', 'd4')).toBeNull();
    expect(g.getView().legalMoves).toHaveLength(0);
  });

  it('roque pequeno e grande pelo controlador', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const g = make({ startFen: fen, playerColor: 'w' }, { minEngineDelayMs: 100000 });
    const m = g.playMove('e1', 'g1');
    expect(m?.isKingsideCastle()).toBe(true);
    expect(g.chess.get('f1')?.type).toBe('r');
    const g2 = make({ startFen: fen, playerColor: 'w' }, { minEngineDelayMs: 100000 });
    const m2 = g2.playMove('e1', 'c1');
    expect(m2?.isQueensideCastle()).toBe(true);
    expect(g2.chess.get('d1')?.type).toBe('r');
  });

  it('roque: casas livres permitem O-O e O-O-O; passar por casa atacada não', () => {
    const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const sans = c.moves();
    expect(sans).toContain('O-O');
    expect(sans).toContain('O-O-O');
    const attacked = new Chess('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1'); // torre preta ataca f1
    expect(attacked.moves()).not.toContain('O-O');
    expect(attacked.moves()).toContain('O-O-O');
    const inCheck = new Chess('r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1');
    expect(inCheck.moves()).not.toContain('O-O');
    c.move('O-O');
    expect(c.get('g1')?.type).toBe('k');
    expect(c.get('f1')?.type).toBe('r');
  });

  it('en passant', () => {
    const g = make({ startFen: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', playerColor: 'w' }, { minEngineDelayMs: 100000 });
    const m = g.playMove('e5', 'f6');
    expect(m?.isEnPassant()).toBe(true);
    expect(g.chess.get('f5')).toBeUndefined();
  });

  it('en passant só vale no lance imediato', () => {
    const c = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    c.move('a3');
    c.move('a6');
    expect(c.moves({ square: 'e5' })).not.toContain('exf6');
  });

  it('promoção exige peça e aceita Q/R/B/N', () => {
    for (const p of ['q', 'r', 'b', 'n']) {
      const g = make({ startFen: '8/P6k/8/8/8/8/8/K7 w - - 0 1', playerColor: 'w' }, { minEngineDelayMs: 100000 });
      expect(g.playMove('a7', 'a8')).toBeNull(); // sem escolher peça
      const m = g.playMove('a7', 'a8', p);
      expect(m?.promotion).toBe(p);
      expect(g.chess.get('a8')?.type).toBe(p);
    }
    const g = make({ startFen: '8/P6k/8/8/8/8/8/K7 w - - 0 1', playerColor: 'w' }, { minEngineDelayMs: 100000 });
    expect(g.playMove('a7', 'a8', 'k')).toBeNull();
  });

  it('xeque-mate termina a partida e salva no histórico', () => {
    const saved: unknown[] = [];
    const g = new GameController({ minEngineDelayMs: 0, onSave: (r) => saved.push(r) });
    controllers.push(g);
    g.start(config({ startFen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', playerColor: 'w' }));
    g.playMove('a1', 'a8');
    const v = g.getView();
    expect(v.status).toMatchObject({ over: true, result: '1-0', reason: 'checkmate' });
    expect(saved.length).toBeGreaterThan(0);
    expect(g.playMove('g8', 'h8')).toBeNull();
  });

  it('adversário responde com lance legal na posição atual', async () => {
    const g = make({ playerColor: 'w' });
    g.playMove('e2', 'e4');
    for (let i = 0; i < 50 && g.chess.history().length < 2; i++) await sleep(50);
    expect(g.chess.history().length).toBe(2);
    expect(g.getView().turn).toBe('w');
    const replay = new Chess();
    g.chess.history().forEach((san) => expect(() => replay.move(san)).not.toThrow());
  });

  it('adversário joga primeiro quando o jogador é preto', async () => {
    const g = make({ playerColor: 'b' });
    for (let i = 0; i < 50 && g.chess.history().length < 1; i++) await sleep(50);
    expect(g.chess.history().length).toBe(1);
  });

  it('desfazer cancela o cálculo e descarta lance desatualizado', async () => {
    const g = make({ playerColor: 'w' }, { minEngineDelayMs: 150 });
    g.playMove('e2', 'e4');
    expect(g.undo()).toBe(true);
    await sleep(600);
    expect(g.chess.history().length).toBe(0);
    expect(g.chess.fen()).toBe(new Chess().fen());
    expect(g.getView().thinking).toBe(false);
  });

  it('desfazer volta até a vez do jogador (2 plies após a resposta)', async () => {
    const g = make({ playerColor: 'w' });
    g.playMove('e2', 'e4');
    for (let i = 0; i < 50 && g.chess.history().length < 2; i++) await sleep(50);
    expect(g.undo()).toBe(true);
    expect(g.chess.history().length).toBe(0);
    expect(g.getView().canUndo).toBe(false);
  });

  it('navegação no histórico bloqueia lances e volta ao vivo', async () => {
    const g = make({ playerColor: 'w' });
    g.playMove('e2', 'e4');
    for (let i = 0; i < 50 && g.chess.history().length < 2; i++) await sleep(50);
    g.goTo(1);
    expect(g.getView().isLive).toBe(false);
    expect(g.getView().fen).toContain('4P3');
    expect(g.playMove('d2', 'd4')).toBeNull();
    g.goTo(null);
    expect(g.getView().isLive).toBe(true);
  });

  it('abandono encerra a partida', () => {
    const g = make({ playerColor: 'w' }, { minEngineDelayMs: 100000 });
    g.resign();
    expect(g.getView().status).toMatchObject({ over: true, result: '0-1', reason: 'resignation' });
  });

  it('estouro de tempo encerra a partida', async () => {
    const g = make({ timeControl: { id: 't', label: 't', category: 'Bullet', initialMs: 250, incrementMs: 0 }, playerColor: 'w' }, { minEngineDelayMs: 0 });
    g.playMove('e2', 'e4');
    for (let i = 0; i < 50 && g.chess.history().length < 2; i++) await sleep(30);
    await sleep(500); // jogador (brancas) não joga: relógio das brancas estoura
    expect(g.getView().status).toMatchObject({ over: true, result: '0-1', reason: 'timeout' });
  });
});

describe('relógio', () => {
  const tcOf = (min: number, inc: number) => ({ id: 'x', label: 'x', category: 'Blitz' as const, initialMs: min * 60000, incrementMs: inc * 1000 });
  it('só começa após o primeiro lance de cada lado e respeita turnos', () => {
    let t = 0;
    const c = new ChessClock(tcOf(3, 0), () => t);
    t = 5000;
    expect(c.get('w')).toBe(180000);
    c.onMove('w', 1);
    t = 20000;
    expect(c.get('b')).toBe(180000);
    c.onMove('b', 2); // brancas começam a correr
    t = 30000;
    expect(c.get('w')).toBe(170000);
    expect(c.get('b')).toBe(180000);
    c.onMove('w', 3);
    t = 34000;
    expect(c.get('w')).toBe(170000);
    expect(c.get('b')).toBe(176000);
    expect(c.running).toBe('b');
  });
  it('soma incremento e detecta bandeira', () => {
    let t = 0;
    const c = new ChessClock(tcOf(3, 2), () => t);
    c.onMove('w', 1);
    c.onMove('b', 2);
    t = 10000;
    c.onMove('w', 3);
    expect(c.get('w')).toBe(180000 - 10000 + 2000);
    t = 10000 + 181000;
    expect(c.flagged()).toBe('b');
    expect(c.get('b')).toBe(0);
  });
  it('snapshot/restore (desfazer)', () => {
    let t = 0;
    const c = new ChessClock(tcOf(5, 3), () => t);
    c.onMove('w', 1);
    c.onMove('b', 2);
    const snap = c.snapshot();
    t = 7000;
    c.onMove('w', 3);
    c.restore(snap, 2, 'w');
    expect(c.running).toBe('w');
    expect(c.get('w')).toBe(300000);
  });
  it('sem limite nunca estoura', () => {
    const c = new ChessClock(UNLIMITED, () => 1e12);
    c.onMove('w', 5);
    expect(c.enabled).toBe(false);
    expect(c.flagged()).toBeNull();
    expect(c.get('w')).toBe(Infinity);
  });
  it('controles de tempo exigidos existem', () => {
    expect(TIME_CONTROLS.map((t) => t.label)).toEqual(['Sem limite', '1+0', '3+0', '3+2', '5+0', '5+3', '10+0', '15+10']);
    expect(getTimeControl('15+10')).toMatchObject({ initialMs: 900000, incrementMs: 10000 });
    expect(formatClock(65000)).toBe('1:05');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(4200)).toBe('0:04.2');
    expect(formatClock(Infinity)).toBe('∞');
  });
});

describe('PGN, FEN e SAN', () => {
  it('exporta e reimporta PGN com cabeçalhos e SAN', () => {
    const c = new Chess();
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'].forEach((m) => c.move(m));
    const pgn = exportPgn(c, { white: 'Ana', black: 'Stockfish · Mestre', result: '*', timeControl: '300+3' });
    expect(pgn).toContain('[White "Ana"]');
    expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6');
    const parsed = parsePgn(pgn);
    expect(parsed.plies).toBe(6);
    expect(parsed.chess.fen()).toBe(c.fen());
    expect(parsed.headers.Black).toBe('Stockfish · Mestre');
  });
  it('rejeita PGN inválido com mensagem', () => {
    expect(() => parsePgn('1. e4 e5 2. Ke4')).toThrow(/PGN inválido/);
    expect(() => parsePgn('   ')).toThrow(/vazio/);
  });
  it('separa vários jogos', () => {
    const txt = '[Event "A"]\n\n1. e4 e5 *\n\n[Event "B"]\n\n1. d4 d5 *\n';
    expect(splitPgnGames(txt)).toHaveLength(2);
  });
  it('PGN de partida iniciada por FEN preserva a posição', () => {
    const g = make({ startFen: '8/P6k/8/8/8/8/8/K7 w - - 0 1', playerColor: 'w' }, { minEngineDelayMs: 100000 });
    g.playMove('a7', 'a8', 'q');
    const p = parsePgn(g.getView().pgn);
    expect(p.chess.fen()).toBe(g.chess.fen());
  });
  it('material a partir do FEN', () => {
    const m = materialFromFen('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(m.diff).toBe(9);
    expect(m.capturedByWhite).toEqual(['q']);
    expect(m.capturedByBlack).toEqual([]);
  });
});
