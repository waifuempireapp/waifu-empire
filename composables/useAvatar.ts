// useAvatar — gestisce l'avatar utente.
// Valori salvati (campo profilo.avatarUrl su Firestore):
//   null          → avatar default "WE" (accent primary)
//   'preset-xxx'  → id stabile di un'icona in assets/images/icons/ (consigliato)
//   '#xxxxxx'     → cerchio colorato (legacy)
//   'https://...' o '/...' → immagine remota (legacy)
//
// L'avatar è persistito su Firebase (profilo utente), NON in localStorage, così
// segue l'utente su ogni dispositivo. Salviamo l'id stabile del preset (non
// l'URL con hash Vite, che cambia ad ogni build).
//
// Sblocco icone: le 3 base (akane, aria, blaze) sono sempre disponibili; le
// altre si sbloccano quando l'utente possiede la waifu corrispondente.
//
// Per aggiungere nuovi avatar: basta copiare un file in assets/images/icons/
// con nome "CODICE — Descrizione.png" — viene incluso automaticamente.

import { useGameStore } from '~/stores/game'
import { useAuthStore } from '~/stores/auth'
import { updateUserProfile } from '~/utils/firestoreService'

// Icone sempre disponibili dall'inizio (id waifu in minuscolo).
export const BASE_AVATAR_IDS = ['akane', 'aria', 'blaze']

export function useAvatar() {
  const gameStore = useGameStore()
  const authStore = useAuthStore()

  // Valore grezzo salvato sul profilo (preset id / hex / url / null)
  const avatarValue = computed<string | null>(
    () => (gameStore.profilo?.avatarUrl as string | null) ?? null,
  )

  // URL/colore risolto pronto per il rendering
  const avatarUrl = computed<string | null>(() => resolveAvatarUrl(avatarValue.value))

  async function setAvatar(value: string | null) {
    // Aggiornamento ottimistico nello store
    gameStore.aggiornaProfilo({ avatarUrl: value } as never)
    const uid = authStore.user?.uid
    if (uid) {
      try { await updateUserProfile(uid, { avatarUrl: value ?? null }) }
      catch (e) { console.error('[useAvatar] salvataggio fallito', e) }
    }
  }

  return { avatarUrl, avatarValue, setAvatar }
}

// Preset avatar — immagini da assets/images/icons/.
export type AvatarPreset = {
  id: string          // 'preset-momo'
  waifuId: string     // 'momo' — id della waifu da possedere per sbloccarla
  label: string
  image: string       // URL asset (hashed Vite)
  color?: never
}

// Carica automaticamente tutti i file .png dalla cartella icons.
// import.meta.glob è risolto da Vite a build-time.
const iconModules = import.meta.glob<{ default: string }>(
  '~/assets/images/icons/*.png',
  { eager: true },
)

export const AVATAR_PRESETS: AvatarPreset[] = Object.entries(iconModules).map(([path, mod]) => {
  // Nome file: "MOMO — La cat girl adorabile_2.png" oppure "AKANE - La ...png"
  // Il codice è la parte prima del primo trattino (em-dash, en-dash o hyphen)
  // circondato da spazi. waifuId = codice in minuscolo.
  const filename = (path.split('/').pop() ?? '').replace(/\.png$/i, '')
  const code = filename.split(/\s[—–-]\s/)[0]?.trim() ?? filename
  const desc = filename.slice(code.length).replace(/^\s*[—–-]\s*/, '').trim()
  const waifuId = code.toLowerCase()
  return { id: `preset-${waifuId}`, waifuId, image: mod.default, label: desc || code }
})

// Mappa waifuId → preset (per lo sblocco e la notifica)
export const AVATAR_BY_WAIFU: Record<string, AvatarPreset> = Object.fromEntries(
  AVATAR_PRESETS.map(p => [p.waifuId, p]),
)

/** True se l'icona è sbloccata: base oppure waifu posseduta. */
export function isAvatarUnlocked(preset: AvatarPreset, ownedWaifuIds: Set<string>): boolean {
  return BASE_AVATAR_IDS.includes(preset.waifuId) || ownedWaifuIds.has(preset.waifuId)
}

/** Risolve il valore salvato in URL/colore renderizzabile. */
export function resolveAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('preset-')) {
    return AVATAR_PRESETS.find(p => p.id === value)?.image ?? null
  }
  return value // legacy: hex color o url diretto
}
