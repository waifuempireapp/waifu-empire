#!/usr/bin/env node
/**
 * Patch automatica per src/app/gioco/page.jsx
 *
 * Applica i seguenti cambiamenti in modo idempotente:
 *  1. Aggiunge `import { Header, NavTabs, BottomNav, HomeTab } from './_redesign';`
 *  2. Rimuove le 9 definizioni di funzione locali (Header, PackBlock, KissesBlock,
 *     NavTabs, BottomNav, HomeTab, StatCombattimento, BannerUltimeCarte,
 *     CardPacchettoOverlay), che ora vengono importate dal modulo _redesign.jsx
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
  console.log(`ℹ Backup già esistente: ${bak}`);
}

// ── 2. Aggiungi import ────────────────────────────────────────
const IMPORT_LINE = `import { Header, NavTabs, BottomNav, HomeTab } from './_redesign';`;

if (!src.includes(IMPORT_LINE)) {
  // Inseriamo subito dopo l'import di UIKit
  const uiKitImportRe = /(import\s*\{[^}]+\}\s*from\s*['"]@\/components\/ui\/UIKit['"];)/;
  if (uiKitImportRe.test(src)) {
    src = src.replace(uiKitImportRe, `$1\n${IMPORT_LINE}`);
    console.log('✓ Import aggiunto dopo UIKit');
  } else {
    // Fallback: dopo la prima riga di import
    src = src.replace(/(^import .+;\s*\n)/m, `$1${IMPORT_LINE}\n`);
    console.log('✓ Import aggiunto in cima');
  }
} else {
  console.log('ℹ Import già presente — skip');
}

// ── 3. Rimuovi le 9 funzioni locali ───────────────────────────
const FUNCTIONS_TO_REMOVE = [
  'Header', 'PackBlock', 'KissesBlock', 'NavTabs', 'BottomNav',
  'HomeTab', 'StatCombattimento', 'BannerUltimeCarte', 'CardPacchettoOverlay',
];

let removed = 0;
for (const fname of FUNCTIONS_TO_REMOVE) {
  // Trova `function NAME(...)` con eventuale commento immediatamente sopra
  const startRe = new RegExp(`^function\\s+${fname}\\s*\\(`, 'm');
  const m = startRe.exec(src);
  if (!m) {
    console.log(`  - ${fname}: non trovata (già rimossa?)`);
    continue;
  }
  let start = m.index;

  // Espandi all'indietro per inglobare eventuali commenti "// ──" / "// =="
  // immediatamente precedenti (separati da una linea vuota o meno)
  const before = src.slice(0, start);
  const commentBlock = /(?:^\s*\/\/[^\n]*\n)+(?:^\s*\n)?$/m;
  // Riallinea: cerca eventuali commenti immediatamente sopra
  const lines = before.split('\n');
  let backTrack = lines.length;
  while (backTrack > 0) {
    const ln = lines[backTrack - 1];
    if (/^\s*$/.test(ln) || /^\s*\/\//.test(ln)) {
      backTrack--;
    } else break;
  }
  // Solo se troviamo commenti che descrivono la funzione, li includiamo
  // (max 4 righe sopra)
  const linesBackTracked = lines.length - backTrack;
  if (linesBackTracked > 0 && linesBackTracked <= 6 && /^\s*\/\//.test(lines[lines.length-1])) {
    start = lines.slice(0, backTrack).join('\n').length;
    if (start > 0) start += 1; // newline
  }

  // Bilanciamento parentesi graffe per trovare la fine della funzione
  const fnStart = src.indexOf('{', m.index);
  if (fnStart === -1) {
    console.log(`  ! ${fname}: { non trovata`);
    continue;
  }
  let depth = 1;
  let i = fnStart + 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '/' && src[i+1] === '/') {
      // commento line: skip a fine riga
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    else if (c === '/' && src[i+1] === '*') {
      i = src.indexOf('*/', i+2);
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
  if (depth !== 0) {
    console.log(`  ! ${fname}: graffe non bilanciate`);
    continue;
  }
  // Includi newline finale
  let end = i;
  if (src[end] === '\n') end++;
  if (src[end] === '\n') end++;

  src = src.slice(0, start) + src.slice(end);
  removed++;
  console.log(`✓ Rimossa: ${fname}`);
}

// ── 4. Pulisci eventuali commenti di sezione orfani ───────────
// Rimuovi blocchi "// =====...\n// NOME\n// =====...\n" rimasti senza la loro funzione
src = src.replace(/\n\s*\/\/ ={5,}\s*\n\s*\/\/ (?:HEADER|NAV TABS|BOTTOM NAV|HOMETAB|TAB: HOME|FASE \d+|STAT.*|CARD PACCH.*|BANNER.*)[^\n]*\n\s*\/\/ ={5,}\s*\n(?=\s*(?:\/\/|\n|function))/gi, '\n');

// ── 5. Aggiungi prop ModaleCarta a <HomeTab .../> ─────────────
const homeTabRe = /<HomeTab\b([^>]*?)\/>/m;
const ht = homeTabRe.exec(src);
if (ht && !/ModaleCarta\s*=/.test(ht[0])) {
  src = src.replace(homeTabRe, (full, attrs) => {
    return `<HomeTab${attrs} ModaleCarta={ModaleCarta} />`;
  });
  console.log('✓ Prop ModaleCarta aggiunta a <HomeTab/>');
} else if (ht) {
  console.log('ℹ Prop ModaleCarta già presente');
} else {
  console.warn('⚠ <HomeTab/> non trovato — passa la prop ModaleCarta a mano');
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
