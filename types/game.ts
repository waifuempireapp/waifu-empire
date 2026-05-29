// ============================================================
// TIPI TypeScript — Modelli di dati del gioco
// Tutti i tipi condivisi tra componenti, stores e utils.
// Rispecchiano la struttura dei documenti Firestore.
// ============================================================

// ── RARITÀ ──────────────────────────────────────────────────
export type Rarita = 'comune' | 'raro' | 'epico' | 'leggendario' | 'immersivo'

// ── PROFILO UTENTE ──────────────────────────────────────────
export interface ProfiloUtente {
  id: string
  uid: string
  displayName: string
  email: string
  nomeImpero: string
  coloreImpero: string
  kisses: number
  energia: number
  livello: number
  xp: number
  friendId: string
  // Statistiche di combattimento
  vittorie: number
  sconfitte: number
  // Timestamp ricariche
  ultimaRicaricaPacchetti?: unknown
  ultimaRicaricaEnergia?: unknown
  ultimaRicaricaOmaggio?: unknown
  // Versione stats (per migrazione automatica)
  stats_version?: number
  // Trade pass (abbonamento)
  tradePassActive?: boolean
  tradePassExpiry?: number
  // Swap pass
  swapPassActive?: boolean
  [key: string]: unknown
}

// ── WAIFU IN COLLEZIONE ─────────────────────────────────────
export interface WaifuInCollezione {
  copie: number
  livello: number
  stat_bonus: Record<string, number>
  trovata_il?: number
  preferita?: boolean
  // Stats combattimento
  attacco?: number
  difesa?: number
  velocita?: number
  vita?: number
  crit_chance?: number
  // Outfit e pose equipaggiate
  outfitEquipaggiato?: string
  posaEquipaggiata?: string
  // Mosse attacco assegnate
  mosse?: string[]
}

// ── COLLEZIONE ──────────────────────────────────────────────
export interface Collezione {
  waifu: Record<string, WaifuInCollezione>
  outfit: Record<string, { quantita: number; trovata_il?: number }>
  pose: Record<string, { quantita: number; trovata_il?: number }>
  // Team di difesa preimpostati
  preset?: Record<string, string[]>
}

// ── CATALOGO WAIFU ──────────────────────────────────────────
export interface WaifuCatalog {
  id: string
  nome: string
  rarita: Rarita
  serie?: string
  imageUrl?: string
  imagekit_id?: string
  // Stats base
  attacco_base: number
  difesa_base: number
  velocita_base: number
  vita_base: number
  crit_chance_base?: number
  // Metadati
  hot?: boolean
  nuova?: boolean
  comune_id?: string
  [key: string]: unknown
}

// ── CATALOGO MOSSE ──────────────────────────────────────────
export interface MossaCatalog {
  id: string
  nome: string
  rarita: Rarita
  danno: number
  danno_critico: number
  pp: number
  pp_max: number
  livello: number
  tipo?: string
  descrizione?: string
  [key: string]: unknown
}

// ── DROP ATTIVO (banner gacha) ───────────────────────────────
export interface DropAttivo {
  id: string
  nome: string
  tipo: string
  waifu_ids?: string[]
  inizioMs?: number
  fineMs?: number
  attivo?: boolean
  [key: string]: unknown
}

// ── CLASSIFICA ──────────────────────────────────────────────
export interface ClassificaEntry {
  uid: string
  nomeImpero: string
  coloreImpero: string
  punteggio: number
  posizione?: number
  vittorie?: number
  [key: string]: unknown
}

// ── AMICI ────────────────────────────────────────────────────
export interface AmiciEntry {
  uid: string
  displayName: string
  nomeImpero?: string
  coloreImpero?: string
  friendId?: string
  aggiuntoIl?: number
}

// ── RICHIESTE DI AMICIZIA ────────────────────────────────────
export interface FriendRequest {
  id: string
  fromUid: string
  fromDisplayName: string
  fromFriendId?: string
  timestamp?: number
  status: 'pending' | 'accepted' | 'rejected'
}

// ── TRADE (scambio P2P) ──────────────────────────────────────
export interface Trade {
  id: string
  fromUid: string
  toUid: string
  offerWaifuId: string
  requestWaifuId: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt?: unknown
  [key: string]: unknown
}

// ── PACK SNAPSHOT (pesca misteriosa) ────────────────────────
export interface PackSnapshot {
  id: string
  ownerUid: string
  cards: Array<{ id: string; tipo: string; rarita: string }>
  expiresAt?: unknown
  [key: string]: unknown
}

// ── PIXEL MAPPA ──────────────────────────────────────────────
export interface PixelInfo {
  x: number
  y: number
  ownerUid?: string
  ownerName?: string
  colore?: string
  difficulty?: number
  punti?: number
  [key: string]: unknown
}

// ── CONFIGURAZIONE NEGOZIO ───────────────────────────────────
export interface NegozioConfig {
  beni: Record<string, {
    label: string
    kisses: number
    descrizione?: string
    attivo?: boolean
  }>
  packs?: Record<string, unknown>
}

// ── CONFIGURAZIONE PESCA ─────────────────────────────────────
export interface PescaConfig {
  costo_kisses: number
  attivo: boolean
  [key: string]: unknown
}
