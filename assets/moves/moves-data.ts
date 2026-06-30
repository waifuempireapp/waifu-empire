// ============================================================
// WAIFU EMPIRE — DATI MOSSE
// Dati delle mosse del gioco usati dai componenti vetrina
// (components/moves/MoveCard.vue, MovesList.vue).
// ============================================================

export type MoveType = 'arcana' | 'natura' | 'ferro' | 'abisso' | 'fuoco'

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
  damage: number                  // POTENZA indicativa (stile Pokémon), non HP reali
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
const mk = (fileName: string) => `${IMAGEKIT_BASE}/${encodeURI(fileName)}`

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
]
