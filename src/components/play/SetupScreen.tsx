import { useMemo } from 'react';
import { getEngineDescriptor, sanitizeSettings } from '../../engines';
import { startConfiguredGame, levelLabelFor } from '../../game/instance';
import { TIME_CONTROLS } from '../../game/timeControls';
import { hrefTo } from '../../lib/router';
import { updateSettings, useSettings, type ColorChoice } from '../../lib/settings';
import { cn } from '../../utils/cn';
import { Board } from '../Board';
import { IconArrowRight, IconBolt, IconClock, IconCpu, IconPlay } from '../icons';
import { Badge, Button, Card, Segmented } from '../ui';
import { useBoardAppearance } from './useBoardAppearance';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function SetupScreen() {
  const s = useSettings();
  const appearance = useBoardAppearance();
  const d = getEngineDescriptor(s.opponentId)!;
  const es = useMemo(() => sanitizeSettings(d, s.engineSettings[d.id]), [d, s.engineSettings]);
  const level = d.levels.find((l) => l.id === es.level);
  const groups = ['Sem limite', 'Bullet', 'Blitz', 'Rápida'] as const;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rise mx-auto w-full max-w-[640px]">
        <Board
          fen={START_FEN}
          orientation={s.playerColor === 'black' ? 'b' : 'w'}
          legalMoves={[]}
          lastMove={null}
          checkSquare={null}
          appearance={appearance}
          onMove={() => {}}
          label="Pré-visualização do tabuleiro"
        />
      </div>

      <Card className="rise p-6" style={{ animationDelay: '80ms' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Nova partida</p>
        <h1 className="font-display mt-1 text-3xl font-semibold">Pronto para jogar?</h1>

        <div className="mt-6 rounded-xl border border-line bg-surface2/60 p-4" data-testid="selected-opponent">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent">
              {d.kind === 'uci-engine' ? <IconBolt size={22} /> : <IconCpu size={22} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Adversário selecionado</p>
              <p className="truncate text-base font-semibold">
                {d.name} <span className="font-normal text-muted">· {levelLabelFor(d.id, es.level)}</span>
              </p>
            </div>
            <a href={hrefTo('/opponents')} className="text-xs font-semibold text-accent hover:underline">
              Alterar
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={d.kind === 'uci-engine' ? 'accent' : 'neutral'}>{d.kindLabel}</Badge>
          </div>
          {level && <p className="mt-2 text-xs leading-relaxed text-muted">{level.description}</p>}
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Jogar com</p>
          <Segmented<ColorChoice>
            className="w-full"
            ariaLabel="Cor das peças"
            value={s.playerColor}
            onChange={(v) => updateSettings({ playerColor: v })}
            options={[
              { value: 'white', label: <span className="inline-flex items-center justify-center gap-2"><span className="h-3 w-3 rounded-full border border-line bg-[#f1ede4]" />Brancas</span> },
              { value: 'random', label: 'Aleatório' },
              { value: 'black', label: <span className="inline-flex items-center justify-center gap-2"><span className="h-3 w-3 rounded-full border border-line bg-[#23262f]" />Pretas</span> },
            ]}
          />
        </div>

        <div className="mt-6">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <IconClock size={16} className="text-muted" /> Controle de tempo
          </p>
          <div className="space-y-3">
            {groups.map((g) => {
              const items = TIME_CONTROLS.filter((t) => t.category === g);
              if (!items.length) return null;
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs text-muted sm:w-20">{g === 'Sem limite' ? '' : g}</span>
                  <div className="flex flex-wrap gap-2">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => updateSettings({ timeControlId: t.id })}
                        aria-pressed={s.timeControlId === t.id}
                        className={cn(
                          'h-9 cursor-pointer rounded-lg border px-3.5 font-mono text-sm font-semibold transition-all',
                          s.timeControlId === t.id
                            ? 'border-accent bg-accent text-accent-ink'
                            : 'border-line bg-surface2 hover:border-accent/60',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="mt-8 w-full"
          icon={<IconPlay size={18} />}
          onClick={() => startConfiguredGame()}
          data-testid="start-game"
        >
          Iniciar partida
        </Button>
        <a
          href={hrefTo('/opponents')}
          className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-ink"
        >
          Ajustar dificuldade e engine <IconArrowRight size={14} />
        </a>
      </Card>
    </div>
  );
}
