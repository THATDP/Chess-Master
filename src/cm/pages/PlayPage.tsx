import type { Color } from 'chess.js';
import { useCallback, useEffect, useState } from 'react';
import { useUi } from '../lib/prefs';
import { t, tr } from '../lib/i18n';
import { Board } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { MoveList } from '../components/MoveList';
import { PlayerCard } from '../components/PlayerCard';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconFlag,
  IconFlip,
  IconPlus,
  IconRefresh,
  IconUndo,
} from '../components/icons';
import { EnginePanel } from '../components/play/EnginePanel';
import { SetupScreen } from '../components/play/SetupScreen';
import { useBoardAppearance } from '../components/play/useBoardAppearance';
import { Button, Card } from '../components/ui';
import { getEngineDescriptor } from '../engines';
import type { GameView } from '../game/GameController';
import { gameController, startConfiguredGame, useGameView } from '../game/instance';
import { pgnFileName } from '../game/pgn';
import { resultLabel } from '../game/status';
import { copyText, download } from '../lib/format';
import { hrefTo } from '../lib/router';
import { useSettings } from '../lib/settings';

export function PlayPage() {
  const view = useGameView();
  if (!view.active) return <SetupScreen />;
  return <GameScreen view={view} />;
}

const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

function GameScreen({ view }: { view: GameView }) {
  const settings = useSettings();
  const appearance = useBoardAppearance();
  const cfg = view.config!;
  const [flipped, setFlipped] = useState(false);
  const ui = useUi();
  const [pendingMove, setPendingMove] = useState<{ from: string; to: string; promotion: string | undefined; source: 'drag' | 'click' } | null>(null);
  useEffect(() => {
    const flip = () => setFlipped((v) => !v);
    window.addEventListener('cm:flip', flip);
    return () => window.removeEventListener('cm:flip', flip);
  }, []);
  const [dismissedOver, setDismissedOver] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const baseOrientation: Color = ui.autoOrient ? cfg.playerColor : 'w';
  const orientation: Color = flipped ? opposite(baseOrientation) : baseOrientation;
  const descriptor = getEngineDescriptor(cfg.engineId);

  // Nova partida: reseta estados locais.
  useEffect(() => {
    setFlipped(false);
    setDismissedOver(false);
    setConfirmResign(false);
  }, [cfg]);

  useEffect(() => {
    if (!view.status.over) setDismissedOver(false);
  }, [view.status.over]);

  useEffect(() => {
    if (!confirmResign) return;
    const t = setTimeout(() => setConfirmResign(false), 4000);
    return () => clearTimeout(t);
  }, [confirmResign]);

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        gameController.goTo(Math.max(0, view.viewPly - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        gameController.goTo(view.viewPly + 1);
      } else if (e.key === 'ArrowUp') gameController.goTo(0);
      else if (e.key === 'ArrowDown') gameController.goTo(null);
      else if (e.key === 'f' || e.key === 'F') setFlipped((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.viewPly]);

  const onMove = useCallback(
    (from: string, to: string, promotion: string | undefined, source: 'drag' | 'click') => {
      if (ui.moveInput === 'click' && source === 'drag') return;
      if (ui.moveInput === 'drag' && source === 'click') return;
      if (ui.confirmMoves) {
        setPendingMove({ from, to, promotion, source });
        return;
      }
      gameController.playMove(from, to, promotion, source);
    },
    [ui.moveInput, ui.confirmMoves],
  );

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const engineColor = view.engineColor!;
  const sideProps = (color: Color) => {
    const isEngine = color === engineColor;
    const captured = color === 'w' ? view.material.capturedByWhite : view.material.capturedByBlack;
    const adv = color === 'w' ? Math.max(0, view.material.diff) : Math.max(0, -view.material.diff);
    return {
      color,
      isEngine,
      name: isEngine ? cfg.engineName : (cfg.playerName ?? 'Você'),
      subtitle: isEngine ? cfg.levelLabel : color === 'w' ? 'Brancas' : 'Pretas',
      active: !view.status.over && view.turn === color,
      clock: gameController.clock,
      clockEnabled: view.clockEnabled,
      captured,
      advantage: adv,
      pieceSet: settings.pieceSet,
      thinking: isEngine && view.thinking,
      clockKey: 0,
    };
  };
  const top = opposite(orientation);
  const showEvalBar = settings.showEval && !!descriptor?.capabilities.evaluation;

  const fileName = pgnFileName(
    cfg.playerColor === 'w' ? (cfg.playerName ?? 'Voce') : cfg.engineName,
    cfg.playerColor === 'b' ? (cfg.playerName ?? 'Voce') : cfg.engineName,
  );

  return (
    <div className="pm-grid grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Coluna do tabuleiro */}
      <div className="pm-board mx-auto flex w-full flex-col gap-2.5" style={{ maxWidth: 'min(100%, calc(100dvh - 9.5rem))' }}>
        <PlayerCard {...sideProps(top)} />
        <div className="flex items-stretch gap-2.5">
          {showEvalBar && <EvalBar info={view.engineInfo} orientation={orientation} />}
          <div className="relative min-w-0 flex-1">
            <Board
              fen={view.fen}
              orientation={orientation}
              legalMoves={view.legalMoves}
              lastMove={view.lastMove}
              checkSquare={view.checkSquare}
              appearance={appearance}
              onMove={onMove}
            />
            {view.status.over && !dismissedOver && (
              <GameOverCard view={view} onDismiss={() => setDismissedOver(true)} fileName={fileName} />
            )}
            {!view.isLive && !view.status.over && (
              <button
                onClick={() => gameController.goTo(null)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink shadow-lg"
              >
                Voltar à partida
              </button>
            )}
          </div>
        </div>
        {pendingMove && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm" role="alertdialog" data-testid="confirm-move">
            <span>{t('toast.confirmMove', { move: `${pendingMove.from}→${pendingMove.to}` })}</span>
            <span className="flex gap-2">
              <button className="cursor-pointer rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-ink" onClick={() => { const m = pendingMove; setPendingMove(null); gameController.playMove(m.from, m.to, m.promotion, m.source); }}>{t('play.confirm')}</button>
              <button className="cursor-pointer rounded-lg border border-line px-3 py-1 text-xs" onClick={() => setPendingMove(null)}>{t('play.cancel')}</button>
            </span>
          </div>
        )}
        <PlayerCard {...sideProps(orientation)} />
      </div>

      {/* Painel lateral */}
      <div className="pm-side relative min-h-0">
        <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
          <div className="pm-engine"><EnginePanel view={view} showEval={settings.showEval} /></div>

          <Card className="pm-moves flex min-h-[260px] flex-1 flex-col p-4 lg:min-h-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{tr('Lances')}</h3>
              <span
                data-testid="game-status"
                className={`text-xs font-medium ${view.status.over ? 'text-accent' : view.status.check ? 'text-bad' : 'text-muted'}`}
              >
                {view.status.over ? `${view.status.title} · ${resultLabel(view.status.result)}` : view.status.title === 'Em andamento' ? view.status.detail : `${view.status.title}`}
              </span>
            </div>
            <MoveList
              className="flex-1"
              history={view.history}
              viewPly={view.viewPly}
              onSelect={(p) => gameController.goTo(p)}
            />
          </Card>

          <Card className="pm-actions p-3">
            <div className="grid grid-cols-4 gap-2">
              <ActionButton label={tr('Virar')} icon={<IconFlip size={18} />} onClick={() => setFlipped((v) => !v)} />
              <ActionButton
                label={tr('Desfazer')}
                icon={<IconUndo size={18} />}
                disabled={!settings.allowUndo || !view.canUndo}
                onClick={() => gameController.undo()}
              />
              <ActionButton
                label={confirmResign ? tr('Confirmar?') : tr('Abandonar')}
                icon={<IconFlag size={18} />}
                danger={confirmResign}
                disabled={view.status.over}
                onClick={() => {
                  if (confirmResign) {
                    setConfirmResign(false);
                    gameController.resign();
                  } else setConfirmResign(true);
                }}
              />
              <ActionButton label={tr('Nova')} icon={<IconPlus size={18} />} onClick={() => gameController.closeGame()} />
              <ActionButton
                label={copied === 'pgn' ? tr('Copiado') : tr('Copiar PGN')}
                icon={copied === 'pgn' ? <IconCheck size={18} /> : <IconCopy size={18} />}
                disabled={view.history.length === 0}
                onClick={async () => {
                  if (await copyText(gameController.exportCurrentPgn())) flash('pgn');
                }}
              />
              <ActionButton
                label={copied === 'fen' ? tr('Copiado') : tr('Copiar FEN')}
                icon={copied === 'fen' ? <IconCheck size={18} /> : <IconCopy size={18} />}
                onClick={async () => {
                  if (await copyText(view.fen)) flash('fen');
                }}
              />
              <ActionButton
                label={tr('Baixar PGN')}
                icon={<IconDownload size={18} />}
                disabled={view.history.length === 0}
                onClick={() => download(fileName, gameController.exportCurrentPgn())}
              />
              <a
                href={hrefTo('/history')}
                className="flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface2 text-[11px] font-medium text-ink transition hover:border-accent/60"
              >
                <IconRefresh size={18} />
                {tr('Histórico')}
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-medium transition disabled:cursor-default disabled:opacity-35 ${
        danger ? 'border-bad/50 bg-bad/15 text-bad' : 'border-line bg-surface2 text-ink hover:border-accent/60'
      }`}
    >
      {icon}
      <span className="max-w-full truncate px-1">{label}</span>
    </button>
  );
}

function GameOverCard({ view, onDismiss, fileName }: { view: GameView; onDismiss: () => void; fileName: string }) {
  const cfg = view.config!;
  const st = view.status;
  const won = st.winner === cfg.playerColor;
  const headline = st.winner === null ? tr('Empate') : won ? tr('Você venceu!') : tr('Você perdeu');
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4 backdrop-blur-[2px] fade-in" data-testid="game-over">
      <div className="rise w-full max-w-[320px] rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{st.title}</p>
        <h2 className="font-display mt-1 text-3xl font-semibold">{headline}</h2>
        <p className="mt-1 font-mono text-lg text-muted">{resultLabel(st.result)}</p>
        <p className="mt-1 text-sm text-muted">{st.detail}</p>
        <div className="mt-5 grid gap-2">
          <Button
            variant="primary"
            onClick={() =>
              startConfiguredGame({
                playerColor: opposite(cfg.playerColor),
                engineId: cfg.engineId,
                engineName: cfg.engineName,
                levelLabel: cfg.levelLabel,
                engineSettings: cfg.engineSettings,
                timeControl: cfg.timeControl,
              })
            }
          >
            {tr('Revanche (trocar de cor)')}
          </Button>
          <Button onClick={() => gameController.closeGame()}>{tr('Nova partida')}</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onDismiss}>
              {tr('Revisar')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<IconDownload size={14} />}
              onClick={() => download(fileName, gameController.exportCurrentPgn())}
            >
              PGN
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
