import { useState } from 'react';
import { Board } from '../components/Board';
import { IconMoon, IconSun, IconTrash, IconVolume } from '../components/icons';
import { PieceIcon } from '../components/pieces';
import { useBoardAppearance } from '../components/play/useBoardAppearance';
import { Button, Card, PageHeader, RangeField, Segmented, Toggle } from '../components/ui';
import { TIME_CONTROLS } from '../game/timeControls';
import { clearHistory, useHistory } from '../lib/history';
import {
  BOARD_THEMES,
  PIECE_SETS,
  defaultSettings,
  settingsStore,
  updateSettings,
  useSettings,
  type AnimationSpeed,
  type ColorChoice,
  type ThemeMode,
} from '../lib/settings';
import { playSound } from '../lib/sound';
import { cn } from '../utils/cn';

const PREVIEW_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 5';

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="rise p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-xs text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const appearance = useBoardAppearance();
  const history = useHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Configurações"
        title="Deixe do seu jeito"
        subtitle="As preferências são salvas automaticamente neste navegador (localStorage)."
        actions={
          <Button variant="outline" onClick={() => settingsStore.set(defaultSettings())}>
            Restaurar padrões
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Section title="Tema">
            <Segmented<ThemeMode>
              ariaLabel="Tema"
              value={s.theme}
              onChange={(v) => updateSettings({ theme: v })}
              options={[
                { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><IconMoon size={15} /> Escuro</span> },
                { value: 'light', label: <span className="inline-flex items-center gap-1.5"><IconSun size={15} /> Claro</span> },
              ]}
            />
          </Section>

          <Section title="Peças" desc="Conjuntos de peças incluídos no aplicativo.">
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Conjunto de peças">
              {PIECE_SETS.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={s.pieceSet === p.id}
                  onClick={() => updateSettings({ pieceSet: p.id })}
                  data-piece-set={p.id}
                  className={cn(
                    'cursor-pointer rounded-xl border p-3 text-center transition-all',
                    s.pieceSet === p.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2/50 hover:border-accent/50',
                  )}
                >
                  <div className="flex h-12 items-center justify-center pl-3">
                    <PieceIcon set={p.id} color="w" type="n" size={44} />
                    <PieceIcon set={p.id} color="b" type="q" size={44} />
                  </div>
                  <div className="mt-2 text-sm font-semibold">{p.label}</div>
                  <div className="text-[10px] text-muted">{p.credit}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Tabuleiro">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="radiogroup" aria-label="Tema do tabuleiro">
              {BOARD_THEMES.map((b) => (
                <button
                  key={b.id}
                  role="radio"
                  aria-checked={s.boardTheme === b.id}
                  onClick={() => updateSettings({ boardTheme: b.id })}
                  data-board-theme={b.id}
                  className={cn(
                    'cursor-pointer rounded-xl border p-2.5 transition-all',
                    s.boardTheme === b.id ? 'border-accent bg-accent/10' : 'border-line bg-surface2/50 hover:border-accent/50',
                  )}
                >
                  <div className="grid aspect-square grid-cols-4 overflow-hidden rounded-md">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 ? b.dark : b.light }} />
                    ))}
                  </div>
                  <div className="mt-2 text-center text-xs font-semibold">{b.label}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Animações e som">
            <p className="mb-2 text-sm font-medium">Velocidade das animações</p>
            <Segmented<AnimationSpeed>
              ariaLabel="Velocidade das animações"
              value={s.animationSpeed}
              onChange={(v) => updateSettings({ animationSpeed: v })}
              options={[
                { value: 'off', label: 'Desligada' },
                { value: 'fast', label: 'Rápida' },
                { value: 'normal', label: 'Normal' },
                { value: 'slow', label: 'Lenta' },
              ]}
            />
            <div className="mt-4 divide-y divide-line">
              <Toggle checked={s.sound} onChange={(v) => updateSettings({ sound: v })} label="Sons dos lances" description="Movimentos, capturas, xeque, roque e fim de partida." />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <RangeField
                  id="volume"
                  label="Volume"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(s.volume * 100)}
                  format={(v) => `${v}%`}
                  onChange={(v) => updateSettings({ volume: v / 100 })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-1"
                icon={<IconVolume size={14} />}
                onClick={() => playSound('capture', s.volume)}
                disabled={!s.sound}
              >
                Testar
              </Button>
            </div>
          </Section>

          <Section title="Preferências de jogo">
            <div className="divide-y divide-line">
              <Toggle checked={s.showLegalMoves} onChange={(v) => updateSettings({ showLegalMoves: v })} label="Mostrar lances possíveis" description="Pontos e anéis nas casas de destino." />
              <Toggle checked={s.highlightLastMove} onChange={(v) => updateSettings({ highlightLastMove: v })} label="Destacar último lance" />
              <Toggle checked={s.showCoordinates} onChange={(v) => updateSettings({ showCoordinates: v })} label="Mostrar coordenadas" />
              <Toggle checked={s.autoQueen} onChange={(v) => updateSettings({ autoQueen: v })} label="Promover sempre a dama" description="Pula o seletor visual de promoção." />
              <Toggle checked={s.allowUndo} onChange={(v) => updateSettings({ allowUndo: v })} label="Permitir desfazer" />
              <Toggle checked={s.showEval} onChange={(v) => updateSettings({ showEval: v })} label="Mostrar avaliação da engine" description="Barra de avaliação, profundidade e variante (quando disponível)." />
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Cor padrão</p>
                <Segmented<ColorChoice>
                  ariaLabel="Cor padrão"
                  value={s.playerColor}
                  onChange={(v) => updateSettings({ playerColor: v })}
                  options={[
                    { value: 'white', label: 'Brancas' },
                    { value: 'random', label: 'Aleatório' },
                    { value: 'black', label: 'Pretas' },
                  ]}
                />
              </div>
              <div>
                <label htmlFor="tc" className="mb-2 block text-sm font-medium">
                  Controle de tempo padrão
                </label>
                <select
                  id="tc"
                  value={s.timeControlId}
                  onChange={(e) => updateSettings({ timeControlId: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-xl border border-line bg-surface2 px-3 text-sm"
                >
                  {TIME_CONTROLS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                      {t.category !== 'Sem limite' ? ` · ${t.category}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted">
              A dificuldade de cada adversário é configurada na tela <a className="font-semibold text-accent hover:underline" href="#/opponents">Adversário</a>.
            </p>
          </Section>

          <Section title="Dados" desc="Tudo fica apenas neste navegador.">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={confirmClear ? 'danger' : 'outline'}
                icon={<IconTrash size={16} />}
                disabled={history.length === 0}
                onClick={() => {
                  if (confirmClear) {
                    clearHistory();
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 4000);
                  }
                }}
              >
                {confirmClear ? 'Confirmar: apagar tudo' : `Apagar histórico (${history.length})`}
              </Button>
            </div>
          </Section>
        </div>

        <div className="xl:sticky xl:top-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pré-visualização</p>
          <Board
            fen={PREVIEW_FEN}
            orientation="w"
            legalMoves={[]}
            lastMove={null}
            checkSquare={null}
            appearance={appearance}
            onMove={() => {}}
            label="Pré-visualização do tabuleiro"
          />
        </div>
      </div>
    </div>
  );
}
