import { Board } from '../components/Board';
import { OpponentChip } from '../components/Layout';
import {
  IconArrowRight,
  IconCog,
  IconCpu,
  IconHistory,
  IconPlay,
  IconUsers,
} from '../components/icons';
import { useBoardAppearance } from '../components/play/useBoardAppearance';
import { Button, Card } from '../components/ui';
import { listEngines } from '../engines';
import { useGameView } from '../game/instance';
import { useHistory } from '../lib/history';
import { hrefTo, navigate } from '../lib/router';
import { useSettings } from '../lib/settings';

// Posição real (A Imortal, Anderssen–Kieseritzky 1851, antes de 18.Bxe7#) — decorativa.
const HERO_FEN = 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 w - - 1 18';

export function HomePage() {
  const appearance = useBoardAppearance();
  const history = useHistory();
  const s = useSettings();
  const view = useGameView();
  const engines = listEngines();
  const inProgress = view.active && !view.status.over;

  const cards = [
    {
      title: 'Jogar',
      desc: inProgress ? 'Há uma partida em andamento. Continue de onde parou.' : 'Escolha cor e relógio e comece uma partida.',
      icon: <IconPlay size={22} />,
      href: '/play',
      meta: inProgress ? 'Em andamento' : undefined,
    },
    {
      title: 'Escolher adversário',
      desc: 'Stockfish com níveis e limites de cálculo, ou a Chess.js AI básica.',
      icon: <IconUsers size={22} />,
      href: '/opponents',
    },
    {
      title: 'Histórico de partidas',
      desc: 'Reveja, exporte e importe partidas em PGN. Continue partidas salvas.',
      icon: <IconHistory size={22} />,
      href: '/history',
      meta: `${history.length} ${history.length === 1 ? 'partida' : 'partidas'}`,
    },
    {
      title: 'Engines disponíveis',
      desc: 'Veja o que cada adversário é de verdade e teste o carregamento.',
      icon: <IconCpu size={22} />,
      href: '/engines',
      meta: `${engines.length} registradas`,
    },
    {
      title: 'Configurações',
      desc: 'Tema, peças, tabuleiro, animações, som e preferências de jogo.',
      icon: <IconCog size={22} />,
      href: '/settings',
    },
  ];

  return (
    <div>
      <section className="grid items-center gap-10 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-10">
        <div className="rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            100% no navegador · sem servidor
          </p>
          <h1 className="font-display text-5xl leading-[1.02] font-semibold sm:text-6xl xl:text-7xl">
            Xadrez sério,
            <br />
            <span className="text-accent italic">na sua tela.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
            Jogue contra o <strong className="font-semibold text-ink">Stockfish</strong> real, rodando em WebAssembly, ou contra a{' '}
            <strong className="font-semibold text-ink">Chess.js AI</strong>, um adversário básico com lógica própria. Relógios,
            PGN, histórico e um tabuleiro feito para jogar de verdade.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" icon={<IconPlay size={18} />} onClick={() => navigate('/play')} data-testid="cta-play">
              {inProgress ? 'Continuar partida' : 'Jogar agora'}
            </Button>
            <Button variant="outline" size="lg" icon={<IconArrowRight size={18} />} onClick={() => navigate('/opponents')}>
              Escolher adversário
            </Button>
          </div>
          <div className="mt-8 max-w-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Adversário atual</p>
            <OpponentChip />
          </div>
        </div>

        <div className="rise mx-auto w-full max-w-[540px]" style={{ animationDelay: '120ms' }}>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/10 blur-3xl" />
            <Board
              fen={HERO_FEN}
              orientation="w"
              legalMoves={[]}
              lastMove={null}
              checkSquare={null}
              appearance={{ ...appearance, showCoordinates: true }}
              onMove={() => {}}
              label="Posição de demonstração: a Imortal de Anderssen"
            />
          </div>
          <p className="mt-3 text-center text-xs text-muted">A Imortal · Anderssen × Kieseritzky, Londres 1851</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Áreas da plataforma">
        {cards.map((c, i) => (
          <a key={c.href} href={hrefTo(c.href)} className="rise group" style={{ animationDelay: `${180 + i * 60}ms` }}>
            <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50 group-hover:shadow-[0_18px_40px_-24px_var(--c-accent)]">
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent">{c.icon}</span>
                {c.meta && <span className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-medium text-muted">{c.meta}</span>}
              </div>
              <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{c.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                Abrir <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Card>
          </a>
        ))}
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        Stockfish 19 (stockfish.js, GPL-3.0) · regras com chess.js · peças Cburnett e Merida ·{' '}
        {s.sound ? 'som ativado' : 'som desativado'}
      </p>
    </div>
  );
}
