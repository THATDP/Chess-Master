import { useRef, useState } from 'react';
import {
  IconCopy,
  IconDownload,
  IconPlay,
  IconSwords,
  IconTrash,
  IconUpload,
  IconUsers,
} from '../components/icons';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import { resumeSavedGame } from '../game/instance';
import { parsePgn, pgnFileName, resultFromHeaders, splitPgnGames } from '../game/pgn';
import { resultLabel } from '../game/status';
import { getTimeControl } from '../game/timeControls';
import { copyText, download, formatDate } from '../lib/format';
import { newId, removeGame, upsertGame, useHistory, type SavedGame } from '../lib/history';
import { hrefTo, navigate } from '../lib/router';

export function HistoryPage() {
  const games = useHistory();
  const [text, setText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const importText = (src: string) => {
    const chunks = splitPgnGames(src);
    if (chunks.length === 0) {
      setMsg({ ok: false, text: 'Cole um PGN ou escolha um arquivo.' });
      return;
    }
    let ok = 0;
    const errors: string[] = [];
    chunks.forEach((c, i) => {
      try {
        const p = parsePgn(c);
        const now = Date.now() - i;
        upsertGame({
          id: newId(),
          createdAt: parseDate(p.headers.Date) ?? now,
          pgn: p.pgn,
          white: p.headers.White && p.headers.White !== '?' ? p.headers.White : 'Brancas',
          black: p.headers.Black && p.headers.Black !== '?' ? p.headers.Black : 'Pretas',
          result: resultFromHeaders(p.headers, p.chess),
          reason: p.headers.Termination,
          plies: p.plies,
          finalFen: p.chess.fen(),
          imported: true,
        });
        ok++;
      } catch (e) {
        errors.push(`Partida ${i + 1}: ${(e as Error).message}`);
      }
    });
    if (ok > 0) {
      setText('');
      setShowImport(false);
    }
    setMsg({
      ok: ok > 0 && errors.length === 0,
      text: `${ok} ${ok === 1 ? 'partida importada' : 'partidas importadas'}${errors.length ? ` · ${errors.length} com erro. ${errors[0]}` : '.'}`,
    });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    importText(await f.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportAll = () => download(`chess-master-historico.pgn`, games.map((g) => g.pgn).join('\n\n') + '\n');

  return (
    <div>
      <PageHeader
        eyebrow="Histórico"
        title="Suas partidas"
        subtitle="As partidas são salvas automaticamente. Reproduza lance a lance, exporte em PGN, importe de outros sites ou continue uma partida inacabada."
        actions={
          <>
            <Button variant="outline" icon={<IconUpload size={16} />} onClick={() => setShowImport((v) => !v)} data-testid="toggle-import">
              Importar PGN
            </Button>
            <Button variant="outline" icon={<IconDownload size={16} />} onClick={exportAll} disabled={games.length === 0}>
              Exportar tudo
            </Button>
          </>
        }
      />

      {showImport && (
        <Card className="rise mb-6 p-5">
          <label htmlFor="pgn-text" className="text-sm font-semibold">
            Colar PGN
          </label>
          <textarea
            id="pgn-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={'[Event "Minha partida"]\n[White "Ana"]\n[Black "Beto"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'}
            className="mt-2 w-full resize-y rounded-xl border border-line bg-surface2 p-3 font-mono text-sm outline-none focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => importText(text)} data-testid="import-confirm">
              Importar
            </Button>
            <input ref={fileRef} type="file" accept=".pgn,.txt,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-file" />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Escolher arquivo .pgn
            </Button>
            <span className="text-xs text-muted">Aceita vários jogos no mesmo arquivo.</span>
          </div>
        </Card>
      )}

      {msg && (
        <p
          role="status"
          className={`fade-in mb-5 rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-good/40 bg-good/10 text-good' : 'border-bad/40 bg-bad/10 text-bad'}`}
        >
          {msg.text}
        </p>
      )}

      {games.length === 0 ? (
        <Card className="rise grid place-items-center px-6 py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/12 text-accent">
            <IconSwords size={26} />
          </div>
          <h2 className="font-display mt-4 text-2xl font-semibold">Nenhuma partida ainda</h2>
          <p className="mt-2 max-w-sm text-sm text-muted">Jogue uma partida ou importe um PGN — ela aparecerá aqui.</p>
          <div className="mt-5 flex gap-2">
            <Button variant="primary" icon={<IconPlay size={16} />} onClick={() => navigate('/play')}>
              Jogar
            </Button>
            <Button variant="outline" icon={<IconUpload size={16} />} onClick={() => setShowImport(true)}>
              Importar PGN
            </Button>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="history-list">
          {games.map((g) => (
            <GameRow
              key={g.id}
              g={g}
              copied={copied === g.id}
              onCopy={async () => {
                if (await copyText(g.pgn)) {
                  setCopied(g.id);
                  setTimeout(() => setCopied(null), 1500);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function parseDate(d?: string): number | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})\.(\d{2}|\?\?)\.(\d{2}|\?\?)$/);
  if (!m) return null;
  const t = new Date(Number(m[1]), m[2] === '??' ? 0 : Number(m[2]) - 1, m[3] === '??' ? 1 : Number(m[3])).getTime();
  return Number.isFinite(t) ? t : null;
}

function GameRow({ g, onCopy, copied }: { g: SavedGame; onCopy: () => void; copied: boolean }) {
  const tone = g.result === '*' ? 'accent' : g.result === '1/2-1/2' ? 'neutral' : 'good';
  const tc = g.timeControlId && g.timeControlId !== 'unlimited' ? getTimeControl(g.timeControlId).label : null;
  const [confirm, setConfirm] = useState(false);
  return (
    <li>
      <Card className="rise flex flex-wrap items-center gap-4 p-4 transition hover:border-accent/40" data-testid="history-item">
        <div className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-surface2 font-mono text-sm font-bold">
          {resultLabel(g.result) === 'Em andamento' ? '…' : resultLabel(g.result)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-line bg-[#f1ede4]" /> {g.white}
            <span className="mx-2 text-muted">×</span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-line bg-[#23262f]" /> {g.black}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{formatDate(g.createdAt)}</span>
            <span>{Math.ceil(g.plies / 2)} lances</span>
            {tc && <span className="font-mono">{tc}</span>}
            {g.opponentName && (
              <span className="inline-flex items-center gap-1">
                <IconUsers size={12} /> {g.opponentName}
              </span>
            )}
            {g.reason && <span>{g.reason}</span>}
            {g.imported && <Badge>Importada</Badge>}
            {g.result === '*' && <Badge tone={tone}>Inacabada</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={hrefTo(`/history/${encodeURIComponent(g.id)}`)}>
            <Button size="sm" variant="primary" icon={<IconPlay size={14} />} data-testid="replay-btn">
              Reproduzir
            </Button>
          </a>
          {g.result === '*' && (
            <Button
              size="sm"
              variant="secondary"
              data-testid="resume-btn"
              onClick={() => {
                resumeSavedGame(g);
                navigate('/play');
              }}
            >
              Continuar
            </Button>
          )}
          <Button size="sm" variant="outline" icon={<IconDownload size={14} />} onClick={() => download(pgnFileName(g.white, g.black, new Date(g.createdAt)), g.pgn)}>
            PGN
          </Button>
          <Button size="sm" variant="ghost" icon={<IconCopy size={14} />} onClick={onCopy} aria-label="Copiar PGN">
            {copied ? 'Copiado' : ''}
          </Button>
          <Button
            size="sm"
            variant={confirm ? 'danger' : 'ghost'}
            icon={<IconTrash size={14} />}
            aria-label="Excluir partida"
            onClick={() => {
              if (confirm) removeGame(g.id);
              else {
                setConfirm(true);
                setTimeout(() => setConfirm(false), 3000);
              }
            }}
          >
            {confirm ? 'Excluir?' : ''}
          </Button>
        </div>
      </Card>
    </li>
  );
}
