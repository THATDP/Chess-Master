import { IconBolt, IconCheck, IconCpu, IconPlay, IconRefresh } from '../components/icons';
import { Badge, Button, Card, PageHeader, RangeField } from '../components/ui';
import {
  defaultSettingsFor,
  getEngineDescriptor,
  listEngines,
  sanitizeSettings,
  type EngineDescriptor,
} from '../engines';
import { navigate } from '../lib/router';
import { updateEngineSettings, updateSettings, useSettings } from '../lib/settings';
import { cn } from '../utils/cn';

export function OpponentsPage() {
  const s = useSettings();
  const engines = listEngines();
  const selected = getEngineDescriptor(s.opponentId) ?? engines[0];
  const es = sanitizeSettings(selected, s.engineSettings[selected.id]);
  const level = selected.levels.find((l) => l.id === es.level);
  const fields = selected.fields.filter((f) => !f.visibleForLevels || f.visibleForLevels.includes(String(es.level)));

  return (
    <div>
      <PageHeader
        eyebrow="Adversário"
        title="Contra quem você quer jogar?"
        subtitle="Cada adversário é independente. Uma engine de verdade calcula posições; o adversário básico apenas usa regras e heurísticas próprias."
      />

      <div className="grid gap-5 md:grid-cols-2" role="radiogroup" aria-label="Adversários disponíveis">
        {engines.map((d, i) => (
          <OpponentCard
            key={d.id}
            d={d}
            selected={d.id === selected.id}
            delay={i * 70}
            levelLabel={d.id === selected.id ? (level?.label ?? 'Personalizado') : undefined}
            onSelect={() => updateSettings({ opponentId: d.id })}
          />
        ))}
      </div>

      <Card className="rise mt-8 p-6" style={{ animationDelay: '160ms' }} data-testid="opponent-config">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Configuração</p>
            <h2 className="font-display mt-1 text-2xl font-semibold">
              {selected.name} <span className="text-muted">· {level?.label ?? 'Personalizado'}</span>
            </h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<IconRefresh size={14} />}
              onClick={() => updateEngineSettings(selected.id, defaultSettingsFor(selected))}
            >
              Restaurar padrão
            </Button>
            <Button variant="primary" icon={<IconPlay size={16} />} onClick={() => navigate('/play')}>
              Jogar contra {selected.shortName}
            </Button>
          </div>
        </div>

        <h3 className="mt-6 mb-3 text-sm font-semibold">Nível de dificuldade</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Nível">
          {selected.levels.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={es.level === l.id}
              onClick={() => updateEngineSettings(selected.id, { level: l.id, ...l.values })}
              data-level={l.id}
              className={cn(
                'cursor-pointer rounded-xl border p-4 text-left transition-all',
                es.level === l.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2/50 hover:border-accent/50',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{l.label}</span>
                {l.strengthHint && <span className="text-[11px] text-muted">{l.strengthHint}</span>}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{l.description}</p>
            </button>
          ))}
        </div>

        {fields.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-1 text-sm font-semibold">Ajustes avançados</h3>
            <p className="mb-3 text-xs text-muted">Alterar qualquer valor muda o nível para “Personalizado”.</p>
            <div className="grid gap-x-10 gap-y-2 md:grid-cols-2">
              {fields.map((f) => (
                <RangeField
                  key={f.key}
                  id={`field-${f.key}`}
                  label={f.label}
                  description={f.description}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  unit={f.unit}
                  value={Number(es[f.key] ?? f.min)}
                  format={
                    f.key === 'depth' && selected.id === 'stockfish'
                      ? (v) => (v === 0 ? 'sem limite' : `${v} plies`)
                      : f.unit === 'ms'
                        ? (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`)
                        : undefined
                  }
                  onChange={(v) => updateEngineSettings(selected.id, { ...es, [f.key]: v, level: 'custom' })}
                />
              ))}
            </div>
          </div>
        )}
        {fields.length === 0 && (
          <p className="mt-6 text-xs text-muted">Este nível não possui ajustes adicionais — o comportamento é fixo e imediato.</p>
        )}
      </Card>
    </div>
  );
}

function OpponentCard({
  d,
  selected,
  onSelect,
  delay,
  levelLabel,
}: {
  d: EngineDescriptor;
  selected: boolean;
  onSelect: () => void;
  delay: number;
  levelLabel?: string;
}) {
  const real = d.kind === 'uci-engine';
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-opponent={d.id}
      className={cn(
        'rise relative flex cursor-pointer flex-col rounded-2xl border p-6 text-left transition-all duration-200',
        selected
          ? 'border-accent bg-surface shadow-[0_20px_50px_-28px_var(--c-accent)] ring-1 ring-accent/60'
          : 'border-line bg-surface/70 hover:border-accent/50',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl', real ? 'bg-accent text-accent-ink' : 'bg-surface2 text-accent')}>
          {real ? <IconBolt size={28} /> : <IconCpu size={28} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">{d.name}</h2>
            {selected && (
              <Badge tone="accent">
                <IconCheck size={12} /> Selecionado
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">{d.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={real ? 'accent' : 'neutral'}>{real ? 'Engine real' : 'Adversário básico'}</Badge>
            {levelLabel && <Badge>{levelLabel}</Badge>}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{d.description}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {d.highlights.map((h) => (
          <li key={h} className="flex gap-2">
            <span className="mt-0.5 text-good">
              <IconCheck size={15} />
            </span>
            {h}
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1.5 text-xs text-muted">
        {d.limitations.map((h) => (
          <li key={h} className="flex gap-2">
            <span className="text-muted">–</span>
            {h}
          </li>
        ))}
      </ul>
    </button>
  );
}
