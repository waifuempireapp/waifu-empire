// GENERATO da scripts/build-splash-cards.mjs — non modificare a mano.
// Carte dell'ultima espansione (Impero delle Arti) mostrate nello splash di avvio.
// Le stesse carte, con la stessa cornice, sono scritte anche nel blocco generato
// dentro spa-loading-template.html: i due splash devono coincidere al pixel,
// altrimenti al passaggio HTML statico → bundle si vede un salto.

export interface SplashCard {
  file: string
  nome: string
  rarita: 'comune' | 'raro' | 'epico' | 'leggendario' | 'immersivo'
  /** d1 primo piano, d2 intermedia, d3 sfondo — decide misura, sfocatura e dettagli. */
  profondita: 'd1' | 'd2' | 'd3'
  /** HP, velocità e crit% calcolati con le STESSE formule della carta vera. */
  hp: number
  vel: number
  crit: number
  /** tette, taglia_piedi, eta, colore_capelli, esperienza — scala 1-10. */
  stat: number[]
}

/** Colori dei cinque cerchi, nell'ordine di `stat`. Come in CartaWaifu.vue. */
export const SPLASH_STAT_COLORI = ['#ff9ec6', '#b573ff', '#6cf0e0', '#ffc861', '#a78bfa']

export const SPLASH_CARDS: SplashCard[] = [
  { file: '/splash/card1.webp', nome: "ADAORA", rarita: 'comune', profondita: 'd1', hp: 159, vel: 195, crit: 20, stat: [9, 4, 7, 5, 4] },
  { file: '/splash/card2.webp', nome: "BEATRICE", rarita: 'comune', profondita: 'd3', hp: 190, vel: 212, crit: 20, stat: [4, 7, 10, 10, 9] },
  { file: '/splash/card3.webp', nome: "CELIA", rarita: 'epico', profondita: 'd2', hp: 300, vel: 612, crit: 39, stat: [7, 6, 1, 3, 6] },
  { file: '/splash/card4.webp', nome: "COSIMA", rarita: 'leggendario', profondita: 'd3', hp: 398, vel: 850, crit: 36, stat: [1, 10, 5, 1, 10] },
  { file: '/splash/card5.webp', nome: "EDITH", rarita: 'comune', profondita: 'd1', hp: 168, vel: 201, crit: 20, stat: [9, 8, 1, 7, 4] },
  { file: '/splash/card6.webp', nome: "ELOISE", rarita: 'comune', profondita: 'd2', hp: 150, vel: 245, crit: 20, stat: [8, 3, 8, 2, 5] },
  { file: '/splash/card7.webp', nome: "GRETEL", rarita: 'comune', profondita: 'd3', hp: 128, vel: 262, crit: 20, stat: [8, 3, 4, 2, 3] },
  { file: '/splash/card8.webp', nome: "HILDA", rarita: 'comune', profondita: 'd2', hp: 106, vel: 284, crit: 20, stat: [1, 4, 7, 5, 4] },
  { file: '/splash/card9.webp', nome: "IRENE", rarita: 'comune', profondita: 'd1', hp: 124, vel: 234, crit: 20, stat: [4, 5, 4, 8, 3] },
  { file: '/splash/card10.webp', nome: "KAI", rarita: 'immersivo', profondita: 'd3', hp: 576, vel: 677, crit: 60, stat: [10, 3, 10, 4, 8] },
  { file: '/splash/card11.webp', nome: "MAREN", rarita: 'epico', profondita: 'd2', hp: 362, vel: 312, crit: 40, stat: [8, 7, 6, 10, 5] },
  { file: '/splash/card12.webp', nome: "MIRA", rarita: 'comune', profondita: 'd3', hp: 106, vel: 289, crit: 20, stat: [4, 3, 4, 4, 3] },
  { file: '/splash/card13.webp', nome: "NORA", rarita: 'comune', profondita: 'd1', hp: 132, vel: 223, crit: 20, stat: [3, 6, 7, 7, 4] },
  { file: '/splash/card14.webp', nome: "PALOMA", rarita: 'comune', profondita: 'd2', hp: 141, vel: 217, crit: 20, stat: [3, 10, 5, 5, 4] },
  { file: '/splash/card15.webp', nome: "REN", rarita: 'leggendario', profondita: 'd3', hp: 441, vel: 626, crit: 52, stat: [2, 9, 8, 8, 9] },
]
