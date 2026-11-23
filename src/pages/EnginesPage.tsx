import { useState, useSyncExternalStore } from 'react';
import { IconBolt, IconCheck, IconCpu, IconRefresh, IconWarn } from '../components/icons';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import {
  engineManager,
  listEngines,
  sanitizeSettings,
  type EngineDescriptor,
} from '../engines';
import { gameController } from '../game/instance';
import { resolveStockfishUrl } from '../engines/stockfish/transport';
import { updateSettings, useSettings } from '../lib/settings';
import { navigate } from '../lib/router';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'accent' | 'good' | 'bad' }> = {
  idle: { label: 'Não carregada', tone: 'neutral' },
  loading: { label: 'Carregando…', tone: 'accent' },
  ready: { label: 'Pronta', tone: 'good' },
  thinking: { label: 'Calculando', tone: 'accent' },
  error: { label: 'Erro', tone: 'bad' },
};

export function EnginesPage() {
  const engines = listEngines();
  return (
    <div>
      <PageHeader
        eyebrow="Engines"
        title="Adversários disponíveis"
        subtitle="Somente adversários reais estão listados. Cada um é carregado sob demanda por um adaptador independente, registrado em um catálogo central."
      />
      <div className="space-y-5">
        {engines.map((d, i) => (
          <EngineCard key={d.id} d={d} delay={i * 70} />
        ))}
      </div>

      <Card className="rise mt-8 p-6">
        <h2 className="text-base font-semibold">Como a arquitetura funciona</h2>
        <ol className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Registro', 'engines/registry.ts guarda os descritores (id, nome, tipo, níveis, capacidades).'],
            ['Adaptador', 'Cada engine implementa EngineAdapter: init, newGame, requestMove, stop, dispose.'],
            ['Gerenciador', 'EngineManager carrega sob demanda, cancela cálculos e trata erros.'],
            ['Partida', 'GameController só conhece o gerenciador — nunca Stockfish ou Chess.js AI.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-xl border border-line bg-surface2/50 p-4">
              <p className="font-semibold text-ink">{t}</p>
              <p className="mt-1 text-xs leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function EngineCard({ d, delay }: { d: EngineDescriptor; delay: number }) {
  const s = useSettings();
  useSyncExternalStore(engineManager.subscribe.bind(engineManager), () => engineManager.getVersion());
  const adapter = engineManager.peek(d.id);
  const status = adapter?.status ?? 'idle';
  const st = STATUS[status];
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const real = d.kind === 'uci-engine';
  const isSelected = s.opponentId === d.id;

  const test = async () => {
    setTesting(true);
    setResult(null);
    const t0 = performance.now();
    try {
      // Reinicia para medir um carregamento real.
      const gv = gameController.getView();
      const inUse = gv.active && !gv.status.over && gv.config?.engineId === d.id;
      if (!inUse) engineManager.dispose(d.id); // não derruba a engine de uma partida em andamento
      await engineManager.prepare(d.id, sanitizeSettings(d, s.engineSettings[d.id]));
      const a = engineManager.peek(d.id);
      setResult(
        `Carregada em ${Math.round(performance.now() - t0)} ms${a?.runtime.reportedName ? ` · ${a.runtime.reportedName}` : ''}.`,
      );
    } catch (e) {
      setResult(`Falha: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  const rows: [string, string][] = [
    ['Tipo', d.kindLabel],
    ['Versão', d.version],
    ['Autoria', d.author],
    ['Licença', d.license],
    ['Níveis', d.levels.map((l) => l.label).join(' · ')],
    ['Avaliação da posição', d.capabilities.evaluation ? 'Sim' : 'Não'],
    ['Variante principal (PV)', d.capabilities.principalVariation ? 'Sim' : 'Não'],
    ['Controle de profundidade / tempo', `${d.capabilities.depthControl ? 'Profundidade' : '—'} · ${d.capabilities.timeControl ? 'Tempo' : '—'}`],
    ['Execução', d.capabilities.offMainThread ? 'Web Worker (fora da thread da interface)' : 'Thread principal'],
  ];
  if (real) rows.push(['Arquivos', resolveStockfishUrl().replace(/^https?:\/\/[^/]+/, '') + ' + .wasm']);

  return (
    <Card className="rise p-6" style={{ animationDelay: `${delay}ms` }} data-engine={d.id}>
      <div className="flex flex-wrap items-start gap-4">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${real ? 'bg-accent text-accent-ink' : 'bg-surface2 text-accent'}`}>
          {real ? <IconBolt size={28} /> : <IconCpu size={28} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">{d.name}</h2>
            <Badge tone={real ? 'accent' : 'neutral'}>{real ? 'Engine real (UCI)' : 'Adversário básico'}</Badge>
            <Badge tone={st.tone}>{st.label}</Badge>
            {isSelected && (
              <Badge tone="good">
                <IconCheck size={12} /> Selecionado
              </Badge>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{d.description}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 border-b border-line/60 py-1.5">
            <dt className="w-44 shrink-0 text-muted">{k}</dt>
            <dd className="min-w-0 break-words font-medium">{v}</dd>
          </div>
        ))}
        {adapter?.runtime.reportedName && (
          <div className="flex gap-3 border-b border-line/60 py-1.5">
            <dt className="w-44 shrink-0 text-muted">Reportado em execução</dt>
            <dd className="font-medium">{adapter.runtime.reportedName}</dd>
          </div>
        )}
        {adapter?.runtime.loadTimeMs !== undefined && (
          <div className="flex gap-3 border-b border-line/60 py-1.5">
            <dt className="w-44 shrink-0 text-muted">Tempo de carregamento</dt>
            <dd className="font-medium">{adapter.runtime.loadTimeMs} ms</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" icon={<IconRefresh size={14} />} onClick={test} disabled={testing}>
          {testing ? 'Carregando…' : 'Testar carregamento'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => engineManager.dispose(d.id)} disabled={!adapter || status === 'idle'}>
          Encerrar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            updateSettings({ opponentId: d.id });
            navigate('/opponents');
          }}
        >
          Configurar e selecionar
        </Button>
        {result && (
          <span className={`flex items-center gap-1.5 text-xs ${result.startsWith('Falha') ? 'text-bad' : 'text-good'}`} role="status">
            {result.startsWith('Falha') ? <IconWarn size={14} /> : <IconCheck size={14} />}
            {result}
          </span>
        )}
        {adapter?.lastError && !result && <span className="text-xs text-bad">{adapter.lastError}</span>}
      </div>
    </Card>
  );
}
