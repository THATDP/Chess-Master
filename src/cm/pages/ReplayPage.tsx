import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { MoveList } from '../components/MoveList';
import { IconChevronLeft, IconCopy, IconDownload, IconFlip, IconPause, IconPlay } from '../components/icons';
import { useBoardAppearance } from '../components/play/useBoardAppearance';
import { Button, Card, Segmented } from '../components/ui';
import { resumeSavedGame } from '../game/instance';
import { pgnFileName } from '../game/pgn';
import { resultLabel } from '../game/status';
import { copyText, download, formatDate } from '../lib/format';
import { getGame, useHistory } from '../lib/history';
import { hrefTo, navigate } from '../lib/router';

export function ReplayPage({ id }: { id: string }) {
  useHistory();
  const game = getGame(id);
  const appearance = useBoardAppearance();

  const parsed = useMemo(() => {
    if (!game) return null;
    try {
      const c = new Chess();
      c.loadPgn(game.pgn);
      return { moves: c.history({ verbose: true }), headers: c.getHeaders() as Record<string, string> };
    } catch {
      return null;
    }
  }, [game]);

  const [ply, setPly] = useState(0);
  const [prevPly, setPrevPly] = useState(0);
  const [seq, setSeq] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<'1200' | '700' | '350'>('700');
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const total = parsed?.moves.length ?? 0;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (n: number) => {
    const clamped = Math.max(0, Math.min(total, n));
    setPly((cur) => {
      setPrevPly(cur);
      return clamped;
    });
    setSeq((s) => s + 1);
  };

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setPly((cur) => {
        if (cur >= total) {
          setPlaying(false);
          return cur;
        }
        setPrevPly(cur);
        setSeq((s) => s + 1);
        return cur + 1;
      });
    }, Number(speed));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowLeft') go(ply - 1);
      else if (e.key === 'ArrowRight') go(ply + 1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!game || !parsed) {
    return (
      <Card className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-2xl font-semibold">Partida não encontrada</h1>
        <p className="mt-2 text-sm text-muted">Ela pode ter sido removida ou o PGN está inválido.</p>
        <Button className="mt-5" variant="primary" onClick={() => navigate('/history')}>
          Voltar ao histórico
        </Button>
      </Card>
    );
  }

  const { moves } = parsed;
  const startFen = moves[0]?.before ?? new Chess().fen();
  const fen = ply === 0 ? startFen : moves[ply - 1].after;
  const chessAt = new Chess(fen);
  let checkSquare: string | null = null;
  if (chessAt.inCheck()) {
    for (const row of chessAt.board()) for (const p of row) if (p && p.type === 'k' && p.color === chessAt.turn()) checkSquare = p.square;
  }
  const last = ply > 0 ? { move: moves[ply - 1], animate: ply - prevPly === 1, seq } : null;
  const orientation = (game.playerColor ?? 'w') === 'b' ? (flipped ? 'w' : 'b') : flipped ? 'b' : 'w';
  const atEnd = ply >= total;

  return (
    <div>
      <a href={hrefTo('/history')} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-accent">
        <IconChevronLeft size={16} /> Histórico
      </a>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, calc(100dvh - 7rem))' }}>
          <Board
            fen={fen}
            orientation={orientation}
            legalMoves={[]}
            lastMove={last}
            checkSquare={checkSquare}
            appearance={appearance}
            onMove={() => {}}
            label="Reprodução da partida"
          />
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Reprodução</p>
            <h1 className="font-display mt-1 text-xl font-semibold">
              {game.white} <span className="text-muted">×</span> {game.black}
            </h1>
            <p className="mt-1 text-xs text-muted">
              {formatDate(game.createdAt)} · {resultLabel(game.result)}
              {game.reason ? ` · ${game.reason}` : ''}
            </p>
            {parsed.headers.Event && parsed.headers.Event !== 'Partida Chess Master' && (
              <p className="mt-1 text-xs text-muted">{parsed.headers.Event}</p>
            )}
          </Card>

          <Card className="flex min-h-[300px] flex-col p-4 lg:h-[380px]">
            <MoveList history={moves} viewPly={ply} onSelect={(p) => { setPlaying(false); go(p); }} className="flex-1" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="flex-1"
                icon={playing ? <IconPause size={16} /> : <IconPlay size={16} />}
                disabled={total === 0}
                onClick={() => {
                  if (!playing && atEnd) go(0);
                  setPlaying((p) => !p);
                }}
                data-testid="autoplay"
              >
                {playing ? 'Pausar' : atEnd && total > 0 ? 'Rever' : 'Reproduzir'}
              </Button>
              <Button variant="outline" icon={<IconFlip size={16} />} onClick={() => setFlipped((v) => !v)} aria-label="Virar tabuleiro" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Velocidade</span>
              <Segmented<'1200' | '700' | '350'>
                ariaLabel="Velocidade da reprodução"
                value={speed}
                onChange={setSpeed}
                options={[
                  { value: '1200', label: '0.5×' },
                  { value: '700', label: '1×' },
                  { value: '350', label: '2×' },
                ]}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={<IconDownload size={14} />} onClick={() => download(pgnFileName(game.white, game.black, new Date(game.createdAt)), game.pgn)}>
                Baixar PGN
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<IconCopy size={14} />}
                onClick={async () => {
                  if (await copyText(game.pgn)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                }}
              >
                {copied ? 'Copiado' : 'Copiar PGN'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => copyText(fen)}>
                Copiar FEN
              </Button>
              {game.result === '*' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    resumeSavedGame(game);
                    navigate('/play');
                  }}
                >
                  Continuar partida
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
