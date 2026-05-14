## Context

`_redesign.jsx` esporta 4 componenti (`Header`, `NavTabs`, `BottomNav`, `HomeTab`) con tutti gli stili definiti come inline objects. Il design system esiste già in `globals.css` con variabili CSS (`--c-gold`, `--ink-abyss`, `--ff-label`, ecc.) e alcune classi utility, ma i componenti non le usano. Il refactoring porta consistenza e apre la porta a temi e override media-query puliti. Il design di riferimento (`reference/Home _ Lobby.html`) è un export del Claude design canvas: definisce layout, palette, tipografia e le nuove sezioni.

## Goals / Non-Goals

**Goals:**
- Zero inline styles in `_redesign.jsx` — ogni valore visuale diventa una classe CSS in `globals.css`
- Nuove sezioni homepage: DROP STAGIONALE, QUEST GIORNALIERI, TRA AMICI
- Dati reali da Firestore per le tre nuove sezioni
- Nuove animazioni (`twink`, `sakuraFall`) in `globals.css`
- Il comportamento (handlers, logica) rimane invariato

**Non-Goals:**
- Redesign di altri tab (Mappa, Sbusta, Collezione, Amici, Classifica)
- Admin panel o strutture backend (Cloud Functions) per le quest
- Internazionalizzazione
- Dark/Light mode toggle

## Decisions

### 1. CSS in globals.css (non CSS Modules)
Il progetto usa già `globals.css` per layout e media-query. Usare un `.module.css` dedicato richiederebbe refactoring dell'import su tutti i componenti esistenti e romperebbe le media-query cross-component già presenti. Scelta: aggiungere sezioni con prefisso `/* ===== HOME ===== */` a `globals.css`.

### 2. Naming delle classi CSS
Prefisso `ht-` (Home Tab) per tutte le nuove classi, `hdr-` per Header, `bnav-` per BottomNav — evita collisioni con le classi legacy.

### 3. DROP STAGIONALE — Firestore schema
Documento globale `config/dropStagionale`:
```
{
  attivo: boolean,
  nome: string,           // "Hanami Festival"
  descrizione: string,    // "15 nuove waifu · 8 outfit · 1 immersiva garantita"
  scadenza: Timestamp,    // data fine evento
  packId: string          // (futuro) id del pack legato all'evento
}
```
Lettura con `getDoc(doc(db, 'config', 'dropStagionale'))`. Se `attivo: false` o documento assente, la sezione non viene renderizzata.

### 4. QUEST GIORNALIERI — schema e tracking
Le definizioni delle 3 quest sono hardcoded nel frontend (tipi: `bustine`, `territori`, `leggendarie`). Il progresso è salvato nel documento `users/{uid}` come:
```
questGiornaliere: {
  data: '2026-05-14',          // YYYY-MM-DD reset giornaliero
  bustine: { progresso: 1, target: 1, reward: { tipo: 'kisses', qty: 50 }, claimed: false },
  territori: { progresso: 2, target: 3, reward: { tipo: 'pack', qty: 1 }, claimed: false },
  leggendarie: { progresso: 0, target: 1, reward: { tipo: 'kisses', qty: 200, bonus: 'pose' }, claimed: false }
}
```
Il frontend confronta `questGiornaliere.data` con la data odierna: se diversa, azzera localmente e aggiorna Firestore. La sezione mostra il badge "Premi in attesa N/3" basato sulle quest completate e non ancora riscattate. Il claim button aggiorna `claimed: true` e aggiunge il reward al profilo utente via `updateDoc`.

### 5. TRA AMICI — schema e lettura
Ogni azione significativa dell'utente (apertura bustina con carta notevole, salita di livello, proposta scambio) scrive un documento nella subcollection `users/{uid}/attivita`:
```
{
  tipo: 'pescata_carta' | 'salita_livello' | 'cerca_scambio',
  dettaglio: string,    // "ha pescato Aurelia"
  ts: Timestamp
}
```
Il feed "TRA AMICI" legge le `attivita` degli amici dell'utente: prende la lista `profilo.amici[]` (uid), poi `getDocs` su ciascun `users/{uid}/attivita` (limit 1, orderBy ts desc). Per limitare le letture, un massimo di 5 amici viene mostrato. Questa query fanout è accettabile per una lista amici piccola.

### 6. Rimozione BigActionButton Negozio e Pesca dalla home
Nel design di riferimento, Negozio e Pesca appaiono già nei QuickTile. I `BigActionButton` in fondo alla home vengono rimossi per allinearsi al design e ridurre lo scroll verticale.

## Risks / Trade-offs

- **Query fanout TRA AMICI**: se un utente ha molti amici, si generano molte letture Firestore. Mitigazione: cap a 5 amici nel feed; in futuro si può usare un documento aggregato.
- **Reset quest giornaliere lato client**: se l'utente non apre l'app, il reset non avviene. Non critico per MVP; le quest vengono mostrate correttamente al primo accesso del giorno.
- **globals.css in crescita**: aggiungere molte classi aumenta il file. Mitigazione: prefissi chiari e sezioni commentate. Da valutare splitting CSS in futuro.
- **Documento `config/dropStagionale` assente**: se non esiste, la sezione DROP STAGIONALE non viene mostrata — comportamento graceful degradation.
