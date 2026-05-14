#!/usr/bin/env node
/**
 * Patch automatica per src/app/gioco/page.jsx
 *
 * Applica i seguenti cambiamenti in modo idempotente:
 *  1. Aggiunge `import { Header, NavTabs, BottomNav, HomeTab, AmiciTab, ClassificaTab } from './_redesign';`
 *     (Next.js risolve automaticamente `./_redesign` → `./_redesign/index.jsx`)
 *  2. Rimuove le 11 definizioni di funzione locali (Header, PackBlock, KissesBlock,
 *     NavTabs, BottomNav, HomeTab, StatCombattimento, BannerUltimeCarte,
 *     CardPacchettoOverlay, AmiciTab, ClassificaTab) che ora vengono importate
 *     dal modulo `_redesign/`.
 *  3. Aggiunge la prop `ModaleCarta={ModaleCarta}` al render di <HomeTab .../>
 *
 * USO (dalla root del progetto impero-waifu):
 *   node apply/patch-page.js
 *
 * Lo script crea un backup `page.jsx.bak` prima di sovrascrivere.
 */
const fs = require('fs');
const path = require('path');

const PAGE_PATH = path.join(process.cwd(), 'src', 'app', 'gioco', 'page.jsx');

if (!fs.existsSync(PAGE_PATH)) {
  console.error(`✗ File non trovato: ${PAGE_PATH}`);
  console.error('  Esegui questo script dalla root del progetto impero-waifu.');
  process.exit(1);
}

let src = fs.readFileSync(PAGE_PATH, 'utf8');
const original = src;

// ── 1. Backup ─────────────────────────────────────────────────
const bak = PAGE_PATH + '.bak';
if (!fs.existsSync(bak)) {
  fs.writeFileSync(bak, src);
  console.log(`✓ Backup creato: ${bak}`);
} else {
  console.log(`ℹ Backup già esistente: ${bak} (non sovrascritto)`);
}

// ── 2. Aggiungi/aggiorna import ──────────────────────────────
const IMPORT_LINE = `import { Header, NavTabs, BottomNav, HomeTab, AmiciTab, ClassificaTab, SbustaTab, CollezioneTab } from './_redesign';`;
const OLD_IMPORT_RE = /import\s*\{[^}]*\}\s*from\s*['"]\.\/_redesign['"];\s*\n?/g;

if (OLD_IMPORT_RE.test(src)) {
  src = src.replace(OLD_IMPORT_RE, IMPORT_LINE + '\n');
  console.log('✓ Import aggiornato');
} else {
  const uiKitImportRe = /(import\s*\{[^}]+\}\s*from\s*['"]@\/components\/ui\/UIKit['"];)/;
  if (uiKitImportRe.test(src)) {
    src = src.replace(uiKitImportRe, `$1\n${IMPORT_LINE}`);
    console.log('✓ Import aggiunto dopo UIKit');
  } else {
    src = src.replace(/(^import .+;\s*\n)/m, `$1${IMPORT_LINE}\n`);
    console.log('✓ Import aggiunto in cima');
  }
}

// ── 3. Rimuovi funzioni locali ───────────────────────────────
const FUNCTIONS_TO_REMOVE = [
  'Header', 'PackBlock', 'KissesBlock', 'NavTabs', 'BottomNav',
  'HomeTab', 'StatCombattimento', 'BannerUltimeCarte', 'CardPacchettoOverlay',
  'AmiciTab', 'ClassificaTab',
  'SbustaTab', 'PackCard', 'CartaCoperta', 'CountdownPacchettiOmaggio',
  'CollezioneTab', 'BarraFiltriWaifu', 'TradeCountdownInline', 'SelezioneWaifuTeam',
];

let removed = 0;
for (const fname of FUNCTIONS_TO_REMOVE) {
  const startRe = new RegExp(`^function\\s+${fname}\\s*\\(`, 'm');
  const m = startRe.exec(src);
  if (!m) {
    console.log(`  - ${fname}: non trovata (già rimossa)`);
    continue;
  }
  let start = m.index;

  // Include eventuali commenti immediatamente sopra (max 6 righe)
  const before = src.slice(0, start);
  const lines = before.split('\n');
  let backTrack = lines.length;
  while (backTrack > 0) {
    const ln = lines[backTrack - 1];
    if (/^\s*$/.test(ln) || /^\s*\/\//.test(ln)) backTrack--;
    else break;
  }
  const lookback = lines.length - backTrack;
  if (lookback > 0 && lookback <= 8 && /^\s*\/\//.test(lines[lines.length - 1])) {
    start = lines.slice(0, backTrack).join('\n').length;
    if (start > 0) start += 1;
  }

  // Trova fine funzione bilanciando le graffe
  const fnStart = src.indexOf('{', m.index);
  if (fnStart === -1) { console.log(`  ! ${fname}: { non trovata`); continue; }
  let depth = 1;
  let i = fnStart + 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      if (i === -1) break;
      i += 2;
      continue;
    }
    else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
    }
    i++;
  }
  if (depth !== 0) { console.log(`  ! ${fname}: graffe non bilanciate`); continue; }
  let end = i;
  if (src[end] === '\n') end++;
  if (src[end] === '\n') end++;

  src = src.slice(0, start) + src.slice(end);
  removed++;
  console.log(`✓ Rimossa: ${fname}`);
}

// ── 4. Pulisci eventuali commenti di sezione orfani ───────────
src = src.replace(/\n\s*\/\/ ={5,}\s*\n\s*\/\/ (?:HEADER|NAV TABS|BOTTOM NAV|HOMETAB|TAB:?[^\n]*|FASE \d+|STAT.*|CARD PACCH.*|BANNER.*|CLASSIFICA[^\n]*|AMICI[^\n]*)[^\n]*\n\s*\/\/ ={5,}\s*\n(?=\s*(?:\/\/|\n|function|export))/gi, '\n');

// ── 5. Aggiungi prop ModaleCarta / ModaPersonalizzazione ai render ─
const PROP_INJECTIONS = [
  { tag: 'HomeTab',       prop: 'ModaleCarta', value: 'ModaleCarta' },
  { tag: 'SbustaTab',     prop: 'ModaleCarta', value: 'ModaleCarta' },
  { tag: 'CollezioneTab', prop: 'ModaPersonalizzazione', value: 'ModaPersonalizzazione' },
];
for (const { tag, prop, value } of PROP_INJECTIONS) {
  const re = new RegExp(`<${tag}\\b([^>]*?)\\/>`, 'm');
  const m = re.exec(src);
  if (m && !new RegExp(`\\b${prop}\\s*=`).test(m[0])) {
    src = src.replace(re, (full, attrs) => `<${tag}${attrs} ${prop}={${value}} />`);
    console.log(`✓ Prop ${prop} aggiunta a <${tag}/>`);
  } else if (m) {
    console.log(`ℹ Prop ${prop} già presente su <${tag}/>`);
  } else {
    console.warn(`⚠ <${tag}/> non trovato — passa la prop a mano`);
  }
}

// ── 6. Scrivi ────────────────────────────────────────────────
if (src === original) {
  console.log('\nNessun cambiamento applicato (file già patchato).');
} else {
  fs.writeFileSync(PAGE_PATH, src);
  console.log(`\n✅ Patch applicata a ${PAGE_PATH}`);
  console.log(`   ${removed}/${FUNCTIONS_TO_REMOVE.length} funzioni rimosse`);
}
console.log('\n→ Ora ricarica il dev server (npm run dev) e apri /gioco');
