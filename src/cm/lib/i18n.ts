import { prefsStore, type LangPref } from './prefs';

/**
 * Internacionalização. Para adicionar um idioma: crie um dicionário (mesmas chaves de `pt`),
 * registre em DICTS e inclua em LANGS. Chaves ausentes caem para o português.
 */
export type Lang = 'pt' | 'en';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
];

type Entry = [key: string, pt: string, en: string];

const E: Entry[] = [
  // categorias
  ['cat.layout', 'Layout e navegação', 'Layout & navigation'],
  ['cat.appearance', 'Aparência', 'Appearance'],
  ['cat.game', 'Experiência de jogo', 'Game experience'],
  ['cat.engines', 'Engines', 'Engines'],
  ['cat.a11y', 'Acessibilidade e desempenho', 'Accessibility & performance'],
  ['cat.advanced', 'Avançado', 'Advanced'],
  ['cat.profiles', 'Perfis', 'Profiles'],
  // página
  ['set.eyebrow', 'Configurações', 'Settings'],
  ['set.title', 'Deixe do seu jeito', 'Make it yours'],
  ['set.subtitle', 'Tudo é salvo automaticamente neste navegador e aplicado na hora.', 'Everything is saved automatically in this browser and applied instantly.'],
  ['set.search', 'Pesquisar preferências…', 'Search preferences…'],
  ['set.noResults', 'Nenhuma preferência encontrada.', 'No preferences found.'],
  ['set.reset', 'Restaurar', 'Reset'],
  ['set.resetAll', 'Restaurar tudo', 'Reset everything'],
  ['set.resetAllConfirm', 'Restaurar TODAS as preferências do perfil atual? (partidas e histórico não são afetados)', 'Reset ALL preferences of the current profile? (games and history are not affected)'],
  ['set.autosave', 'Salvo automaticamente', 'Saved automatically'],
  ['set.preview', 'Pré-visualização ao vivo', 'Live preview'],
  ['set.language', 'Idioma', 'Language'],
  ['set.langAuto', 'Automático (navegador)', 'Automatic (browser)'],
  ['set.classic', 'Opções clássicas (tema, peças, tabuleiro, animações, som, partida)', 'Classic options (theme, pieces, board, animations, sound, game)'],
  ['set.quickAppearance', 'Atalhos de aparência', 'Appearance quick picks'],
  ['set.themeMode', 'Tema claro/escuro', 'Light/dark theme'],
  ['set.dark', 'Escuro', 'Dark'],
  ['set.light', 'Claro', 'Light'],
  ['set.pieceSet', 'Conjunto de peças', 'Piece set'],
  ['set.boardTheme', 'Tema do tabuleiro', 'Board theme'],
  ['set.customColors', 'Cores personalizadas', 'Custom colors'],
  ['set.customColorsHint', 'Vazio = cor do tema. Aceita HEX (#aabbcc) ou RGB (r, g, b).', 'Empty = theme color. Accepts HEX (#aabbcc) or RGB (r, g, b).'],
  ['set.clear', 'Limpar', 'Clear'],
  ['set.engineSettings', 'Configurações por engine', 'Per-engine settings'],
  ['set.engineSettingsHint', 'Cada engine tem a sua configuração; alterar uma nunca muda outra.', 'Each engine has its own settings; changing one never affects another.'],
  ['set.defaultEngine', 'Engine padrão', 'Default engine'],
  ['set.level', 'Nível', 'Level'],
  ['set.custom', 'Personalizado', 'Custom'],
  ['set.defaultClock', 'Controle de tempo padrão', 'Default time control'],
  ['set.shortcuts', 'Atalhos de teclado', 'Keyboard shortcuts'],
  ['set.shortcutsHint', 'Clique em uma combinação e pressione as novas teclas. Esc cancela. Atalhos não funcionam ao digitar em campos de texto.', 'Click a combination and press the new keys. Esc cancels. Shortcuts are ignored while typing in text fields.'],
  ['set.shortcutsReset', 'Restaurar atalhos originais', 'Restore default shortcuts'],
  ['set.press', 'Pressione as teclas…', 'Press the keys…'],
  ['set.conflict', 'Conflito: esta combinação já é usada por “{name}”.', 'Conflict: this combination is already used by “{name}”.'],
  ['set.none', 'Nenhum', 'None'],
  // perfis
  ['prof.title', 'Perfis de preferências', 'Preference profiles'],
  ['prof.hint', 'Cada perfil é independente. Trocar de perfil nunca reinicia uma partida em andamento.', 'Each profile is independent. Switching profiles never restarts a game in progress.'],
  ['prof.active', 'Ativo', 'Active'],
  ['prof.default', 'Padrão', 'Default'],
  ['prof.use', 'Usar', 'Use'],
  ['prof.setDefault', 'Definir como padrão', 'Set as default'],
  ['prof.rename', 'Renomear', 'Rename'],
  ['prof.duplicate', 'Duplicar', 'Duplicate'],
  ['prof.delete', 'Excluir', 'Delete'],
  ['prof.export', 'Exportar', 'Export'],
  ['prof.restore', 'Restaurar', 'Restore'],
  ['prof.create', 'Criar perfil', 'Create profile'],
  ['prof.newName', 'Nome do novo perfil', 'New profile name'],
  ['prof.import', 'Importar perfil (arquivo JSON)', 'Import profile (JSON file)'],
  ['prof.importText', 'Ou cole o JSON aqui', 'Or paste the JSON here'],
  ['prof.importBtn', 'Importar', 'Import'],
  ['prof.deleteConfirm', 'Excluir o perfil “{name}”?', 'Delete profile “{name}”?'],
  ['prof.lastOne', 'Não é possível excluir o último perfil.', 'The last profile cannot be deleted.'],
  ['prof.builtin.custom', 'Personalizado', 'Custom'],
  ['prof.builtin.analysis', 'Análise', 'Analysis'],
  ['prof.builtin.minimal', 'Minimalista', 'Minimal'],
  ['prof.builtin.competitive', 'Competitivo', 'Competitive'],
  // avançado
  ['adv.export', 'Exportar todas as preferências', 'Export all preferences'],
  ['adv.import', 'Importar preferências', 'Import preferences'],
  ['adv.schema', 'Versão do esquema de preferências: {n}', 'Preferences schema version: {n}'],
  ['adv.storage', 'Armazenamento local', 'Local storage'],
  ['adv.storageOk', 'disponível', 'available'],
  ['adv.storageFail', 'indisponível — usando padrões nesta sessão', 'unavailable — using defaults for this session'],
  ['adv.engines', 'Engines carregadas', 'Loaded engines'],
  ['adv.disposeEngines', 'Encerrar todas as engines carregadas', 'Shut down all loaded engines'],
  ['adv.tutorial', 'Tutorial', 'Tutorial'],
  ['adv.startTutorial', 'Iniciar tutorial', 'Start tutorial'],
  ['adv.note', 'Restaurar preferências nunca apaga partidas nem o histórico.', 'Restoring preferences never deletes games or history.'],
  // notificações
  ['toast.profileSwitched', 'Perfil “{name}” ativado', 'Profile “{name}” activated'],
  ['toast.imported', '{n} perfil(is) importado(s)', '{n} profile(s) imported'],
  ['toast.importError', 'Importação falhou: {err}', 'Import failed: {err}'],
  ['toast.reset', 'Preferências restauradas', 'Preferences restored'],
  ['toast.err.invalid-json', 'JSON inválido', 'invalid JSON'],
  ['toast.err.invalid-file', 'arquivo não é do Chess Master', 'not a Chess Master file'],
  ['toast.err.newer-schema', 'versão mais nova que a suportada', 'newer than supported'],
  ['toast.err.file-too-large', 'arquivo muito grande', 'file too large'],
  ['toast.focusOn', 'Modo foco ativado (Z para sair)', 'Focus mode on (press Z to exit)'],
  ['toast.fenCopied', 'FEN copiado', 'FEN copied'],
  ['toast.engineDisposed', 'Engines encerradas', 'Engines shut down'],
  ['toast.confirmMove', 'Confirmar o lance {move}?', 'Confirm move {move}?'],
  // jogo
  ['play.confirm', 'Confirmar', 'Confirm'],
  ['play.cancel', 'Cancelar', 'Cancel'],
  ['focus.exit', 'Sair do modo foco', 'Exit focus mode'],
  ['nav.menu', 'Menu', 'Menu'],
  ['nav.skip', 'Pular para o conteúdo', 'Skip to content'],
  ['nav.tutorial', 'Tutorial', 'Tutorial'],
  // tutorial
  ['tut.title', 'Tutorial', 'Tutorial'],
  ['tut.skip', 'Agora não', 'Not now'],
  ['tut.close', 'Fechar', 'Close'],
  ['tut.prev', 'Anterior', 'Previous'],
  ['tut.next', 'Próximo', 'Next'],
  ['tut.done', 'Concluir', 'Finish'],
  ['tut.go', 'Abrir esta tela', 'Open this screen'],
  ['tut.banner', 'Novo por aqui? Faça um tour rápido (opcional).', 'New here? Take a quick tour (optional).'],
  ['tut.start', 'Iniciar tutorial', 'Start tutorial'],
  ['tut.step', 'Etapa {n} de {total}', 'Step {n} of {total}'],
  ['tut.0.t', 'Bem-vindo ao Chess Master', 'Welcome to Chess Master'],
  ['tut.0.b', 'Uma plataforma de xadrez que roda 100% no seu navegador, com engines reais e muita personalização. Este tutorial é opcional e pode ser reaberto quando quiser (tecla ?).', 'A chess platform that runs 100% in your browser, with real engines and lots of customization. This tutorial is optional and can be reopened any time (press ?).'],
  ['tut.1.t', 'Como iniciar uma partida', 'How to start a game'],
  ['tut.1.b', 'Em “Jogar”, escolha sua cor e o controle de tempo e toque em iniciar. Arraste as peças ou clique na peça e depois na casa de destino.', 'In “Play”, choose your color and time control, then start. Drag pieces or click a piece and then its destination square.'],
  ['tut.2.t', 'Como escolher engines', 'How to choose engines'],
  ['tut.2.b', 'Em “Adversário” você escolhe entre Stockfish, Chess.js AI e Lozza e ajusta o nível. Cada engine só é baixada quando você a usa.', 'In “Opponent” you pick Stockfish, Chess.js AI or Lozza and set the level. Each engine is only downloaded when you use it.'],
  ['tut.3.t', 'Usando o Stockfish', 'Using Stockfish'],
  ['tut.3.b', 'Engine UCI real em WebAssembly. Ajuste Skill Level, profundidade e tempo por lance. Mostra avaliação, profundidade e a variante principal.', 'A real UCI engine in WebAssembly. Adjust Skill Level, depth and time per move. Shows evaluation, depth and principal variation.'],
  ['tut.4.t', 'Usando a Chess.js AI', 'Using Chess.js AI'],
  ['tut.4.b', 'Motor próprio (alfa-beta) sobre o chess.js, com níveis Fácil, Normal e Difícil. No Difícil você controla profundidade, tempo e memória.', 'Own search engine (alpha-beta) on top of chess.js, with Easy, Normal and Hard levels. On Hard you control depth, time and memory.'],
  ['tut.5.t', 'Como configurar preferências', 'How to configure preferences'],
  ['tut.5.b', 'Em “Ajustes” há seis categorias, pesquisa, pré-visualização ao vivo e botão de restaurar em cada opção. Tudo é salvo automaticamente.', 'In “Settings” there are six categories, search, live preview and a reset button on every option. Everything is saved automatically.'],
  ['tut.6.t', 'Como criar perfis', 'How to create profiles'],
  ['tut.6.b', 'Na aba Perfis crie, renomeie, duplique, exporte e importe perfis. Trocar de perfil não reinicia a partida em andamento.', 'In the Profiles tab create, rename, duplicate, export and import profiles. Switching profiles does not restart the game in progress.'],
  ['tut.7.t', 'Como personalizar o layout', 'How to customize the layout'],
  ['tut.7.b', 'Em Layout e navegação escolha navegação lateral/superior, densidade, posição dos painéis e modo foco. As mudanças aparecem na hora.', 'Under Layout & navigation choose side/top navigation, density, panel positions and focus mode. Changes appear instantly.'],
  ['tut.8.t', 'Ferramentas de análise', 'Analysis tools'],
  ['tut.8.b', 'Use a barra de avaliação, a variante principal, o histórico clicável e “Copiar FEN/PGN”. Em Histórico você revê partidas salvas lance a lance.', 'Use the evaluation bar, principal variation, clickable move list and “Copy FEN/PGN”. In History you can replay saved games move by move.'],
  // atalhos
  ['sc.flip', 'Virar tabuleiro', 'Flip board'],
  ['sc.undo', 'Desfazer lance', 'Undo move'],
  ['sc.newGame', 'Nova partida', 'New game'],
  ['sc.prev', 'Lance anterior', 'Previous move'],
  ['sc.next', 'Próximo lance', 'Next move'],
  ['sc.first', 'Primeiro lance', 'First move'],
  ['sc.last', 'Último lance', 'Last move'],
  ['sc.copyFen', 'Copiar FEN', 'Copy FEN'],
  ['sc.toggleTheme', 'Alternar tema claro/escuro', 'Toggle light/dark theme'],
  ['sc.toggleFocus', 'Alternar modo foco', 'Toggle focus mode'],
  ['sc.goHome', 'Ir para Início', 'Go to Home'],
  ['sc.goPlay', 'Ir para Jogar', 'Go to Play'],
  ['sc.goOpponents', 'Ir para Adversário', 'Go to Opponent'],
  ['sc.goHistory', 'Ir para Histórico', 'Go to History'],
  ['sc.goEngines', 'Ir para Engines', 'Go to Engines'],
  ['sc.goSettings', 'Ir para Ajustes', 'Go to Settings'],
  ['sc.tutorial', 'Abrir tutorial', 'Open tutorial'],
];

