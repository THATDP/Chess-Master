import { getEngineDescriptor, listEngines } from '../../engines';
import type { GameView } from '../../game/GameController';
import { gameController, levelLabelFor } from '../../game/instance';
import { sanitizeSettings } from '../../engines';
import { formatEval, formatNumber, pvToSan } from '../../lib/format';
import { Badge, Button, Card, ThinkingDots } from '../ui';
import { IconBolt, IconCpu, IconRefresh, IconWarn } from '../icons';

const STATUS_LABEL = {
  idle: 'Em espera',
  loading: 'Carregando…',
  ready: 'Pronto',
  thinking: 'Pensando',
  error: 'Erro',
} as const;

/** Painel do adversário: identidade, estado, avaliação e variante principal. */
export function EnginePanel({ view, showEval }: { view: GameView; showEval: boolean }) {
  const cfg = view.config;
  if (!cfg) return null;
  const d = getEngineDescriptor(cfg.engineId);
  if (!d) return null;
  const info = view.engineInfo;
  const evalText = formatEval(info);
  const pv = info?.fen ? pvToSan(info.fen, info.pv, 7) : [];
  const alternatives = listEngines().filter((e) => e.id !== cfg.engineId);
  const status = view.engineError ? 'error' : view.thinking ? 'thinking' : view.engineStatus;
  const tone = status === 'error' ? 'bad' : status === 'thinking' ? 'accent' : status === 'ready' ? 'good' : 'neutral';

  return (
    <Card className="p-4" data-testid="engine-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
          {d.kind === 'uci-engine' ? <IconBolt size={20} /> : <IconCpu size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{cfg.engineName}</h3>
            <Badge tone="neutral">{cfg.levelLabel}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted">{d.kindLabel}</p>
        </div>
        <Badge tone={tone} className="shrink-0" >
          {status === 'thinking' ? <ThinkingDots /> : null}
          <span data-testid="engine-status">{STATUS_LABEL[status]}</span>
        </Badge>
      </div>

      {view.engineError && (
        <div className="mt-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-xs" role="alert">
          <p className="flex items-start gap-2 font-medium text-bad">
            <IconWarn size={16} className="mt-px shrink-0" />
            <span>{view.engineError}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<IconRefresh size={14} />} onClick={() => gameController.retryEngine()}>
              Tentar novamente
            </Button>
            {alternatives.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant="outline"
                onClick={() => {
                  const s = sanitizeSettings(a, undefined);
                  gameController.switchEngine({
                    engineId: a.id,
                    engineName: a.name,
                    levelLabel: levelLabelFor(a.id, s.level),
                    engineSettings: s,
                  });
                }}
              >
                Jogar contra {a.shortName}
              </Button>
            ))}
          </div>
        </div>
      )}

      {showEval && d.capabilities.evaluation && (
        <div className="pm-stats mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Avaliação" value={evalText ?? '—'} strong />
          <Stat label="Profundidade" value={info?.depth !== undefined ? String(info.depth) : '—'} />
          <Stat label="Nós" value={formatNumber(info?.nodes)} />
        </div>
      )}
      {showEval && pv.length > 0 && (
        <p className="pm-pv mt-3 truncate font-mono text-xs text-muted" title={pv.join(' ')}>
          <span className="mr-1.5 font-sans font-semibold text-ink/70">Variante:</span>
          {pv.join(' ')}
        </p>
      )}
      {info?.note && <p className="mt-2 text-xs text-muted">{info.note}</p>}
      {!d.capabilities.evaluation && (
        <p className="mt-3 text-xs text-muted">Este adversário não fornece avaliação numérica da posição.</p>
      )}
    </Card>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-surface2 px-2 py-2">
      <div className={`font-mono ${strong ? 'text-base font-bold text-accent' : 'text-sm font-semibold'}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
