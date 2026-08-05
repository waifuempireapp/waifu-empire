// ============================================================
// WAIFU EMPIRE — DATI MOSSE
// Dati delle mosse del gioco usati dai componenti vetrina
// (components/moves/MoveCard.vue, MovesList.vue).
// ============================================================

export type MoveType = 'arcana' | 'natura' | 'ferro' | 'abisso' | 'fuoco' | 'chrono'

export interface MultiHit {
  hits: number
  damagePerHit: number
}

// Tipo di effetto applicato dalla mossa:
//  dot      → danno nel tempo (HP persi a inizio turno / per azione)
//  shield   → scudo che assorbe attacchi
//  control  → blocca/limita l'avversaria (immobilizzo, dissolvi)
//  buff     → potenziamento sull'utilizzatrice
//  debuff   → indebolimento sul bersaglio (es. difesa ridotta)
export type EffectKind = 'dot' | 'shield' | 'control' | 'buff' | 'debuff'

export interface MoveEffect {
  kind: EffectKind
  status: string            // chiave breve, es. 'bruciatura'
  label: string             // etichetta leggibile per la card, es. 'Bruciatura'
  durataTurni: number       // durata in turni
  dannoPerTurno?: number    // HP persi a turno (solo per i 'dot')
  aoe?: boolean             // colpisce tutti i nemici
}

export interface Move {
  id: string
  name: string
  type: MoveType
  damage: number                  // POTENZA indicativa (stile card-game), non HP reali
  pp?: number                     // punti potere (5–20)
  multiHit?: MultiHit
  additionalEffectLabel: string   // es. "+ Scudo Arcano" — badge breve per la card
  effectDescription: string       // descrizione meccanica completa
  effect?: MoveEffect             // effetto strutturato (per durata/turni)
  flavorText: string              // testo narrativo in corsivo sulla card
  isUltimate: boolean             // mossa definitiva, usabile 1 volta a partita
  imageFileName: string           // nome file ESATTO su ImageKit, cartella "Mosse"
  imageUrl: string                // url completo ImageKit (codificato)
}

// Endpoint reale ImageKit + cartella "Mosse".
export const IMAGEKIT_BASE = 'https://ik.imagekit.io/waifuempire/Mosse'

// I nomi file su ImageKit hanno il suffisso "_2" in modo incoerente, quindi
// mappiamo il nome ESATTO di ciascun file (verificato via API ImageKit) e
// costruiamo l'URL codificando gli spazi.
// NFD: i file ImageKit caricati da macOS hanno gli accenti decomposti.
const mk = (fileName: string) => `${IMAGEKIT_BASE}/${encodeURI(fileName.normalize('NFD'))}`