// Rótulos dos controles (ui.<chave>) e opções (opt.<chave>.<valor>)
const U: Entry[] = [
  ['ui.navMode', 'Navegação', 'Navigation'],
  ['ui.density', 'Densidade', 'Density'],
  ['ui.layoutMode', 'Organização do layout', 'Layout arrangement'],
  ['ui.focusMode', 'Modo de foco total', 'Full focus mode'],
  ['ui.contentWidth', 'Largura do conteúdo', 'Content width'],
  ['ui.sidebarState', 'Menu lateral', 'Side menu'],
  ['ui.infoPanel', 'Painel de informações', 'Info panel'],
  ['ui.historyPos', 'Histórico de lances', 'Move history'],
  ['ui.header', 'Cabeçalho', 'Header'],
  ['ui.showEnginePanel', 'Mostrar painel da engine', 'Show engine panel'],
  ['ui.showMoveList', 'Mostrar histórico de lances', 'Show move list'],
  ['ui.showActions', 'Mostrar painel de ações', 'Show actions panel'],
  ['ui.palette', 'Paleta de tema', 'Theme palette'],
  ['ui.accent', 'Cor de destaque', 'Accent color'],
  ['ui.bgColor', 'Cor de fundo', 'Background color'],
  ['ui.surfaceColor', 'Cor dos painéis', 'Panel color'],
  ['ui.inkColor', 'Cor do texto', 'Text color'],
  ['ui.boardLight', 'Casas claras do tabuleiro', 'Board light squares'],
  ['ui.boardDark', 'Casas escuras do tabuleiro', 'Board dark squares'],
  ['ui.pieceScale', 'Tamanho das peças', 'Piece size'],
  ['ui.boardMax', 'Tamanho máximo do tabuleiro (px, 0 = automático)', 'Max board size (px, 0 = auto)'],
  ['ui.font', 'Fonte', 'Font'],
  ['ui.textScale', 'Tamanho do texto', 'Text size'],
  ['ui.radius', 'Arredondamento', 'Corner radius'],
  ['ui.borderWidth', 'Espessura das bordas', 'Border width'],
  ['ui.spacing', 'Espaçamentos', 'Spacing'],
  ['ui.opacity', 'Opacidade dos painéis', 'Panel opacity'],
  ['ui.animation', 'Intensidade das animações', 'Animation intensity'],
  ['ui.effects', 'Efeitos visuais (brilho e desfoque)', 'Visual effects (glow & blur)'],
  ['ui.moveInput', 'Entrada de lances', 'Move input'],
  ['ui.confirmMoves', 'Confirmar lances antes de jogar', 'Confirm moves before playing'],
  ['ui.autoOrient', 'Orientação automática do tabuleiro (cor do jogador embaixo)', 'Automatic board orientation (player color at bottom)'],
  ['ui.highlightCheck', 'Destacar xeque', 'Highlight check'],
  ['ui.notation', 'Notação dos lances', 'Move notation'],
  ['ui.showPv', 'Mostrar variante principal', 'Show principal variation'],
  ['ui.showSearchInfo', 'Mostrar informações de busca (profundidade, nós)', 'Show search info (depth, nodes)'],
  ['ui.lazyLoad', 'Carregar engines sob demanda', 'Load engines on demand'],
  ['ui.uiScale', 'Escala da interface (%)', 'Interface scale (%)'],
  ['ui.contrast', 'Contraste', 'Contrast'],
  ['ui.motion', 'Redução de movimento', 'Reduced motion'],
  ['ui.altIndicators', 'Indicadores visuais alternativos (padrões/contornos)', 'Alternative visual indicators (patterns/outlines)'],
  ['ui.keyboardNav', 'Navegação e atalhos por teclado', 'Keyboard navigation & shortcuts'],
  ['ui.lowPerf', 'Modo de baixo desempenho', 'Low-performance mode'],
  ['ui.readability', 'Ajustes de legibilidade (espaçamento de texto)', 'Readability tweaks (text spacing)'],
];

