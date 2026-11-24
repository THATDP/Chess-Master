// E2E em navegador real (Chromium headless via playwright-core). Uso: node tests/e2e/e2e.mjs [url]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:3000/';
const root = path.join(os.homedir(), '.cache/ms-playwright');
const dir = fs.readdirSync(root).find((d) => d.startsWith('chromium_headless_shell'));
const exe = path.join(root, dir, fs.readdirSync(path.join(root, dir)).find((x) => x.startsWith('chrome')), 'headless_shell');
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { c ? pass++ : fail++; console.log(`${c ? '  ✔' : '  ✘'} ${n} ${extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

async function newPage(opts = {}, init = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  if (init.settings) await page.addInitScript((s) => { if (!localStorage.getItem('cm.seeded')) { localStorage.setItem('chessmaster.settings.v1', JSON.stringify(s)); localStorage.setItem('cm.seeded', '1'); } }, init.settings);
  return page;
}
const movesText = (page) => page.evaluate(() => document.querySelector('.pm-moves')?.innerText ?? '');
const countPlies = async (page) => { const t = await movesText(page); return (t.match(/[a-hKQRBNO][\w=+#-]*/g) || []).filter((x) => /^[a-hKQRBNO]/.test(x) && !/^Lances|^Em|^Xeque|^Vez/.test(x)).length; };
async function startGame(page) { await page.goto(URL + '#/play'); await page.waitForSelector('[data-testid=start-game]', { timeout: 20000 }); await page.click('[data-testid=start-game]'); await page.waitForSelector('[data-testid=board]'); }
async function click(page, sq) { await page.click(`[data-testid=board] [data-square=${sq}]`); }
async function waitEngineReply(page, before, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const n = await countPlies(page); if (n >= before + 2) return n; await sleep(150); } return -1; }

async function playMoves(name, settings, moves, withUndo) {
  console.log(`\n== ${name} ==`);
  const page = await newPage({}, { settings });
  await startGame(page);
  let plies = 0, allOk = true;
  for (let i = 0; i < moves.length; i++) {
    const [a, b] = moves[i];
    await click(page, a); await click(page, b);
    const n = await waitEngineReply(page, plies);
    if (n < 0) { allOk = false; ok(`${name}: resposta ao lance ${i + 1} (${a}${b})`, false, `status=${await page.textContent('[data-testid=engine-status]').catch(() => '?')} | ${(await movesText(page)).replace(/\s+/g, ' ').slice(0, 120)}`); break; }
    plies = n;
    if (withUndo && (i === 1 || i === 3)) { await page.click('button[title="Desfazer"]'); await sleep(400); plies = await countPlies(page); }
  }
  if (allOk) ok(`${name}: ${moves.length} lances consecutivos respondidos pela engine${withUndo ? ' (com 2 desfazer/cancelamentos no meio)' : ''}`, true);
  const status = await page.textContent('[data-testid=engine-status]').catch(() => '');
  ok(`${name}: status final não é "Calculando" permanente`, !/Calculando/.test(status), `(${status})`);
  ok(`${name}: sem erros de JS/console`, page.errors.length === 0, page.errors.join(' | ').slice(0, 300));
  await page.screenshot({ path: `/tmp/shots/${name.replace(/\W+/g, '_')}.png` });
  await page.context().close();
}

const base = { opponentId: 'stockfish' };
const pawnMoves = [['e2', 'e4'], ['d2', 'd3'], ['a2', 'a3'], ['h2', 'h3'], ['b2', 'b3'], ['g2', 'g3']];
await playMoves('Stockfish no navegador', base, pawnMoves, false);
await playMoves('Chess.js AI (com cancelamentos)', { opponentId: 'chessjs-ai' }, pawnMoves, true);
await playMoves('Lozza no navegador', { opponentId: 'lozza' }, pawnMoves.slice(0, 4), false);

console.log('\n== Preferências, perfis, idiomas, persistência ==');
{
  const page = await newPage();
  await page.goto(URL + '#/settings'); await page.waitForSelector('[data-testid=settings-search]');
  const html = () => page.evaluate(() => ({ nav: document.documentElement.dataset.nav, theme: document.documentElement.dataset.theme, lang: document.documentElement.lang, focus: document.documentElement.dataset.focus, accent: document.documentElement.style.getPropertyValue('--c-accent') }));
  ok('padrão = interface original (sem atributos de preferência)', (await html()).nav === undefined && (await html()).accent === '');
  await page.click('[data-cat=layout]');
  await page.selectOption('[data-setting=navMode] select', 'top');
  ok('layout: navegação superior aplicada na hora', (await html()).nav === 'top');
  ok('barra superior visível', await page.isVisible('.pm-topnav'));
  await page.selectOption('[data-setting=navMode] select', 'both');
  ok('layout combinado: sidebar e barra superior', (await page.isVisible('.pm-topnav')) && (await page.isVisible('.pm-aside')));
  await page.selectOption('[data-setting=navMode] select', 'side');
  await page.click('[data-cat=appearance]');
  await page.fill('[data-setting=accent] input[type=text]', '255, 0, 128');
  await sleep(100);
  ok('aparência: cor RGB personalizada aplicada ao vivo', (await html()).accent === '#ff0080', (await html()).accent);
  await page.screenshot({ path: '/tmp/shots/settings_appearance.png' });
  await page.fill('[data-testid=settings-search]', 'contraste');
  ok('pesquisa de preferências encontra "Contraste"', await page.isVisible('[data-setting=contrast]'));
  await page.fill('[data-testid=settings-search]', '');
  await page.click('[data-cat=profiles]');
  await page.fill('input[placeholder="Nome do novo perfil"]', 'Meu perfil');
  await page.click('button:has-text("Criar perfil")');
  await sleep(200);
  ok('perfil criado e selecionado', (await page.locator('[data-profile]').count()) === 5);
  await page.selectOption('[data-testid=profile-select]', 'minimal');
  await sleep(200);
  ok('troca para o perfil "Minimalista" (header minimal)', (await page.evaluate(() => document.documentElement.dataset.header)) === 'minimal');
  await page.selectOption('[data-testid=profile-select]', 'custom');
  await sleep(200);
  ok('perfis independentes: "Personalizado" mantém a cor rosa; Minimalista não a tinha', (await html()).accent === '#ff0080');
  await page.selectOption('[data-testid=lang-select]', 'en');
  await sleep(300);
  ok('idioma → inglês: navegação traduzida', (await page.locator('.pm-aside nav a').first().innerText()).includes('Home'));
  ok('idioma → inglês: <html lang="en">', (await html()).lang === 'en');
  await page.reload(); await page.waitForSelector('[data-testid=settings-search]');
  ok('persistência após recarregar (idioma + cor)', (await html()).lang === 'en' && (await html()).accent === '#ff0080');
  await page.keyboard.press('Alt+2'); await sleep(200);
  ok('atalho Alt+2 navega para Play', page.url().includes('#/play'));
  await page.goto(URL + '#/settings'); await page.waitForSelector('[data-testid=settings-search]');
  await page.click('[data-testid=settings-search]'); await page.keyboard.type('zzz'); await page.keyboard.press('f');
  ok('digitar em campo de texto não dispara atalhos', page.url().includes('#/settings'));
  ok('sem erros de JS/console nas preferências', page.errors.length === 0, page.errors.join(' | ').slice(0, 300));
  await page.context().close();
}

console.log('\n== Tutorial e mobile ==');
{
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL); await page.waitForSelector('[data-testid=tutorial-banner]');
  ok('banner do tutorial aparece no primeiro acesso e não bloqueia', await page.isVisible('[data-testid=tutorial-banner]'));
  await page.click('[data-testid=tutorial-banner] button:has-text("Agora não")');
  ok('tutorial ignorado', !(await page.isVisible('[data-testid=tutorial-banner]')));
  await page.keyboard.press('?'); await sleep(200);
  ok('tutorial pode ser iniciado depois (tecla ?)', await page.isVisible('[data-testid=tutorial]'));
  await page.screenshot({ path: '/tmp/shots/mobile_tutorial.png' });
  await page.keyboard.press('Escape');
  await page.goto(URL + '#/play'); await page.waitForSelector('[data-testid=start-game]'); await page.click('[data-testid=start-game]'); await page.waitForSelector('[data-testid=board]');
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.querySelector('[data-testid=board]').getBoundingClientRect().width }));
  ok('mobile 390px: sem rolagem horizontal e tabuleiro ocupa a largura', w.sw <= w.cw + 1 && w.bw > 300, JSON.stringify(w));
  await page.screenshot({ path: '/tmp/shots/mobile_play.png' });
  await page.context().close();
}
await browser.close();
console.log(`\nE2E: ${pass} aprovados, ${fail} falhas.`);
process.exit(fail ? 1 : 0);