export const moves: Move[] = [
  {
    id: 'velo-argento',
    name: "Velo d'Argento",
    type: 'arcana',
    damage: 20,
    additionalEffectLabel: '+ Scudo Arcano',
    effectDescription:
      "Genera uno Scudo Arcano che assorbe i prossimi 2 attacchi nemici. Se entrambi i colpi vengono bloccati, il successivo attacco di questa waifu infligge +60% danno.",
    effect: { kind: 'shield', status: 'scudo_arcano', label: 'Scudo Arcano', durataTurni: 2 },
    flavorText:
      'Non tutte le battaglie si vincono con la forza. A volte basta un muro di luce silenziosa.',
    isUltimate: false,
    imageFileName: "VELO D'ARGENTO _ Arcana_2.png",
    imageUrl: mk("VELO D'ARGENTO _ Arcana_2.png"),
  },
  {
    id: 'radici-primordiali',
    name: 'Radici Primordiali',
    type: 'natura',
    damage: 65,
    additionalEffectLabel: '+ Immobilizza 2 turni',
    effectDescription:
      "Immobilizza l'avversaria per 2 turni: non può attaccare né usare carte supporto. Se il bersaglio è già avvelenato, il danno base raddoppia.",
    effect: { kind: 'control', status: 'immobilizzo', label: 'Immobilizzata', durataTurni: 2 },
    flavorText:
      'La terra non chiede permesso. Quando vuole trattenere, trattiene.',
    isUltimate: false,
    imageFileName: 'RADICI PRIMORDIALI _ Natura.png',
    imageUrl: mk('RADICI PRIMORDIALI _ Natura.png'),
  },
  {
    id: 'pioggia-lame',
    name: 'Pioggia di Lame',
    type: 'ferro',
    damage: 120,
    multiHit: { hits: 4, damagePerHit: 30 },
    additionalEffectLabel: '30 x4 (multi-hit)',
    effectDescription:
      'Colpisce 4 volte in rapida successione. Ogni colpo critico nella sequenza aggiunge +10% al danno del colpo successivo.',
    flavorText:
      'Non una ferita. Cento. Tante quante le lame che cadono dal cielo.',
    isUltimate: false,
    imageFileName: 'PIOGGIA DI LAME _ Ferro_2.png',
    imageUrl: mk('PIOGGIA DI LAME _ Ferro_2.png'),
  },
  {
    id: 'abisso-sussurrante',
    name: 'Abisso Sussurrante',
    type: 'abisso',
    damage: 40,
    additionalEffectLabel: '+ Corruzione 3 turni',
    effectDescription:
      'Applica Corruzione per 3 turni: il bersaglio perde 15 HP a inizio turno e 1 buff attivo viene rimosso per turno. Non è cumulabile con altre Corruzioni.',
    effect: { kind: 'dot', status: 'corruzione', label: 'Corruzione', durataTurni: 3, dannoPerTurno: 15 },
    flavorText:
      'Il buio non urla. Sussurra. E lentamente, tutto ciò che sei viene consumato.',
    isUltimate: false,
    imageFileName: 'ABISSO SUSSURRANTE _ Abisso_2.png',
    imageUrl: mk('ABISSO SUSSURRANTE _ Abisso_2.png'),
  },
  {
    id: 'colonna-fiamma',
    name: 'Colonna di Fiamma',
    type: 'fuoco',
    damage: 90,
    additionalEffectLabel: '+ Bruciatura 2 turni',
    effectDescription:
      'Infligge 90 danno e applica Bruciatura: -20 HP per 2 turni. Se il bersaglio è già bruciato, il danno base aumenta del 50%.',
    effect: { kind: 'dot', status: 'bruciatura', label: 'Bruciatura', durataTurni: 2, dannoPerTurno: 20 },
    flavorText:
      "Dal basso sale qualcosa di antico. Il fuoco non brucia solo la carne — brucia la volontà.",
    isUltimate: false,
    imageFileName: 'COLONNA DI FIAMMA _ Fuoco.png',
    imageUrl: mk('COLONNA DI FIAMMA _ Fuoco.png'),
  },
  {
    id: 'sigillo-cosmico',
    name: 'Sigillo Cosmico',
    type: 'arcana',
    damage: 50,
    additionalEffectLabel: '+ amplificazione',
    effectDescription:
      'La prossima mossa Arcana di questa waifu infligge +80% danno. Con 2 o più waifu Arcana alleate in campo, il bonus sale a +150%.',
    effect: { kind: 'buff', status: 'amplificazione', label: 'Amplificazione', durataTurni: 1 },
    flavorText:
      "Nell'universo ogni cosa è scritta. Lei impara a riscriverla.",
    isUltimate: false,
    imageFileName: 'SIGILLO COSMICO _ Arcana_2.png',
    imageUrl: mk('SIGILLO COSMICO _ Arcana_2.png'),
  },
  {
    id: 'fioritura-letale',
    name: 'Fioritura Letale',
    type: 'natura',
    damage: 55,
    additionalEffectLabel: '+ Lacerazione 3 turni',
    effectDescription:
      'Applica Lacerazione per 3 turni: il bersaglio perde 10 HP ogni volta che esegue una mossa. Questo effetto non può essere rimosso da poteri curativi.',
    effect: { kind: 'dot', status: 'lacerazione', label: 'Lacerazione', durataTurni: 3, dannoPerTurno: 10 },
    flavorText:
      'I petali più belli nascondono i bordi più affilati. La bellezza qui è solo un preludio.',
    isUltimate: false,
    imageFileName: 'FIORITURA LETALE _ Natura.png',
    imageUrl: mk('FIORITURA LETALE _ Natura.png'),
  },
  {
    id: 'impatto-sidereo',
    name: 'Impatto Sidereo',
    type: 'ferro',
    damage: 130,
    additionalEffectLabel: '+ Rompe Armatura',
    effectDescription:
      "Infligge 130 danno e riduce la Difesa dell'avversaria del 40% per 3 turni. Non può essere usata se questa waifu ha già usato un'altra mossa Ferro nello stesso turno.",
    effect: { kind: 'debuff', status: 'rompi_armatura', label: 'Difesa -40%', durataTurni: 3 },
    flavorText:
      "Non c'è armatura che tenga quando l'impatto viene dall'interno.",
    isUltimate: false,
    imageFileName: 'IMPATTO SIDEREO _ Ferro.png',
    imageUrl: mk('IMPATTO SIDEREO _ Ferro.png'),
  },
  {
    id: 'portale-abissale',
    name: 'Portale Abissale',
    type: 'abisso',
    damage: 35,
    additionalEffectLabel: '+ rimozione totale',
    effectDescription:
      "Rimuove tutte le carte supporto e i buff attivi dell'avversaria. 30% di probabilità di annullare il prossimo turno nemico (risucchiata nel portale).",
    effect: { kind: 'control', status: 'dissolvi', label: 'Dissolvi buff', durataTurni: 1 },
    flavorText:
      'Oltre la soglia non esistono regole. Non esistono alleati. Non esiste via di ritorno.',
    isUltimate: false,
    imageFileName: 'PORTALE ABISSALE _ Abisso.png',
    imageUrl: mk('PORTALE ABISSALE _ Abisso.png'),
  },
  {
    id: 'corona-solare',
    name: 'Corona Solare',
    type: 'fuoco',
    damage: 150,
    additionalEffectLabel: 'danno su tutti i nemici',
    effectDescription:
      'Usabile 1 sola volta per partita. Colpisce tutti i nemici in campo e applica Bruciatura a tutti. Se questa waifu ha HP inferiori al 30%, il danno raddoppia.',
    effect: { kind: 'dot', status: 'bruciatura', label: 'Bruciatura', durataTurni: 2, dannoPerTurno: 20, aoe: true },
    flavorText:
      'Quando brucia tutto il resto, lei brucia più forte.',
    isUltimate: true,
    imageFileName: 'CORONA SOLARE _ Fuoco_2.png',
    imageUrl: mk('CORONA SOLARE _ Fuoco_2.png'),
  },

  // ── Espansione mosse (15 nuove) ──────────────────────────────────────────
  {
    id: 'frammenti-tempo', name: 'Frammenti di Tempo', type: 'arcana', damage: 25,
    additionalEffectLabel: '+ Rallenta 2 turni',
    effectDescription: "Rallenta il bersaglio per 2 turni: il bersaglio agisce per ultimo indipendentemente dalla velocità. Se usata in apertura di turno, ha il 50% di probabilità di far saltare un'azione nemica.",
    effect: { kind: 'control', status: 'rallenta', label: 'Rallentata', durataTurni: 2 },
    flavorText: 'Il tempo non si ferma per nessuno. Tranne che per lei.',
    isUltimate: false, imageFileName: 'FRAMMENTI DI TEMPO _ Arcana_2.png', imageUrl: mk('FRAMMENTI DI TEMPO _ Arcana_2.png'),
  },
  {
    id: 'specchio-infranto', name: 'Specchio Infranto', type: 'arcana', damage: 15,
    additionalEffectLabel: '+ Riflette 50% danno',
    effectDescription: "Per 1 turno, riflette il 50% di qualsiasi danno subito verso l'attaccante. Non riflette danni da effetti ad area.",
    effect: { kind: 'buff', status: 'riflesso', label: 'Riflesso 50%', durataTurni: 1 },
    flavorText: 'Colpiscila, e il dolore tornerà da dove è venuto.',
    isUltimate: false, imageFileName: 'SPECCHIO INFRANTO _ Arcana_2.png', imageUrl: mk('SPECCHIO INFRANTO _ Arcana_2.png'),
  },
  {
    id: 'eclissi-arcana', name: 'Eclissi Arcana', type: 'arcana', damage: 110,
    additionalEffectLabel: 'danno + Silenzio a tutti i nemici',
    effectDescription: "Usabile 1 sola volta per partita. Infligge danno a tutti i nemici e applica Silenzio per 1 turno: impedisce l'uso di mosse con effetti aggiuntivi. Il danno aumenta del 20% per ogni waifu Arcana alleata in campo.",
    effect: { kind: 'debuff', status: 'silenzio', label: 'Silenzio', durataTurni: 1, aoe: true },
    flavorText: 'Per un istante, la luce smette di esistere. E con essa, ogni magia.',
    isUltimate: true, imageFileName: 'ECLISSI ARCANA _ Arcana_2.png', imageUrl: mk('ECLISSI ARCANA _ Arcana_2.png'),
  },
  {
    id: 'sciame-spine', name: 'Sciame di Spine', type: 'natura', damage: 45,
    additionalEffectLabel: '+ Avvelenamento 3 turni',
    effectDescription: 'Applica Avvelenamento per 3 turni: -12 HP a inizio turno. Il veleno si cumula fino a un massimo di 2 applicazioni contemporanee.',
    effect: { kind: 'dot', status: 'veleno', label: 'Avvelenamento', durataTurni: 3, dannoPerTurno: 12 },
    flavorText: 'Ogni spina porta con sé un pezzo di foresta che non perdona.',
    isUltimate: false, imageFileName: 'SCIAME DI SPINE _ Natura.png', imageUrl: mk('SCIAME DI SPINE _ Natura.png'),
  },
  {
    id: 'respiro-foresta', name: 'Respiro della Foresta', type: 'natura', damage: 0,
    additionalEffectLabel: 'Cura 40 HP + Rigenerazione',
    effectDescription: 'Cura 40 HP immediati e applica Rigenerazione per 3 turni: +10 HP a inizio turno. Non infligge danno.',
    effect: { kind: 'buff', status: 'rigenerazione', label: 'Rigenerazione +10/t', durataTurni: 3 },
    flavorText: 'La foresta non dimentica nessuno dei suoi figli.',
    isUltimate: false, imageFileName: 'RESPIRO DELLA FORESTA _ Natura_2.png', imageUrl: mk('RESPIRO DELLA FORESTA _ Natura_2.png'),
  },
  {
    id: 'morso-liana', name: 'Morso di Liana', type: 'natura', damage: 50,
    additionalEffectLabel: '+ Trascina e Stordisce 1 turno',
    effectDescription: 'Trascina il bersaglio in prima linea (se in seconda fila) e lo Stordisce per 1 turno: salta il turno successivo.',
    effect: { kind: 'control', status: 'stordimento', label: 'Stordita', durataTurni: 1 },
    flavorText: 'Non vedrai la liana finché non sarà già troppo tardi.',
    isUltimate: false, imageFileName: 'MORSO DI LIANA _ Natura_2.png', imageUrl: mk('MORSO DI LIANA _ Natura_2.png'),
  },
  {
    id: 'lama-rotante', name: 'Lama Rotante', type: 'ferro', damage: 75,
    multiHit: { hits: 3, damagePerHit: 25 },
    additionalEffectLabel: '= 75 totale (multi-hit rotante)',
    effectDescription: 'Colpisce 3 volte in sequenza ruotando su se stessa. Ogni colpo ha il 15% di probabilità di infliggere un colpo critico aggiuntivo (+50% danno su quel colpo).',
    flavorText: 'Un vortice di lame non chiede dove colpire. Colpisce ovunque.',
    isUltimate: false, imageFileName: 'LAMA ROTANTE _ Ferro_2.png', imageUrl: mk('LAMA ROTANTE _ Ferro_2.png'),
  },
  {
    id: 'muro-acciaio', name: "Muro d'Acciaio", type: 'ferro', damage: 0,
    additionalEffectLabel: '+ Difesa +50% per 2 turni a tutta la squadra',
    effectDescription: 'Non infligge danno. Aumenta la Difesa di tutta la squadra del 50% per 2 turni. Può essere usata anche se questa waifu è stordita.',
    effect: { kind: 'buff', status: 'difesa_su', label: 'Difesa squadra +50%', durataTurni: 2 },
    flavorText: "Dietro un muro d'acciaio, anche i cuori più fragili resistono.",
    isUltimate: false, imageFileName: "MURO D'ACCIAIO _ Ferro_2.png", imageUrl: mk("MURO D'ACCIAIO _ Ferro_2.png"),
  },
  {
    id: 'giudizio-ferro', name: 'Giudizio di Ferro', type: 'ferro', damage: 180,
    additionalEffectLabel: 'danno massiccio + ignora Difesa',
    effectDescription: 'Usabile 1 sola volta per partita. Infligge 180 danno ignorando completamente la Difesa del bersaglio. Non può essere bloccata da scudi.',
    flavorText: 'Non esiste appello contro un verdetto scolpito nel ferro.',
    isUltimate: true, imageFileName: 'GIUDIZIO DI FERRO _ Ferro_2.png', imageUrl: mk('GIUDIZIO DI FERRO _ Ferro_2.png'),
  },
  {
    id: 'catene-spettrali', name: 'Catene Spettrali', type: 'abisso', damage: 30,
    additionalEffectLabel: '+ Immobilizza 1 turno + rimuove 1 buff',
    effectDescription: 'Immobilizza il bersaglio per 1 turno e rimuove un buff attivo a scelta. Funziona anche contro bersagli con immunità ai debuff fisici.',
    effect: { kind: 'control', status: 'immobilizzo', label: 'Immobilizzata', durataTurni: 1 },
    flavorText: 'Non sono fatte di ferro. Sono fatte di paura.',
    isUltimate: false, imageFileName: 'CATENE SPETTRALI _ Abisso_2.png', imageUrl: mk('CATENE SPETTRALI _ Abisso_2.png'),
  },
  {
    id: 'eco-vuoto', name: 'Eco del Vuoto', type: 'abisso', damage: 35,
    additionalEffectLabel: '+ Drena 20 HP a fine turno per 3 turni',
    effectDescription: 'Per 3 turni, a fine turno il bersaglio perde 20 HP e questa waifu recupera la metà di quel danno come cura.',
    effect: { kind: 'dot', status: 'drenaggio', label: 'Drenaggio', durataTurni: 3, dannoPerTurno: 20 },
    flavorText: 'Ogni eco che ritorna porta con sé un pezzo di te.',
    isUltimate: false, imageFileName: 'ECO DEL VUOTO _ Abisso.png', imageUrl: mk('ECO DEL VUOTO _ Abisso.png'),
  },
  {
    id: 'notte-eterna', name: 'Notte Eterna', type: 'abisso', damage: 70,
    additionalEffectLabel: 'danno a tutti + Accecamento 2 turni',
    effectDescription: 'Usabile 1 sola volta per partita. Infligge danno a tutti i nemici e applica Accecamento per 2 turni: -40% probabilità di colpire con attacchi base.',
    effect: { kind: 'debuff', status: 'accecamento', label: 'Accecamento', durataTurni: 2, aoe: true },
    flavorText: 'Quando cala la notte eterna, anche i coraggiosi smettono di vedere la strada.',
    isUltimate: true, imageFileName: 'NOTTE ETERNA _ Abisso_2.png', imageUrl: mk('NOTTE ETERNA _ Abisso_2.png'),
  },
  {
    id: 'lancia-infuocata', name: 'Lancia Infuocata', type: 'fuoco', damage: 75,
    additionalEffectLabel: '+ Perfora Scudi',
    effectDescription: 'Infligge 75 danno ignorando qualsiasi Scudo attivo sul bersaglio. Se il colpo è critico, applica anche Bruciatura per 1 turno.',
    flavorText: 'Nessuno scudo è mai stato forgiato per fermare il fuoco puro.',
    isUltimate: false, imageFileName: 'LANCIA INFUOCATA _ Fuoco.png', imageUrl: mk('LANCIA INFUOCATA _ Fuoco.png'),
  },
  {
    id: 'cenere-vivente', name: 'Cenere Vivente', type: 'fuoco', damage: 30,
    additionalEffectLabel: '+ Bruciatura propagante 3 turni',
    effectDescription: 'Applica Bruciatura per 3 turni che si propaga: a ogni turno, 30% di probabilità di applicare Bruciatura anche a un alleato del bersaglio.',
    effect: { kind: 'dot', status: 'bruciatura', label: 'Bruciatura propagante', durataTurni: 3, dannoPerTurno: 15 },
    flavorText: 'La cenere non smette mai davvero di bruciare. Aspetta solo di diffondersi.',
    isUltimate: false, imageFileName: 'CENERE VIVENTE _ Fuoco.png', imageUrl: mk('CENERE VIVENTE _ Fuoco.png'),
  },
  {
    id: 'frusta-magma', name: 'Frusta di Magma', type: 'fuoco', damage: 60,
    additionalEffectLabel: '+ Riduce Velocità 30% per 2 turni',
    effectDescription: 'Infligge 60 danno e riduce la Velocità del bersaglio del 30% per 2 turni. Il terreno scottato lascia Bruciatura leggera (-5 HP) per 1 turno.',
    effect: { kind: 'debuff', status: 'velocita_giu', label: 'Velocità -30%', durataTurni: 2 },
    flavorText: 'Dove passa la frusta di magma, anche la terra ricorda il dolore.',
    isUltimate: false, imageFileName: 'FRUSTA DI MAGMA _ Fuoco_2.png', imageUrl: mk('FRUSTA DI MAGMA _ Fuoco_2.png'),
  },

  // ── Espansione mosse #3 (20 nuove) ────────────────────────────────────────
  { id:'rune-fulminanti', name:'Rune Fulminanti', type:'arcana', damage:60, pp:10, additionalEffectLabel:'+ Stordisce 25%',
    effectDescription:'Lancia 6 rune arcane che esplodono simultaneamente in fulmini. Ogni runa ha il 25% di probabilità di stordire il bersaglio per 1 turno.',
    effect:{ kind:'control', status:'stordimento', label:'Stordimento', durataTurni:1 },
    flavorText:'Sei promesse di dolore, tutte mantenute nello stesso istante.',
    isUltimate:false, imageFileName:'RUNE FULMINANTI _ Arcana.png', imageUrl: mk('RUNE FULMINANTI _ Arcana.png') },
  { id:'luce-sorgiva', name:'Luce Sorgiva', type:'arcana', damage:0, pp:15, additionalEffectLabel:'+ Cura 50 HP squadra + Magia +30%',
    effectDescription:'Non infligge danno. Cura 50 HP a tutta la squadra e aumenta la statistica Magia di tutte le waifu Arcana alleate in campo del 30% per 2 turni.',
    effect:{ kind:'buff', status:'magia_su', label:'Magia +30%', durataTurni:2 },
    flavorText:'Quando la luce sorge dal basso, anche i caduti si rialzano.',
    isUltimate:false, imageFileName:'LUCE SORGIVA _ Arcana_2.png', imageUrl: mk('LUCE SORGIVA _ Arcana_2.png') },
  { id:'lama-eterea', name:'Lama Eterea', type:'arcana', damage:80, pp:10, additionalEffectLabel:'+ Ignora 40% Difesa',
    effectDescription:'Lancia una lama di energia arcana pura che penetra le difese: ignora il 40% della Difesa del bersaglio. Danni aumentati del 20% contro bersagli con buff attivi.',
    flavorText:'Non è fatta di metallo. È fatta di intenzione pura.',
    isUltimate:false, imageFileName:'LAMA ETEREA _ Arcana_2.png', imageUrl: mk('LAMA ETEREA _ Arcana_2.png') },
  { id:'tempesta-stelle', name:'Tempesta di Stelle', type:'arcana', damage:140, pp:5, additionalEffectLabel:'danno distribuito su tutti i nemici',
    effectDescription:'Usabile 1 sola volta per partita. Pioggia di stelle arcane su tutti i nemici in campo. Il danno si divide tra i bersagli presenti (minimo 60 per bersaglio). Applica Silenzio per 1 turno a tutti i colpiti.',
    effect:{ kind:'debuff', status:'silenzio', label:'Silenzio', durataTurni:1, aoe:true },
    flavorText:'Il cielo non sceglie dove cadere. Cade ovunque.',
    isUltimate:true, imageFileName:'TEMPESTA DI STELLE _ Arcana_2.png', imageUrl: mk('TEMPESTA DI STELLE _ Arcana_2.png') },
  { id:'nube-tossica', name:'Nube Tossica', type:'natura', damage:20, pp:15, additionalEffectLabel:'+ Veleno Potente su tutti i nemici',
    effectDescription:'Applica Veleno Potente a tutti i nemici in campo: -18 HP a inizio turno per 3 turni. Il veleno è resistente — non può essere rimosso da effetti curativi standard.',
    effect:{ kind:'dot', status:'veleno', label:'Veleno Potente', durataTurni:3, dannoPerTurno:18, aoe:true },
    flavorText:'Respira pure. È già troppo tardi.',
    isUltimate:false, imageFileName:'NUBE TOSSICA _ Natura.png', imageUrl: mk('NUBE TOSSICA _ Natura.png') },
  { id:'fulmine-verde', name:'Fulmine Verde', type:'natura', damage:95, pp:8, additionalEffectLabel:'+ Critico 35% + Paralisi 50%',
    effectDescription:'Colpo critico garantito al 35%. Se il colpo è critico, applica anche Paralisi: 50% di probabilità di saltare il turno successivo per 1 turno.',
    effect:{ kind:'control', status:'paralisi', label:'Paralisi', durataTurni:1 },
    flavorText:'La natura non avverte quando decide di colpire.',
    isUltimate:false, imageFileName:'FULMINE VERDE _ Natura_2.png', imageUrl: mk('FULMINE VERDE _ Natura_2.png') },
  { id:'geyser-vita', name:'Geyser di Vita', type:'natura', damage:0, pp:15, additionalEffectLabel:'+ Cura 60 HP + Rigenerazione Intensa',
    effectDescription:'Non infligge danno. Cura 60 HP immediati e applica Rigenerazione Intensa per 3 turni: +20 HP a inizio turno. Rimuove anche 1 effetto di stato negativo attivo.',
    effect:{ kind:'buff', status:'rigenerazione', label:'Rigenerazione +20/t', durataTurni:3 },
    flavorText:'La terra non dimentica il sapore della vita.',
    isUltimate:false, imageFileName:'GEYSER DI VITA _ Natura_2.png', imageUrl: mk('GEYSER DI VITA _ Natura_2.png') },
  { id:'fauci-terra', name:'Fauci della Terra', type:'natura', damage:100, pp:8, additionalEffectLabel:'+ Intrappola 2 turni + Critico elevato',
    effectDescription:'Alto tasso di colpi critici. Se colpisce, intrappola il bersaglio per 2 turni: non può fuggire, non può usare carte supporto e subisce +15% danno da attacchi successivi.',
    effect:{ kind:'control', status:'intrappolamento', label:'Intrappolata', durataTurni:2 },
    flavorText:'La terra non deve inseguire le sue prede.',
    isUltimate:false, imageFileName:'FAUCI DELLA TERRA _ Natura_2.png', imageUrl: mk('FAUCI DELLA TERRA _ Natura_2.png') },
  { id:'schegge-titanio', name:'Schegge di Titanio', type:'ferro', damage:100, pp:8, multiHit:{ hits:5, damagePerHit:20 }, additionalEffectLabel:'20 × 5 = 100 (multi-hit) + Difesa -5% per colpo',
    effectDescription:'Colpisce 5 volte in rapida successione. Ogni colpo riduce cumulativamente la Difesa del bersaglio del 5% (massimo -25% dopo i 5 colpi). Il bonus rimane per 2 turni.',
    effect:{ kind:'debuff', status:'difesa_giu', label:'Difesa -25%', durataTurni:2 },
    flavorText:'Cinque ferite, ognuna più facile della precedente.',
    isUltimate:false, imageFileName:'SCHEGGE DI TITANIO _ Ferro_2.png', imageUrl: mk('SCHEGGE DI TITANIO _ Ferro_2.png') },
  { id:'colpo-gravita', name:'Colpo di Gravità', type:'ferro', damage:70, pp:10, additionalEffectLabel:'+ Azzera buff Velocità e Difesa nemico',
    effectDescription:'Infligge 70 danno e rimuove istantaneamente tutti i buff attivi di Velocità e Difesa del bersaglio. Se il bersaglio era potenziato, il danno aumenta del 30%.',
    flavorText:'Contro la gravità non esiste schermo che tenga.',
    isUltimate:false, imageFileName:'COLPO DI GRAVITÀ _ Ferro.png', imageUrl: mk('COLPO DI GRAVITÀ _ Ferro.png') },
  { id:'campo-magnetico', name:'Campo Magnetico', type:'ferro', damage:85, pp:10, additionalEffectLabel:'+ 20% di far cadere un equipaggiamento',
    effectDescription:'Attira tutti i frammenti metallici in campo e li lancia contro il bersaglio. 20% di probabilità di far cadere 1 carta equipaggiamento attiva dal bersaglio. Danno aumentato del 10% per ogni oggetto metallico in campo.',
    flavorText:'Non importa dove si nascondono. Il metallo risponde sempre alla chiamata.',
    isUltimate:false, imageFileName:'CAMPO MAGNETICO _ Ferro.png', imageUrl: mk('CAMPO MAGNETICO _ Ferro.png') },
  { id:'lancio-orbitale', name:'Lancio Orbitale', type:'ferro', damage:155, pp:5, additionalEffectLabel:'danno massiccio + ignora Scudi e Armature',
    effectDescription:'Usabile 1 sola volta per partita. Proiettile a velocità orbitale che ignora completamente Scudi, Armature e Difese passive. Non può essere bloccato, riflesso o deviato.',
    flavorText:'A quella velocità, anche la realtà non fa in tempo a reagire.',
    isUltimate:true, imageFileName:'LANCIO ORBITALE _ Ferro.png', imageUrl: mk('LANCIO ORBITALE _ Ferro.png') },
  { id:'maledizione-sangue', name:'Maledizione di Sangue', type:'abisso', damage:45, pp:12, additionalEffectLabel:'+ Maledizione Sanguinosa 4 turni',
    effectDescription:"Applica Maledizione Sanguinosa per 4 turni: ogni volta che il bersaglio esegue un attacco, perde 15 HP aggiuntivi. L'effetto si attiva anche con abilità passive.",
    effect:{ kind:'dot', status:'maledizione', label:'Maledizione', durataTurni:4, dannoPerTurno:15 },
    flavorText:'Ogni colpo che sferri torna a colpirti.',
    isUltimate:false, imageFileName:'MALEDIZIONE DI SANGUE _ Abisso_2.png', imageUrl: mk('MALEDIZIONE DI SANGUE _ Abisso_2.png') },
  { id:'doppelganger-oscuro', name:'Doppelganger Oscuro', type:'abisso', damage:65, pp:10, additionalEffectLabel:'+ Clone oscuro 1 turno + Precisione -20%',
    effectDescription:'Evoca un clone oscuro che attacca il bersaglio per 1 turno infliggendo il 60% del danno base di questa waifu. Il bersaglio, disorientato, subisce -20% alla precisione per 1 turno.',
    effect:{ kind:'debuff', status:'precisione_giu', label:'Precisione -20%', durataTurni:1 },
    flavorText:'Come fa a combattere ciò che non sa distinguere?',
    isUltimate:false, imageFileName:'DOPPELGANGER OSCURO _ Abisso_2.png', imageUrl: mk('DOPPELGANGER OSCURO _ Abisso_2.png') },
  { id:'risucchio-vitale', name:'Risucchio Vitale', type:'abisso', damage:55, pp:10, additionalEffectLabel:'+ Lifesteal 100% su questa mossa',
    effectDescription:'Il 100% del danno inflitto con questa mossa viene assorbito come HP da questa waifu. Se il bersaglio è avvelenato o maledetto, il danno rubato aumenta del 50%.',
    flavorText:'Non prende la tua vita. La fa sua.',
    isUltimate:false, imageFileName:'RISUCCHIO VITALE _ Abisso.png', imageUrl: mk('RISUCCHIO VITALE _ Abisso.png') },
  { id:'disintegrazione', name:'Disintegrazione', type:'abisso', damage:160, pp:5, additionalEffectLabel:'bypassa tutto + 10% KO istantaneo',
    effectDescription:'Usabile 1 sola volta per partita. Bypassa tutti gli effetti passivi, immunità e scudi. 10% di probabilità di KO istantaneo indipendentemente dagli HP. Non può essere annullata.',
    flavorText:'Non la puoi bloccare. Non la puoi riflettere. Non puoi nemmeno vederla arrivare.',
    isUltimate:true, imageFileName:'DISINTEGRAZIONE _ Abisso.png', imageUrl: mk('DISINTEGRAZIONE _ Abisso.png') },
  { id:'meteora', name:'Meteora', type:'fuoco', damage:85, pp:8, additionalEffectLabel:'+ danno ad area + Bruciatura a tutti i colpiti',
    effectDescription:'Infligge 85 danno al bersaglio principale e 40 ai due nemici adiacenti. Applica Bruciatura per 2 turni a tutti i colpiti.',
    effect:{ kind:'dot', status:'bruciatura', label:'Bruciatura', durataTurni:2, dannoPerTurno:20, aoe:true },
    flavorText:'Il cielo ha deciso che è il momento. Non ci sono appelli.',
    isUltimate:false, imageFileName:'METEORA _ Fuoco_2.png', imageUrl: mk('METEORA _ Fuoco_2.png') },
  { id:'supernova', name:'Supernova', type:'fuoco', damage:175, pp:5, additionalEffectLabel:'danno a tutti i nemici — solo sotto 50% HP',
    effectDescription:'Usabile 1 sola volta per partita. Infligge 175 danno a tutti i nemici in campo. Può essere usata solo se questa waifu ha HP inferiori al 50%. Applica Bruciatura Intensa a tutti i sopravvissuti.',
    effect:{ kind:'dot', status:'bruciatura', label:'Bruciatura Intensa', durataTurni:2, dannoPerTurno:25, aoe:true },
    flavorText:'Quando non ha più nulla da perdere, diventa la cosa più pericolosa in campo.',
    isUltimate:true, imageFileName:'SUPERNOVA _ Fuoco.png', imageUrl: mk('SUPERNOVA _ Fuoco.png') },
  { id:'esplosione-sonica', name:'Esplosione Sonica', type:'fuoco', damage:80, pp:8, additionalEffectLabel:'+ Rimuove tutti gli Scudi nemici in campo',
    effectDescription:"Rimuove tutti gli Scudi attivi di tutti i nemici in campo prima di infliggere 80 danno al bersaglio principale. Nessuno scudo sopravvive all'onda d'urto.",
    flavorText:'Prima sgombra il campo. Poi colpisce.',
    isUltimate:false, imageFileName:'ESPLOSIONE SONICA _ Fuoco_2.png', imageUrl: mk('ESPLOSIONE SONICA _ Fuoco_2.png') },
  { id:'artiglio-sole', name:'Artiglio del Sole', type:'fuoco', damage:90, pp:8, additionalEffectLabel:'+ Bruciatura Solare 2 turni',
    effectDescription:'Tre artigli di fuoco solare. Infligge 90 danno e applica Bruciatura Solare per 2 turni: -25 HP per turno, più potente della Bruciatura normale e non cumulabile con essa.',
    effect:{ kind:'dot', status:'bruciatura', label:'Bruciatura Solare', durataTurni:2, dannoPerTurno:25 },
    flavorText:'Tre graffi. Tre ricordi che non svaniranno.',
    isUltimate:false, imageFileName:'ARTIGLIO DEL SOLE _ Fuoco.png', imageUrl: mk('ARTIGLIO DEL SOLE _ Fuoco.png') },
]