const OPT: Record<string, Record<string, [string, string]>> = {
  navMode: { side: ['Lateral', 'Side'], top: ['Superior', 'Top'], both: ['Combinada', 'Combined'] },
  density: { compact: ['Compacta', 'Compact'], comfortable: ['Confortável', 'Comfortable'], spacious: ['Espaçosa', 'Spacious'] },
  layoutMode: { adaptive: ['Adaptativo', 'Adaptive'], centered: ['Centralizado', 'Centered'], side: ['Lateral', 'Side'] },
  contentWidth: { narrow: ['Estreita', 'Narrow'], default: ['Padrão', 'Default'], wide: ['Ampla', 'Wide'] },
  sidebarState: { expanded: ['Expandido', 'Expanded'], compact: ['Compacto', 'Compact'], collapsed: ['Recolhido', 'Collapsed'] },
  infoPanel: { right: ['Direita', 'Right'], left: ['Esquerda', 'Left'], hidden: ['Oculto', 'Hidden'] },
  historyPos: { side: ['Lateral', 'Side'], bottom: ['Inferior', 'Bottom'] },
  header: { full: ['Completo', 'Full'], compact: ['Compacto', 'Compact'], minimal: ['Minimalista', 'Minimal'] },
  palette: { default: ['Original', 'Original'], midnight: ['Meia-noite', 'Midnight'], forest: ['Floresta', 'Forest'], paper: ['Papel', 'Paper'], sunset: ['Pôr do sol', 'Sunset'], mono: ['Monocromático', 'Monochrome'] },
  font: { default: ['Padrão', 'Default'], serif: ['Serifada', 'Serif'], mono: ['Monoespaçada', 'Monospace'], system: ['Do sistema', 'System'], rounded: ['Arredondada', 'Rounded'] },
  radius: { default: ['Padrão', 'Default'], sharp: ['Reto', 'Sharp'], soft: ['Suave', 'Soft'], round: ['Bem arredondado', 'Very round'] },
  borderWidth: { '1': ['Fina', 'Thin'], '2': ['Média', 'Medium'], '3': ['Grossa', 'Thick'] },
  animation: { off: ['Desligadas', 'Off'], low: ['Baixa', 'Low'], normal: ['Normal', 'Normal'], high: ['Alta', 'High'] },
  moveInput: { both: ['Arrastar e clicar', 'Drag & click'], drag: ['Somente arrastar', 'Drag only'], click: ['Somente clicar', 'Click only'] },
  notation: { san: ['SAN (Nf3)', 'SAN (Nf3)'], uci: ['UCI (g1f3)', 'UCI (g1f3)'] },
  contrast: { normal: ['Normal', 'Normal'], high: ['Alto contraste', 'High contrast'] },
  motion: { system: ['Seguir o sistema', 'Follow system'], reduce: ['Reduzir', 'Reduce'], full: ['Completo', 'Full'] },
};

