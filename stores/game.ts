// ============================================================
// STORE: Stato del gioco (Pinia)
// Contiene profilo utente, collezione waifu, catalogo,
// classifica, amici e tutto lo stato globale di gioco.
// Sostituisce lo stato locale nel file gioco/page.jsx di Next.js.
// ============================================================

import { defineStore } from 'pinia'
import type {
  ProfiloUtente, Collezione, WaifuCatalog, MossaCatalog,
  DropAttivo, ClassificaEntry, AmiciEntry, FriendRequest
} from '~/types/game'

// Stato principale del gioco
interface GameState {
  // Profilo del giocatore corrente
  profilo: ProfiloUtente | null
  // Collezione waifu del giocatore
  collezione: Collezione | null
  // Catalogo globale waifu (lista dal DB)
  catalogoWaifu: WaifuCatalog[]
  // Catalogo mosse attacco
  catalogoMosse: MossaCatalog[]
  // Drop attivi (banner gacha)
  dropsAttivi: DropAttivo[]
  // Classifica globale (punti territorio)
  classifica: ClassificaEntry[]
  // Lista amici del giocatore
  amici: AmiciEntry[]
  // Richieste di amicizia in entrata
  richiesteAmicizia: FriendRequest[]
  // Classifica settimanale (punti swap)
  classificaSettimanale: ClassificaEntry[]
  // Tab attiva nella schermata di gioco
  tabAttiva: string
  // Overlay negozio aperto
  negozioAperto: boolean
  // Loading states
  loadingProfilo: boolean
  loadingCollezione: boolean
  loadingCatalogo: boolean
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    profilo:               null,
    collezione:            null,
    catalogoWaifu:         [],
    catalogoMosse:         [],
    dropsAttivi:           [],
    classifica:            [],
    amici:                 [],
    richiesteAmicizia:     [],
    classificaSettimanale: [],
    tabAttiva:             'home',
    negozioAperto:         false,
    loadingProfilo:        false,
    loadingCollezione:     false,
    loadingCatalogo:       false,
  }),

  getters: {
    // Numero di waifu in collezione
    totaleWaifu: (state): number =>
      Object.keys(state.collezione?.waifu ?? {}).length,

    // Kisses correnti del giocatore
    kisses: (state): number => state.profilo?.kisses ?? 0,

    // Energia corrente del giocatore
    energia: (state): number => state.profilo?.energia ?? 0,

    // Waifu preferite (marcate come preferite)
    waifuPreferite: (state): string[] =>
      Object.entries(state.collezione?.waifu ?? {})
        .filter(([, w]: [string, any]) => w.preferita)
        .map(([id]) => id),
  },

  actions: {
    // Imposta il profilo del giocatore (dopo lettura da Firestore)
    setProfilo(profilo: ProfiloUtente | null) {
      this.profilo = profilo
    },

    // Aggiorna parzialmente il profilo (es. dopo acquisto kisses)
    aggiornaProfilo(patch: Partial<ProfiloUtente>) {
      if (this.profilo) {
        this.profilo = { ...this.profilo, ...patch }
      }
    },

    // Imposta la collezione waifu
    setCollezione(collezione: Collezione | null) {
      this.collezione = collezione
    },

    // Imposta il catalogo waifu globale
    setCatalogoWaifu(waifu: WaifuCatalog[]) {
      this.catalogoWaifu = waifu
    },

    // Imposta il catalogo mosse
    setCatalogoMosse(mosse: MossaCatalog[]) {
      this.catalogoMosse = mosse
    },

    // Imposta i drop attivi
    setDropsAttivi(drops: DropAttivo[]) {
      this.dropsAttivi = drops
    },

    // Imposta la classifica
    setClassifica(classifica: ClassificaEntry[]) {
      this.classifica = classifica
    },

    // Imposta amici e richieste
    setAmici(amici: AmiciEntry[]) {
      this.amici = amici
    },
    setRichiesteAmicizia(richieste: FriendRequest[]) {
      this.richiesteAmicizia = richieste
    },

    // Cambia la tab attiva
    setTab(tab: string) {
      this.tabAttiva = tab
    },

    // Apre/chiude il negozio
    toggleNegozio(aperto: boolean) {
      this.negozioAperto = aperto
    },

    // Aggiorna i kisses nel profilo (dopo acquisto)
    setKisses(kisses: number) {
      if (this.profilo) this.profilo.kisses = kisses
    },

    // Reset completo dello store (es. al logout)
    reset() {
      this.profilo               = null
      this.collezione            = null
      this.catalogoWaifu         = []
      this.catalogoMosse         = []
      this.dropsAttivi           = []
      this.classifica            = []
      this.amici                 = []
      this.richiesteAmicizia     = []
      this.classificaSettimanale = []
      this.tabAttiva             = 'home'
      this.negozioAperto         = false
    },
  },
})