const PT: Record<string, string> = {};
const EN: Record<string, string> = {};
for (const [k, p, e] of [...E, ...U]) {
  PT[k] = p;
  EN[k] = e;
}
for (const [ctl, vals] of Object.entries(OPT)) {
  for (const [v, [p, e]] of Object.entries(vals)) {
    PT[`opt.${ctl}.${v}`] = p;
    EN[`opt.${ctl}.${v}`] = e;
  }
}

const DICTS: Record<Lang, Record<string, string>> = { pt: PT, en: EN };

/** Frases da interface original (português) → inglês. Usado por `tr()`. */
const PHRASES: Record<string, string> = {
  Início: 'Home',
  Jogar: 'Play',
  Adversário: 'Opponent',
  Histórico: 'History',
  Engines: 'Engines',
  Ajustes: 'Settings',
  'Plataforma de xadrez': 'Chess platform',
  Tema: 'Theme',
  'Tema claro': 'Light theme',
  'Tema escuro': 'Dark theme',
  'Ativar tema claro': 'Switch to light theme',
  'Ativar tema escuro': 'Switch to dark theme',
  'Alterar adversário': 'Change opponent',
  'Partida em andamento': 'Game in progress',
  Principal: 'Main',
  'Chess Master — início': 'Chess Master — home',
  Lances: 'Moves',
  Virar: 'Flip',
  Desfazer: 'Undo',
  Abandonar: 'Resign',
  'Confirmar?': 'Confirm?',
  Nova: 'New',
  'Copiar PGN': 'Copy PGN',
  'Copiar FEN': 'Copy FEN',
  Copiado: 'Copied',
  'Baixar PGN': 'Download PGN',
  'Voltar à partida': 'Back to game',
  'Você venceu!': 'You won!',
  'Você perdeu': 'You lost',
  Empate: 'Draw',
  'Revanche (trocar de cor)': 'Rematch (swap colors)',
  'Nova partida': 'New game',
  Revisar: 'Review',
  Profundidade: 'Depth',
  Nós: 'Nodes',
  'Variante:': 'Line:',
  'Não carregada': 'Not loaded',
  'Carregando…': 'Loading…',
  Pronta: 'Ready',
  Calculando: 'Calculating',
  Erro: 'Error',
  'Engine real (UCI)': 'Real engine (UCI)',
  'Adversário básico': 'Basic opponent',
  'engine real': 'real engine',
  'adversário básico': 'basic opponent',
  'Em andamento': 'In progress',
  Pensando: 'Thinking',
  Brancas: 'White',
  Pretas: 'Black',
  Você: 'You',
};

export function resolveLang(pref: LangPref): Lang {
  if (pref === 'pt' || pref === 'en') return pref;
  const n = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? 'pt') : 'pt';
  return n.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export const currentLang = (): Lang => resolveLang(prefsStore.get().lang);
export const useLang = (): Lang => resolveLang(prefsStore.use().lang);

export function t(key: string, params?: Record<string, string | number>): string {
  const lang = currentLang();
  let s = DICTS[lang][key] ?? PT[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** Traduz um texto da interface original (escrito em português). Sem tradução → devolve o original. */
export function tr(pt: string): string {
  return currentLang() === 'en' ? (PHRASES[pt] ?? pt) : pt;
}

export const hasKey = (k: string) => k in PT;
