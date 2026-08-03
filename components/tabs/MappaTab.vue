<!-- ============================================================
  Tab Mappa: mappa Risiko 50×50 per la conquista di territori.
  Migrato da: src/app/gioco/_redesign/MappaPixel.jsx
  Sotto-componenti inline: RaidWidget, MissionMapBadge, MissionDetailModal.
  Componenti mappa principali delegati a ~/components/mappa/* (da migrare).
  ============================================================ -->
<script setup lang="ts">
import { Trophy, Mail } from 'lucide-vue-next'
import { PIXEL_NAMES, LAND_SET, GRID_SIZE } from '~/utils/worldMap'
import { isHexAdjacentToEmpire } from '~/utils/hexGrid'
import { ikUrl } from '~/utils/imagekitUrl'
import { updateUserProfile } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'
import { useMissionsStore } from '~/stores/missions'

// ------------------------------------------------------------------ Props
const props = defineProps<{
  profilo: Record<string, unknown> | null
  collezione: Record<string, unknown> | null
  waifuCat: any[]
  mosseCat: any[]
  raidBattleCtx?: any
}>()

// ------------------------------------------------------------------ Emits
const emit = defineEmits<{
  notif:            [testo: string, colore: string]
  updateProfilo:    [p: unknown]
  updateCollezione: [c: unknown]
  raidBattle:       [ctx: any]
  raidBattleEnd:    [result: any]
}>()

// ------------------------------------------------------------------ Costanti locali (da _shared.jsx)
// Colori brand del design system
const C = {
  ink:     '#03020c',
  ink2:    '#0d0a26',
  inkLine: 'rgba(174,156,255,0.18)',
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
}

// Famiglie font brand
const FF = {
  display: "var(--ff-display, 'Fredoka', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

// ------------------------------------------------------------------ Store
const authStore     = useAuthStore()
const missionsStore = useMissionsStore()
const { t } = useI18n()

// ------------------------------------------------------------------ Stato principale
const chunks          = ref<any>(null)
const swapConfig      = ref<any>(null)
const loading         = ref(true)
const selectedPixel   = ref<any>(null)
const myDefenseMap    = ref<Record<string, any[]>>({}) // defense_config dell'utente corrente

const pendingOffersCount = ref(0)
const attackError        = ref<string | null>(null)
// Territori sotto attacco: "x_y" → true se l'attacco è MIO (X verde), false se
// di altri (X rossa, non attaccabile). Popolato da /api/mappa/active-attacks.
const attackSet          = ref<Record<string, boolean>>({})
// Popup "territorio già sotto attacco" (al tap sulla X rossa)
const underAttackPopup   = ref(false)
const showInfoModal      = ref(false)
const conquestAnim       = ref<any>(null) // { pixelName, oldColor, newColor, empireName }
// Popup PREMI VITTORIA: appare DOPO l'animazione di conquista
const PREMIO_VITTORIA_KISSES = 17   // 1/3 del costo di una bustina (50)
const victoryReward      = ref<{ kisses: number } | null>(null)
const showBattle         = ref(false)
const raidAttackMode     = ref(false) // distingue BattleModal normale da raid
const showRound          = ref(false)
const showPurchase       = ref(false)
// Kisses insufficienti per comprare un territorio → popup di ricarica (shop)
const kissesShortMissing = ref<number | null>(null)
const showOffers         = ref(false)
const showLeaderboard    = ref(false)
const showTutorial       = ref(false)
const showDefenseEditor  = ref(false)
const activeBattle       = ref<any>(null)
const showRaidPanel      = ref(false)
const raidInfo           = ref<any>(null)
// True se l'utente ha già vinto il raid corrente → mostra solo il countdown al prossimo
const raidWon            = ref(false)
const activeMission      = ref<any>(null)
const showMissionDetail  = ref(false)
const missionFocusPixel  = ref<any>(null)

// ------------------------------------------------------------------ RaidWidget state (inline)
// Countdown per il widget Raid Island (aggiornato da setInterval)
const raidCountdown = ref('')
const raidError     = ref(false)
let raidCountdownTimer: ReturnType<typeof setInterval> | null = null

// ------------------------------------------------------------------ MissionMapBadge state (inline)
// Countdown per il badge missioni mappa
const missionCountdown = ref('')
let missionCountdownTimer: ReturnType<typeof setInterval> | null = null

// ------------------------------------------------------------------ MissionDetailModal state (inline)
// Countdown per la modale dettaglio missioni
const missionDetailCountdown = ref('')
let missionDetailCountdownTimer: ReturnType<typeof setInterval> | null = null

// ------------------------------------------------------------------ Badge "claim disponibile" sul bottone Classifica
// Mostra un indicatore se ci sono Kisses passivi da riscuotere. Stessa formula
// del server (pixelCount/4 * rate/ora, cap 24h). localPassiveClaimAt viene
// aggiornato quando l'utente riscuote dalla MiniLeaderboard (@claim-at), così il
// badge sparisce subito senza aspettare un refresh del profilo.
const passiveNow          = ref(Date.now())
const localPassiveClaimAt = ref<number | null>(null)
let   passiveTimer: ReturnType<typeof setInterval> | null = null
const passiveClaimable = computed<number>(() => {
  const pixels = (props.profilo?.pixelCount as number) ?? 0
  if (pixels <= 0) return 0
  const serverTs  = (props.profilo?.lastKissesClaimAt as any)?.toMillis?.() ?? (passiveNow.value - 3_600_000)
  const lastClaim = Math.max(serverTs, localPassiveClaimAt.value ?? 0)
  const capped    = Math.min((passiveNow.value - lastClaim) / 1000, 24 * 3600)
  return Math.floor(capped * (pixels / 4) / 3600)
})

// ------------------------------------------------------------------ Computed

// Set di chiavi x_y dei pixel della missione corrente (overlay fucsia)
const missionPixelSet = computed<Set<string>>(() => {
  if (!activeMission.value?.pixels) return new Set()
  const now = Date.now()
  const endsMs = activeMission.value.endsAt ? new Date(activeMission.value.endsAt).getTime() : 0
  if (endsMs < now) return new Set()
  return new Set(activeMission.value.pixels.map((p: any) => `${p.x}_${p.y}`))
})

// Percentuale HP raid (0–100)
const raidHpPct = computed<number>(() => {
  if (!raidInfo.value) return 0
  return Math.max(0, (raidInfo.value.currentHp / raidInfo.value.totalHp) * 100)
})

// Colore barra HP raid in base alla percentuale
const raidHpColor = computed<string>(() => {
  const pct = raidHpPct.value
  if (pct > 60) return '#06d6a0'
  if (pct > 30) return '#f59e0b'
  if (pct > 10) return '#f97316'
  return '#ef4444'
})

// ------------------------------------------------------------------ Helpers countdown

// Formatta millisecondi rimanenti come HH:MM:SS
function formatCountdown(endsAt: string): string {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Avvia il countdown del widget Raid Island
function startRaidCountdown() {
  if (raidCountdownTimer) clearInterval(raidCountdownTimer)
  if (!raidInfo.value?.endsAt) { raidCountdown.value = ''; return }
  const tick = () => { raidCountdown.value = formatCountdown(raidInfo.value.endsAt) }
  tick()
  raidCountdownTimer = setInterval(tick, 1000)
}

// Avvia il countdown del badge missioni mappa
function startMissionCountdown() {
  if (missionCountdownTimer) clearInterval(missionCountdownTimer)
  if (!activeMission.value?.endsAt) { missionCountdown.value = ''; return }
  const tick = () => { missionCountdown.value = formatCountdown(activeMission.value.endsAt) }
  tick()
  missionCountdownTimer = setInterval(tick, 1000)
}

// Avvia il countdown nella modale dettaglio missioni
function startMissionDetailCountdown() {
  if (missionDetailCountdownTimer) clearInterval(missionDetailCountdownTimer)
  if (!activeMission.value?.endsAt) { missionDetailCountdown.value = ''; return }
  const tick = () => { missionDetailCountdown.value = formatCountdown(activeMission.value.endsAt) }
  tick()
  missionDetailCountdownTimer = setInterval(tick, 1000)
}

// ------------------------------------------------------------------ Watch

// Quando raidBattleCtx arriva da GiocoPage, apri BattleModal in modalità raid
watch(() => props.raidBattleCtx, (val) => {
  if (val) { raidAttackMode.value = true; showBattle.value = true }
})

// Rinnova il countdown raid ogni volta che cambia raidInfo
watch(raidInfo, () => startRaidCountdown())

// Quando la schermata di battaglia si chiude, ricarica SEMPRE la mappa (dati freschi
// dopo conquista/sconfitta) — copre ogni percorso, anche quelli senza reload esplicito.
watch(showRound, (open, prevOpen) => {
  if (prevOpen && !open) invalidateAndReload()
})

// Rinnova il countdown missioni quando cambia la missione attiva
watch(activeMission, () => {
  startMissionCountdown()
  startMissionDetailCountdown()
})

// Avvia/stoppa il countdown modale quando si apre/chiude
watch(showMissionDetail, (val) => {
  if (val) startMissionDetailCountdown()
  else {
    if (missionDetailCountdownTimer) clearInterval(missionDetailCountdownTimer)
    missionDetailCountdown.value = ''
  }
})

// ------------------------------------------------------------------ API helpers

// Carica i chunk della mappa pixel (con cache sessionStorage da 2 minuti)
const loadChunks = async (forceRefresh = false) => {
  const cached   = sessionStorage.getItem('pixel_map_chunks')
  const cachedAt = Number(sessionStorage.getItem('pixel_map_chunks_at') || 0)
  const TTL      = 2 * 60 * 1000 // 2 minuti — la mappa cambia solo dopo battaglie/acquisti

  if (!forceRefresh && cached && Date.now() - cachedAt < TTL) {
    chunks.value = JSON.parse(cached)
    loading.value = false
    return
  }

  try {
    const token = await authStore.user?.getIdToken()
    const [chunksData, configData] = await Promise.all([
      ($fetch('/api/mappa/chunks', { headers: { Authorization: `Bearer ${token}` } })) as Promise<{ chunks: any }>,
      ($fetch('/api/swap/config',  { headers: { Authorization: `Bearer ${token}` } })) as Promise<any>,
    ])
    sessionStorage.setItem('pixel_map_chunks',    JSON.stringify(chunksData.chunks))
    sessionStorage.setItem('pixel_map_chunks_at', String(Date.now()))
    chunks.value     = chunksData.chunks
    swapConfig.value = configData
  } catch (e) {
    console.error('Errore caricamento mappa:', e)
  } finally {
    loading.value = false
  }
}

// Carica la configurazione difensiva dell'utente per la mappa corrente
const loadMyDefenseConfig = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/difesa', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { defenseMap: Record<string, any[]> }
    myDefenseMap.value = data.defenseMap ?? {}
  } catch { /* ignora */ }
}

// Carica il conteggio delle offerte in entrata in sospeso
const loadPendingOffers = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/mappa/offers', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { incoming: any[] }
    pendingOffersCount.value = (data.incoming || []).filter((o: any) => o.status === 'pending').length
  } catch { /* ignora */ }
}

// Carica la missione mappa attiva per l'utente
const loadActiveMission = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/map-missions/current', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { mission: any }
    activeMission.value = data.mission ?? null
  } catch { /* ignora */ }
}

// Carica le informazioni del Raid Island corrente
const loadRaidInfo = async () => {
  raidError.value = false
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/raid/current', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { raid: any; userWon?: boolean }
    raidInfo.value = data.raid ?? null
    raidWon.value  = !!data.userWon
  } catch {
    raidInfo.value = null
    raidWon.value = false
    raidError.value = true
  }
}

// Invalida la cache della mappa e forza il ricaricamento
const invalidateAndReload = async () => {
  sessionStorage.removeItem('pixel_map_chunks')
  sessionStorage.removeItem('pixel_map_chunks_at')
  await loadChunks(true)
}

// ── Territori sotto attacco (lock < 20 min) → X su mappa ─────────────────────
let attacksTimer: ReturnType<typeof setInterval> | null = null
const loadActiveAttacks = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/mappa/active-attacks', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { attacks: { x: number; y: number; mine: boolean }[] }
    const map: Record<string, boolean> = {}
    for (const a of data.attacks) map[`${a.x}_${a.y}`] = a.mine
    attackSet.value = map
  } catch { /* rete assente: mantieni lo stato precedente */ }
}

// ------------------------------------------------------------------ Adiacenza client-side

// Controlla se il pixel (tx, ty) è adiacente all'impero dell'utente via mare
// (6 direzioni esagonali). Geometria condivisa con server e PixelGrid.
const checkAdjacentToEmpire = (tx: number, ty: number): boolean => {
  const userPixelCount = (props.profilo?.pixelCount as number) ?? 0
  if (userPixelCount === 0) return true // primo pixel → sempre adiacente
  if (!chunks.value) return false
  const pixelAt = (col: number, row: number) => {
    const cid = `chunk_${Math.floor(col / 10)}_${Math.floor(row / 10)}`
    return chunks.value![cid]?.pixels?.[`${col}_${row}`]
  }
  return isHexAdjacentToEmpire(
    tx, ty, GRID_SIZE,
    // #16: "è terra" deve usare LAND_SET (come il server), NON l'esistenza del
    // record pixel: le celle di terra non seminate non hanno record e venivano
    // trattate come mare → il salto via mare le attraversava e trovava imperi
    // lontani, rendendo adiacenti territori che non lo sono.
    (key) => LAND_SET.has(key),
    (_key, col, row) => pixelAt(col, row)?.ownerId === authStore.user?.uid,
  )
}

// ------------------------------------------------------------------ Selezione pixel

// Gestisce la selezione di un pixel sulla mappa, arricchendolo con metadati
const handlePixelSelect = async (pixel: any) => {
  const isAdj      = checkAdjacentToEmpire(pixel.x, pixel.y)
  const price      = 200 + ((pixel.ownerLevel ?? 1) * 50)
  const chunkCol   = Math.floor(pixel.x / 10)
  const chunkRow   = Math.floor(pixel.y / 10)
  const chunkId    = `chunk_${chunkCol}_${chunkRow}`
  const chunkDiff  = chunks.value?.[chunkId]?.difficulty ?? 'easy'
  const pixelWithName = {
    ...pixel,
    name: PIXEL_NAMES[`${pixel.x}_${pixel.y}`] || null,
    isAdjacentToEmpire: isAdj,
    canAffordBuy: ((props.profilo?.kisses as number) ?? 0) >= price,
    buyPrice: price,
    difficulty: chunkDiff,
  }
  selectedPixel.value = pixelWithName
  if (pixel.ownerId !== 'CPU' && pixel.ownerId !== authStore.user?.uid) {
    try {
      const token = await authStore.user?.getIdToken()
      const data = await ($fetch(`/api/mappa/pixel/${pixel.x}/${pixel.y}`, {
        headers: { Authorization: `Bearer ${token}` },
      })) as { defenderTeam?: any[] }
      if (data.defenderTeam && selectedPixel.value) {
        selectedPixel.value = { ...selectedPixel.value, defenderTeam: data.defenderTeam }
      }
    } catch { /* ignora */ }
  }
}

// ------------------------------------------------------------------ Attacco pixel normale

// Avvia un attacco contro il pixel selezionato con il team scelto dall'utente
const handleAttack = async (attackerTeam: any[]) => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/mappa/attack', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { targetX: selectedPixel.value.x, targetY: selectedPixel.value.y, attackerTeam },
    })) as any
    if (data.battleId) {
      activeBattle.value = {
        id: data.battleId,
        attackerTeam,
        defenderTeam: data.defenderTeam || [],
        cpuDifficulty: data.cpuDifficulty || 'easy',
        attackerWins: 0,
        defenderWins: 0,
        pixelX: selectedPixel.value.x,
        pixelY: selectedPixel.value.y,
        defenderUid: selectedPixel.value.ownerId,
        defenderColor: selectedPixel.value.ownerColor,
        name: selectedPixel.value.name || null,
      }
      showBattle.value = false
      showRound.value  = true
      loadActiveAttacks() // il mio lock ora è attivo → aggiorna le X sulla mappa
    } else if (data.statusCode === 409 || /già sotto attacco/i.test(data.message ?? data.error ?? '')) {
      // Race: nel frattempo l'ha bloccato un altro → popup dedicato, niente toast rosso
      underAttackPopup.value = true
      showBattle.value = false
      loadActiveAttacks()
    } else {
      attackError.value = data.message || (typeof data.error === 'string' ? data.error : null) || t('map.attack_generic_error')
      showBattle.value  = false
    }
  } catch (e: any) {
    if (e?.statusCode === 409 || e?.data?.statusCode === 409 || /già sotto attacco/i.test(e?.data?.message ?? '')) {
      underAttackPopup.value = true
      showBattle.value = false
      loadActiveAttacks()
    } else {
      attackError.value = e?.data?.message || (typeof e?.data?.error === 'string' ? e.data.error : null) || t('map.attack_generic_error')
      showBattle.value  = false
    }
  }
}

// ------------------------------------------------------------------ Attacco Raid

// Avvia un attacco Raid con il team scelto dall'utente
const handleRaidAttack = async (attackerTeam: any[]) => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/raid/attack', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { attackerTeam },
    })) as any
    if (data.battleId) {
      activeBattle.value = {
        id: data.battleId,
        attackerTeam,
        defenderTeam: data.defenderTeam || [],
        cpuDifficulty: data.cpuDifficulty || 'medium',
        attackerWins: 0,
        defenderWins: 0,
        isRaid: true,
        raidBossHpMult: data.raidBossHpMult ?? 10,
        raidEventId: data.raidEventId,
        name: data.waifuNome ?? 'Waifu Raid',
      }
      showBattle.value = false
      showRound.value  = true
    } else {
      attackError.value = data.message || (typeof data.error === 'string' ? data.error : null) || t('map.raid_attack_error')
      showBattle.value  = false
    }
  } catch (e: any) {
    attackError.value = e?.data?.message || (typeof e?.data?.error === 'string' ? e.data.error : null) || t('map.raid_attack_error')
    showBattle.value  = false
  }
}

// ------------------------------------------------------------------ Risultato round

// Gestisce il completamento di un round: aggiorna i contatori e determina il vincitore finale
const handleRoundComplete = async (
  isVictory: boolean,
  choice: 'same' | 'switch' | null,
  prevPlayerIds: string[],
  prevEnemyIds: string[],
) => {
  if (!activeBattle.value?.id) return
  const roundWinner = isVictory ? 'attacker' : 'defender'
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch(`/api/mappa/battle/${activeBattle.value.id}/round`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { roundWinner },
    })) as any

    if (data.status === 'attacker_wins' || data.status === 'defender_wins') {
      showRound.value     = false
      selectedPixel.value = null
      loadActiveAttacks() // battaglia conclusa → lock rilasciato, aggiorna le X

      if (activeBattle.value.isRaid) {
        const savedRaidEventId = activeBattle.value.raidEventId
        const won              = data.status === 'attacker_wins'
        activeBattle.value     = null
        // #11: aggiorna PRIMA gli HP del raid (join) e POI apri il pannello, così
        // mostra subito gli HP corretti (prima partiva in background dopo l'apertura
        // -> il pannello caricava HP stantii finché non si cambiava schermata).
        try {
          const raidToken = await authStore.user?.getIdToken()
          await $fetch('/api/raid/join', {
            method: 'POST',
            headers: { Authorization: `Bearer ${raidToken}`, 'Content-Type': 'application/json' },
            body: { eventId: savedRaidEventId, won },
          })
        } catch (e) { console.error('[raid/join]', e) }
        // Ricarica lo stato raid: se l'utente ha vinto, il widget mappa passa a
        // "vinto → countdown" e il pannello nasconde il bottone Combatti.
        loadRaidInfo()
        emit('raidBattleEnd', { won })
        showRaidPanel.value = true
        return
      }

      const battSnap = activeBattle.value
      activeBattle.value = null

      if (data.status === 'attacker_wins') {
        missionsStore.trackAction('conquer')
        // Animazione conquista territorio
        const oldColor = battSnap?.defenderUid === 'CPU' ? '#888888' : (battSnap?.defenderColor || '#ff85b6')
        const newColor = (props.profilo?.coloreImpero as string) || '#ff85b6'
        conquestAnim.value = {
          pixelName: battSnap?.name || `(${battSnap?.pixelX}, ${battSnap?.pixelY})`,
          oldColor, newColor,
          empireName: (props.profilo?.nomeImpero as string) || 'Tu',
          oldEmpireName: battSnap?.defenderUid === 'CPU' ? 'CPU' : maskOffensiveName(battSnap?.defenderName || '?'),
        }
        emit('updateProfilo', {
          ...props.profilo,
          pixelCount: ((props.profilo?.pixelCount as number) ?? 0) + 1,
          // Premio vittoria: KISSES (1/3 del costo bustina), niente più pack
          kisses:     ((props.profilo?.kisses as number) ?? 0) + PREMIO_VITTORIA_KISSES,
        })
        showTutorial.value = false
      } else if (data.status === 'defender_wins') {
        emit('updateProfilo', {
          ...props.profilo,
          energia: Math.max(0, ((props.profilo?.energia as number) ?? 0) - 1),
        })
      }
      await invalidateAndReload()
    } else {
      // Round in corso: aggiorna win counts e dati per il round successivo
      activeBattle.value = {
        ...activeBattle.value,
        attackerWins:       data.attackerWins ?? (activeBattle.value.attackerWins + (roundWinner === 'attacker' ? 1 : 0)),
        defenderWins:       data.defenderWins ?? (activeBattle.value.defenderWins + (roundWinner === 'defender' ? 1 : 0)),
        nextRoundChoice:    choice,
        prevPlayerTeamIds:  prevPlayerIds ?? [],
        prevEnemyTeamIds:   prevEnemyIds ?? [],
      }
    }
  } catch (e) {
    console.error('Errore round API:', e)
    activeBattle.value = {
      ...activeBattle.value,
      attackerWins:      activeBattle.value.attackerWins + (roundWinner === 'attacker' ? 1 : 0),
      defenderWins:      activeBattle.value.defenderWins + (roundWinner === 'defender' ? 1 : 0),
      nextRoundChoice:   choice,
      prevPlayerTeamIds: prevPlayerIds ?? [],
      prevEnemyTeamIds:  prevEnemyIds ?? [],
    }
  }
}

// ------------------------------------------------------------------ Acquisto pixel

// Gestisce l'acquisto/offerta di un pixel (acquisto CPU diretto o offerta a giocatore)
const handlePurchase = async ({ amount }: { amount?: number }) => {
  try {
    const token  = await authStore.user?.getIdToken()
    const isCPU  = selectedPixel.value?.ownerId === 'CPU'
    const data = await ($fetch('/api/mappa/purchase', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: {
        targetX:     selectedPixel.value.x,
        targetY:     selectedPixel.value.y,
        offerAmount: isCPU ? undefined : amount,
      },
    })) as { success: boolean; type?: string; price?: number }
    if (data.success) {
      showPurchase.value  = false
      await invalidateAndReload()
      if (data.type === 'cpu_purchase') {
        emit('updateProfilo', {
          ...props.profilo,
          kisses:     ((props.profilo?.kisses as number) ?? 0) - (data.price ?? 0),
          pixelCount: ((props.profilo?.pixelCount as number) ?? 0) + 1,
        })
        showTutorial.value = false
      }
      selectedPixel.value = null
    }
  } catch (e: any) {
    console.error(e)
    showPurchase.value = false
    const status = e?.statusCode ?? e?.data?.statusCode
    if (status === 402) {
      // Kisses insufficienti → popup di ricarica (shop)
      const price = 200 + (((selectedPixel.value?.ownerLevel as number) ?? 1) * 50)
      kissesShortMissing.value = Math.max(1, price - ((props.profilo?.kisses as number) ?? 0))
    } else {
      attackError.value = e?.data?.message || e?.message || t('map.attack_generic_error')
    }
  }
}

// ------------------------------------------------------------------ Tutorial

// Apre il tutorial manualmente (bottone dedicato)
const openTutorial = () => { showTutorial.value = true }

// Chiude il tutorial e lo segna come già visto sul profilo (mai più in automatico)
const closeTutorial = async () => {
  showTutorial.value = false
  if (props.profilo?.tutorialMapSeen) return
  emit('updateProfilo', { ...props.profilo, tutorialMapSeen: true })
  try {
    if (authStore.user?.uid) await updateUserProfile(authStore.user.uid, { tutorialMapSeen: true })
  } catch { /* ignora errori di rete */ }
}

// ------------------------------------------------------------------ Mount / Unmount

onMounted(async () => {
  await Promise.all([
    loadChunks(),
    loadMyDefenseConfig(),
    loadPendingOffers(),
    loadActiveMission(),
    loadRaidInfo(),
    loadActiveAttacks(),
  ])
  // Aggiorna periodicamente lo stato "sotto attacco" (i lock scadono a 20 min)
  attacksTimer = setInterval(loadActiveAttacks, 30000)
  // Tick per il badge "claim disponibile" sul bottone Classifica (ogni 30s basta)
  passiveTimer = setInterval(() => { passiveNow.value = Date.now() }, 30000)
  // Mostra il tutorial SOLO la prima volta (poi mai più; riapribile dal bottone)
  if (!props.profilo?.tutorialMapSeen) showTutorial.value = true
})

onUnmounted(() => {
  if (raidCountdownTimer)         clearInterval(raidCountdownTimer)
  if (missionCountdownTimer)      clearInterval(missionCountdownTimer)
  if (missionDetailCountdownTimer) clearInterval(missionDetailCountdownTimer)
  if (attacksTimer)               clearInterval(attacksTimer)
  if (passiveTimer)               clearInterval(passiveTimer)
})

// ------------------------------------------------------------------ Mappa immagine: territori

const MAP_TERRITORIES = [
  // Northernas region (top-left ice/castle)
  { id: 't_alaska',        nome: 'Northernas',    x: 11, y: 14, size: 28 },
  { id: 't_canada_w',      nome: 'Frost Peak',    x: 8,  y: 26, size: 22 },
  { id: 't_canada_e',      nome: 'Glacier Vale',  x: 20, y: 22, size: 22 },
  { id: 't_groenlandia',   nome: 'Frozen Crown',  x: 30, y: 10, size: 20 },
  // Aurelia region (left, golden towers)
  { id: 't_usa_w',         nome: 'Aurelia Keep',  x: 14, y: 36, size: 24 },
  { id: 't_usa_e',         nome: 'Aurelia',       x: 20, y: 43, size: 28 },
  { id: 't_messico',       nome: 'Golden Shore',  x: 13, y: 53, size: 22 },
  // Center-left territories
  { id: 't_caraibi',       nome: 'Misty Isle',    x: 30, y: 35, size: 20 },
  { id: 't_venezuela',     nome: 'Verdant Pass',  x: 37, y: 27, size: 20 },
  { id: 't_peru',          nome: 'Thornbriar',    x: 35, y: 42, size: 22 },
  { id: 't_brasile',       nome: 'Deepwood',      x: 43, y: 36, size: 22 },
  { id: 't_argentina',     nome: 'Voidfen',       x: 27, y: 55, size: 20 },
  // Top-center territories
  { id: 't_islanda',       nome: 'Skyveil',       x: 46, y: 11, size: 20 },
  { id: 't_uk',            nome: 'Willowfen',     x: 44, y: 24, size: 22 },
  { id: 't_scandinavia',   nome: 'Mossgrove',     x: 53, y: 17, size: 22 },
  // Valerion region (center, large green)
  { id: 't_europa_o',      nome: 'Valerion West', x: 51, y: 32, size: 24 },
  { id: 't_europa_e',      nome: 'Valerion',      x: 61, y: 44, size: 28 },
  { id: 't_africa_n',      nome: 'Fernwood',      x: 55, y: 52, size: 24 },
  { id: 't_africa_o',      nome: 'Moonpool',      x: 46, y: 58, size: 22 },
  { id: 't_africa_e',      nome: 'Silverfen',     x: 64, y: 57, size: 22 },
  // Interna region (right, volcanic)
  { id: 't_russia',        nome: 'Shadowpeak',    x: 77, y: 12, size: 22 },
  { id: 't_medio_oriente', nome: 'Cinderfall',    x: 71, y: 32, size: 24 },
  { id: 't_cina',          nome: 'Interna North', x: 82, y: 28, size: 24 },
  { id: 't_india',         nome: 'Interna',       x: 79, y: 42, size: 28 },
  { id: 't_giappone',      nome: 'Emberveil',     x: 91, y: 24, size: 20 },
  { id: 't_kamchatka',     nome: 'Darkforge',     x: 89, y: 14, size: 20 },
  { id: 't_indonesia',     nome: 'Ashfen',        x: 86, y: 54, size: 22 },
  { id: 't_australia',     nome: 'Ironmoor',      x: 91, y: 64, size: 22 },
]

// Calcola i 6 punti di un esagono in coordinate viewBox (flat-top)
function hexPoints(cx: number, cy: number, r: number): string {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return pts.join(' ')
}

// Recupera i dati del pixel dal chunk in base alle coordinate x,y (0-49)
function getPixelData(px: number, py: number): any {
  if (!chunks.value) return null
  const chunkCol = Math.floor(px / 10)
  const chunkRow = Math.floor(py / 10)
  const chunkId  = `chunk_${chunkCol}_${chunkRow}`
  const key      = `${px}_${py}`
  return chunks.value[chunkId]?.pixels?.[key] ?? null
}

// Ottieni l'owner dominante del territorio (dal chunks data)
function getTerritoryOwner(territoryId: string): any {
  if (!chunks.value) return null
  const terr = MAP_TERRITORIES.find(t => t.id === territoryId)
  if (!terr) return null
  // Mappa posizione percentuale (0-100) → pixel griglia (0-49)
  const px = Math.min(49, Math.max(0, Math.floor(terr.x / 2)))
  const py = Math.min(49, Math.max(0, Math.floor(terr.y / 2)))
  const pixelData = getPixelData(px, py)
  return pixelData?.ownerId ? pixelData : null
}

// Ottieni il colore del proprietario del territorio
function getTerritoryColor(territoryId: string): string {
  const owner = getTerritoryOwner(territoryId)
  if (!owner) return 'rgba(245,197,96,0.4)'
  if (owner.ownerId === 'CPU') return '#888888'
  return owner.ownerColor || '#f5c560'
}

// Chiave pixel selezionato per evidenziarlo nel PixelGrid
const selectedPixelKey = computed(() =>
  selectedPixel.value != null ? `${selectedPixel.value.x}_${selectedPixel.value.y}` : null
)

// Handler per il click sul PixelGrid canvas
function onPixelGridSelect(pixelKey: string, data: Record<string, any>) {
  const parts = pixelKey.split('_')
  const x = Number(parts[0])
  const y = Number(parts[1])
  // Territorio sotto attacco da ALTRI (X rossa): non apre il dettaglio, mostra
  // il popup "già sotto attacco". Se l'attacco è MIO (X verde) si procede
  // normalmente, così posso completarlo.
  if (attackSet.value[pixelKey] === false && (data.ownerId ?? 'CPU') !== authStore.user?.uid) {
    underAttackPopup.value = true
    return
  }
  handlePixelSelect({
    x,
    y,
    ownerId:    data.ownerId    ?? 'CPU',
    ownerColor: data.ownerColor ?? '#888888',
    ownerLevel: data.ownerLevel ?? 1,
    ...data,
  })
}

// Gestisce il click su un territorio: costruisce un pixel object e chiama handlePixelSelect
async function onTerritoryClick(territoryId: string) {
  const terr = MAP_TERRITORIES.find(t => t.id === territoryId)
  if (!terr) return
  const px = Math.min(49, Math.max(0, Math.floor(terr.x / 2)))
  const py = Math.min(49, Math.max(0, Math.floor(terr.y / 2)))
  const pixelData = getPixelData(px, py) ?? {}
  await handlePixelSelect({
    x:          px,
    y:          py,
    ownerId:    pixelData.ownerId    ?? 'CPU',
    ownerColor: pixelData.ownerColor ?? '#888888',
    ownerLevel: pixelData.ownerLevel ?? 1,
    ...pixelData,
  })
}
</script>

<template>
  <!-- Contenitore principale: margini negativi per estendersi fino ai bordi del tab -->
  <div :style="{ position: 'relative', margin: '-12px -16px' }">

    <!-- ── Loading state ─────────────────────────────────────────────── -->
    <AppLoading v-if="loading" />

    <!-- ── Contenuto principale (dopo il caricamento) ────────────────── -->
    <template v-else>

      <!-- Header: titolo + bottone offerte sulla stessa riga -->
      <div :style="{ padding: '16px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }">
        <div :style="{ fontFamily: FF.display, fontSize: '20px', color: 'var(--theme-text)', fontWeight: 900, lineHeight: 1.1 }">
          Mappa del Mondo
        </div>
        <!-- Bottoni azione header: classifica (🏆) + offerte (💌), stesso stile -->
        <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }">
          <!-- Bottone classifica: rotondo, stesso stile del bottone offerte -->
          <button
            @click="showLeaderboard = true"
            :style="{
              position: 'relative', flexShrink: 0,
              width: '38px', height: '38px',
              background: 'var(--theme-accent-pink)', border: 'none',
              borderRadius: '50%', fontSize: '20px', lineHeight: 1,
              cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0,
              boxShadow: '0 4px 12px var(--theme-shadow)',
            }"
          >
            <Trophy :size="18" stroke-width="2" style="color:#fff;" />
            <!-- Badge: Kisses passivi da riscuotere -->
            <span v-if="passiveClaimable > 0" :style="{ position: 'absolute', top: '-5px', right: '-5px', background: '#f5c560', color: '#3a2a05', minWidth: '17px', height: '17px', padding: '0 4px', borderRadius: '9px', display: 'grid', placeItems: 'center', fontFamily: FF.mono, fontSize: '9px', fontWeight: 800, border: '1.5px solid var(--theme-surface)' }">{{ passiveClaimable > 999 ? '999+' : passiveClaimable }}</span>
          </button>
          <!-- Bottone offerte: rotondo, solo emoji 💌 -->
          <button
            @click="showOffers = true"
            :style="{
              position: 'relative', flexShrink: 0,
              width: '38px', height: '38px',
              background: 'var(--theme-accent-pink)', border: 'none',
              borderRadius: '50%', fontSize: '22px', lineHeight: 1,
              cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0,
              boxShadow: '0 4px 12px var(--theme-shadow)',
            }"
          >
            <Mail :size="18" stroke-width="2" style="color:#fff;" />
            <span v-if="pendingOffersCount > 0" :style="{ position: 'absolute', top: '-5px', right: '-5px', background: '#ff5b6c', color: '#fff', width: '17px', height: '17px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: FF.mono, fontSize: '9px', fontWeight: 800, border: '1.5px solid var(--theme-surface)' }">{{ pendingOffersCount }}</span>
          </button>
        </div>
      </div>

      <!-- ── Raid Widget (inline) — sopra la mappa ─────────────────────── -->
      <div
        @click="(raidError || raidWon) ? undefined : (showRaidPanel = true)"
        :style="{
          margin: '0 16px 10px', padding: '8px 10px',
          background: raidError ? 'rgba(239,68,68,0.06)' : 'var(--theme-surface)',
          border: raidError ? '1.5px solid rgba(239,68,68,0.3)' : '1.5px solid rgba(236,72,153,0.45)',
          borderRadius: '16px',
          cursor: (raidError || raidWon) ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 4px 16px var(--theme-shadow)',
          opacity: raidError ? 0.85 : 1,
        }"
      >
        <!-- Icona errore o thumbnail waifu -->
        <div v-if="raidError" :style="{ fontSize: '32px', flexShrink: 0, lineHeight: 1 }">⚠️</div>
        <!-- Raid già vinto: mostra un trofeo al posto della waifu -->
        <div v-else-if="raidWon" :style="{ fontSize: '34px', flexShrink: 0, lineHeight: 1 }">🏆</div>
        <img
          v-else-if="raidInfo?.waifuImage"
          :src="ikUrl(raidInfo.waifuImage, 'thumbnail') ?? undefined"
          :alt="raidInfo.waifuNome"
          :style="{ width: '58px', height: '80px', objectFit: 'cover', objectPosition: 'top', borderRadius: '10px', border: '2px solid rgba(236,72,153,0.5)', flexShrink: 0, boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }"
        />
        <div v-else :style="{ fontSize: '36px', flexShrink: 0, lineHeight: 1 }">⚔</div>

        <div :style="{ flex: 1, minWidth: 0 }">
          <!-- Stato di errore -->
          <template v-if="raidError">
            <div :style="{ fontFamily: FF.label, fontSize: '11px', color: '#ef4444', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '4px' }">
              ⚔ Raid Island
            </div>
            <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', lineHeight: 1.4 }">
              {{ $t('map.raid_unavailable') }}
            </div>
          </template>

          <!-- Stato "raid già vinto": solo countdown al prossimo raid -->
          <template v-else-if="raidWon">
            <div :style="{ fontFamily: FF.label, fontSize: '11px', color: '#f5c560', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '4px' }">
              🏆 {{ $t('map.raid_won') }}
            </div>
            <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', lineHeight: 1.4 }">
              {{ $t('map.raid_next_in') }}
              <span :style="{ fontFamily: FF.mono, fontWeight: 700, color: '#f5c560', fontVariantNumeric: 'tabular-nums' }">{{ raidCountdown || '—' }}</span>
            </div>
          </template>

          <!-- Stato normale -->
          <template v-else>
            <div :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-accent-pink)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '3px' }">
              ⚔ Raid Waifu
            </div>
            <div :style="{ fontFamily: FF.display, fontSize: '16px', color: 'var(--theme-text)', fontWeight: 700, marginBottom: '6px' }">
              {{ raidInfo?.waifuNome ?? 'Raid Island' }}
            </div>
            <template v-if="raidInfo">
              <div :style="{ height: '6px', background: 'var(--theme-border)', borderRadius: '3px', marginBottom: '5px', overflow: 'hidden' }">
                <div :style="{ height: '100%', width: `${raidHpPct}%`, background: raidHpColor, borderRadius: '3px', transition: 'width 0.5s' }" />
              </div>
              <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
                <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'var(--theme-text-2)', fontWeight: 600 }">
                  {{ Math.max(0, raidInfo.currentHp).toLocaleString() }} / {{ raidInfo.totalHp.toLocaleString() }} HP
                </div>
                <div v-if="raidCountdown" :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'var(--theme-accent-pink)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }">
                  ⏱ {{ raidCountdown }}
                </div>
              </div>
            </template>
            <template v-else>
              <div :style="{ fontFamily: FF.label, fontSize: '12px', color: 'var(--theme-text-2)', letterSpacing: '0.1em' }">
                {{ $t('map.raid_tap_hint') }}
              </div>
            </template>
          </template>
        </div>
        <div v-if="!raidError && !raidWon" :style="{ fontFamily: FF.display, fontSize: '18px', color: 'var(--theme-text-2)', flexShrink: 0 }">→</div>
      </div>

      <!-- Mappa: sfondo mare sempre visibile + canvas interattivo sovrapposto -->
      <div style="margin: 20px 16px 16px; border-radius: 16px; position: relative; min-height: 520px;" :style="{ border: '1px solid var(--theme-border)' }">
        <!-- #24: UN SOLO accesso al tutorial — il chip "?" riapre il tutorial
             (prima c'erano due bottoni: "?" per l'info-modal e il libro per il
             tutorial). Ora è uno solo. -->
        <button
          @click="openTutorial"
          :title="$t('tutorial.reopen')"
          :style="{
            position: 'absolute', top: '-15px', right: '-15px', zIndex: 40,
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            color: '#fff', fontFamily: FF.display, fontSize: '18px', fontWeight: 800,
            cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, lineHeight: 1,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }"
        >?</button>
        <!-- Sfondo mare sempre visibile come base (sotto al canvas) -->
        <div
          style="width:100%;height:520px;display:block;user-select:none;border-radius:16px;
                 background:radial-gradient(130% 110% at 50% 35%, #1b4a78 0%, #123a60 50%, #0c2542 100%);"
        />
        <!-- Canvas pixel interattivo sopra il mare (pointer-events attivi) -->
        <div style="position:absolute;inset:0;z-index:2;border-radius:16px;overflow:hidden;">
          <PixelGrid
            v-if="chunks"
            :chunks="chunks"
            :user-uid="authStore.user?.uid ?? ''"
            :selected-pixel="selectedPixelKey"
            :mission-pixel-set="missionPixelSet"
            :focus-pixel="missionFocusPixel ?? '54_50'"
            :attack-set="attackSet"
            @pixel-select="onPixelGridSelect"
          />
        </div>
        <!-- Loading overlay se chunks non ancora caricato -->
        <div v-if="!chunks" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--theme-overlay);">
          <AppLoading />
        </div>
      </div>

      <!-- Sezione Missioni Mappa rimossa — le missioni sono accessibili dal FAB Target -->

      <!-- Classifica territori + kisses passivi — modale aperta dal bottone 🏆 nell'header -->
      <MiniLeaderboard
        :open="showLeaderboard"
        :chunks="chunks"
        :user-uid="authStore.user?.uid ?? ''"
        :profilo="profilo as any"
        @kisses-update="(k) => emit('updateProfilo', { kisses: (profilo?.kisses as number ?? 0) + k })"
        @claim-at="(ts) => { localPassiveClaimAt = ts }"
        @close="showLeaderboard = false"
      />

      <!-- Pixel detail popup -->
      <PixelDetail
        v-if="selectedPixel && !showBattle && !showRound && !showPurchase && !showDefenseEditor"
        :pixel="selectedPixel"
        :waifu-cat="waifuCat"
        @chiudi="selectedPixel = null"
        @attacca="raidAttackMode = false; showBattle = true"
        @acquista="showPurchase = true"
        @kisses-short="(p: number) => { kissesShortMissing = Math.max(1, p - ((profilo?.kisses as number) ?? 0)) }"
        @edit-difesa="showDefenseEditor = true"
        @offerte="showOffers = true"
      />

      <!-- Popup Kisses insufficienti per comprare il territorio → redirect allo shop -->
      <KissesShortageDialog
        v-if="kissesShortMissing != null"
        :missing-kisses="kissesShortMissing"
        @cancel="kissesShortMissing = null"
      />

      <!-- ── Errore attacco ──────────────────────────────────────────────── -->
      <!-- Toast errore mostrato quando un attacco non riesce -->
      <div
        v-if="attackError"
        :style="{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, maxWidth: '320px', width: '90vw',
          background: 'rgba(255,91,108,0.97)', color: '#fff',
          borderRadius: '16px', padding: '18px 20px',
          fontFamily: FF.label, lineHeight: 1.5, textAlign: 'center',
          boxShadow: '0 8px 32px rgba(255,91,108,0.4)',
          animation: 'slideDown 0.3s ease-out',
        }"
      >
        <div :style="{ marginBottom: '10px', fontWeight: 800, fontSize: '16px', letterSpacing: '0.08em' }">{{ $t('map.attack_failed') }}</div>
        <div :style="{ fontSize: '15px', fontWeight: 600, lineHeight: 1.5, opacity: 0.95 }">{{ attackError }}</div>
        <button
          @click="attackError = null"
          :style="{
            marginTop: '14px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '999px', color: '#fff', fontFamily: FF.label, fontSize: '13px',
            letterSpacing: '0.15em', textTransform: 'uppercase', padding: '7px 20px', cursor: 'pointer',
          }"
        >{{ $t('map.ok') }}</button>
      </div>

      <!-- ── Popup "territorio già sotto attacco" (tap sulla X rossa) ────── -->
      <div v-if="underAttackPopup" @click.self="underAttackPopup = false" :style="{
        position:'fixed', inset:0, zIndex:100000,
        background:'var(--theme-overlay, rgba(4,2,14,0.72))', backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
      }">
        <div :style="{
          width:'100%', maxWidth:'320px', background:'var(--theme-surface)',
          border:'1px solid var(--theme-border)', borderRadius:'20px',
          boxShadow:'0 16px 48px var(--theme-shadow, rgba(0,0,0,0.5))',
          padding:'26px 22px 22px', textAlign:'center',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'12px',
        }">
          <div :style="{ fontSize:'40px', lineHeight:1 }">⚔️</div>
          <div :style="{ fontFamily:FF.display, fontSize:'18px', fontWeight:800, color:'#ff5b6c' }">{{ $t('map.under_attack_title') }}</div>
          <div :style="{ fontFamily:FF.body, fontSize:'13px', color:'var(--theme-text-2)', lineHeight:1.5 }">{{ $t('map.under_attack_desc') }}</div>
          <button @click="underAttackPopup = false" :style="{
            marginTop:'6px', width:'100%', padding:'13px 0', border:'none', cursor:'pointer',
            background:'var(--grad-primary, linear-gradient(135deg,#ec4899,#a855f7))', color:'#fff',
            fontFamily:FF.label, fontSize:'12px', fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase',
            boxShadow:'0 6px 18px rgba(168,85,247,0.4)',
          }">{{ $t('map.ok') }}</button>
        </div>
      </div>

      <!-- ── Animazione conquista territorio ───────────────────────────── -->
      <TerritoryConquestAnimation
        v-if="conquestAnim"
        :pixel-name="conquestAnim.pixelName"
        :old-color="conquestAnim.oldColor"
        :new-color="conquestAnim.newColor"
        :empire-name="conquestAnim.empireName"
        :old-empire-name="conquestAnim.oldEmpireName"
        @done="conquestAnim = null; victoryReward = { kisses: PREMIO_VITTORIA_KISSES }"
      />

      <!-- ── Popup PREMI VITTORIA (dopo la conquista) ─────────────────── -->
      <div v-if="victoryReward"
        style="position:fixed;inset:0;z-index:640;background:rgba(4,2,14,0.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;"
        @click.self="victoryReward = null">
        <div :style="{
          width:'100%', maxWidth:'300px', textAlign:'center',
          background:'var(--grad-primary-soft), var(--theme-surface)', border:'1px solid var(--theme-border)',
          borderRadius:'20px', padding:'26px 22px',
          boxShadow:'0 12px 40px var(--theme-shadow)',
        }">
          <div :style="{ fontFamily:'var(--ff-display)', fontSize:'17px', fontWeight:800, color:'#f5c560', letterSpacing:'.04em', marginBottom:'12px' }">
            {{ $t('map.victory_rewards_title') }}
          </div>
          <div :style="{
            display:'inline-flex', alignItems:'center', gap:'8px',
            background:'var(--theme-surface-2)', border:'1px solid var(--theme-border-2)',
            borderRadius:'999px', padding:'10px 18px', marginBottom:'18px',
          }">
            <KissesIcon :size="18" />
            <span :style="{ fontFamily:'var(--ff-display)', fontSize:'20px', fontWeight:800, color:'var(--theme-accent-pink)' }">+{{ victoryReward.kisses }}</span>
          </div>
          <div>
            <button @click="victoryReward = null" :style="{
              width:'100%', padding:'12px 0', border:'none', borderRadius:'12px', cursor:'pointer',
              background:'var(--theme-accent)', color:'#fff',
              fontFamily:'var(--ff-display)', fontSize:'13px', fontWeight:700, letterSpacing:'.05em',
            }">OK</button>
          </div>
        </div>
      </div>

      <!-- ── Info Modal ─────────────────────────────────────────────────── -->
      <InfoModal v-if="showInfoModal" @close="showInfoModal = false" />

      <!-- ── Tutorial (nuovo utente senza pixel) ───────────────────────── -->
      <TutorialOverlay v-if="showTutorial" @close="closeTutorial" />

      <!-- ── BattleModal: selezione team offensivo pixel normale ────────── -->
      <BattleModal
        v-if="showBattle && !raidAttackMode"
        :pixel="selectedPixel"
        :collezione="collezione as any"
        :waifu-cat="waifuCat"
        :mosse-cat="mosseCat"
        @conferma="(team) => handleAttack(team)"
        @chiudi="showBattle = false"
        @update-collezione="(c) => emit('updateCollezione', c)"
        @notif="(t, col) => emit('notif', t, col)"
      />

      <!-- ── BattleModal: selezione team offensivo Raid Island ──────────── -->
      <BattleModal
        v-if="showBattle && raidAttackMode"
        :pixel="null"
        :collezione="collezione as any"
        :waifu-cat="waifuCat"
        :mosse-cat="mosseCat"
        @conferma="(team) => { raidAttackMode = false; handleRaidAttack(team) }"
        @chiudi="showBattle = false; raidAttackMode = false"
        @update-collezione="(c) => emit('updateCollezione', c)"
        @notif="(t, col) => emit('notif', t, col)"
      />

      <!-- ── RoundViewer: pick phase + arena battaglia ──────────────────── -->
      <!-- key cambia ad ogni round completato → rimonta il viewer con phase 'pre' -->
      <RoundViewer
        v-if="showRound && activeBattle"
        :key="activeBattle.id + '-' + (activeBattle.attackerWins + activeBattle.defenderWins)"
        :battle="activeBattle"
        :waifu-cat="waifuCat"
        :mosse-cat="mosseCat"
        :collezione="collezione as any"
        :profilo="profilo as any"
        :has-hard-pass="!!(profilo?.hardPass)"
        @conquista="(r) => handleRoundComplete(r.isVictory, r.choice, r.prevPlayerTeamIds, r.prevEnemyTeamIds)"
        @chiudi="showRound = false; activeBattle = null"
      />

      <!-- ── Raid Island full panel ─────────────────────────────────────── -->
      <RaidIslandPanel
        v-if="showRaidPanel"
        :profilo="profilo as any"
        @chiudi="showRaidPanel = false"
        @battle="(data) => { raidInfo = data; raidAttackMode = true; showBattle = true; showRaidPanel = false }"
      />

      <!-- ── Acquisto pixel ─────────────────────────────────────────────── -->
      <PurchaseModal
        v-if="showPurchase && selectedPixel"
        :pixel="selectedPixel"
        :profilo="profilo as any"
        @confirm="handlePurchase"
        @close="showPurchase = false"
      />

      <!-- ── Lista offerte ──────────────────────────────────────────────── -->
      <OffersPanel
        v-if="showOffers"
        @close="showOffers = false"
        @kisses-update="(k) => emit('updateProfilo', { kisses: k })"
        @map-update="() => {}"
      />

      <!-- ── Editor team difensore ──────────────────────────────────────── -->
      <TeamDifesaEditor
        v-if="showDefenseEditor && selectedPixel"
        :pixel-key="`${selectedPixel.x}_${selectedPixel.y}`"
        :collezione="collezione as any"
        :waifu-cat="waifuCat"
        :profilo="profilo as any"
        :current-team="myDefenseMap[`${selectedPixel.x}_${selectedPixel.y}`] || []"
        @close="showDefenseEditor = false"
        @saved="showDefenseEditor = false"
      />

    </template>

    <!-- ── MissionDetailModal (inline) ──────────────────────────────── -->
    <!-- Modale dettaglio missioni mappa con elenco pixel obiettivo cliccabili -->
    <template v-if="showMissionDetail && activeMission">
      <!-- Backdrop -->
      <div
        @click="showMissionDetail = false"
        :style="{ position: 'fixed', inset: 0, zIndex: 130, background: 'var(--theme-overlay)', backdropFilter: 'blur(4px)' }"
      />
      <!-- Modale -->
      <div :style="{
        position: 'fixed', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)', zIndex: 140,
        width: 'min(92vw, 360px)',
        background: 'var(--grad-primary-soft), var(--theme-surface)', backdropFilter: 'blur(20px)',
        border: '1px solid var(--theme-border-2)', borderRadius: '18px',
        padding: '22px 20px', boxShadow: '0 20px 60px var(--theme-shadow)',
      }">
        <!-- Pulsante chiudi -->
        <button
          @click="showMissionDetail = false"
          :style="{ position: 'absolute', top: '14px', right: '16px', background: 'none', border: 'none', color: 'var(--theme-text-3)', fontSize: '20px', cursor: 'pointer', padding: 0 }"
        >✕</button>

        <div :style="{ fontFamily: FF.display, fontSize: '13px', color: '#e879f9', fontWeight: 800, marginBottom: '4px' }">
          🎯 Missioni Mappa
        </div>
        <div
          v-if="missionDetailCountdown"
          :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(232,121,249,0.6)', marginBottom: '16px', fontVariantNumeric: 'tabular-nums' }"
        >
          Scade tra <strong :style="{ color: '#e879f9' }">{{ missionDetailCountdown }}</strong>
        </div>

        <div :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(241,235,255,0.5)', marginBottom: '12px', lineHeight: 1.5 }">
          Possiedi questi territori alla scadenza per guadagnare
          <strong :style="{ color: C.gold }">+{{ activeMission.rewardPerPixel ?? 100 }} <KissesIcon :size="12" /></strong>
          a territorio.
        </div>

        <!-- Elenco pixel obiettivo della missione -->
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '8px' }">
          <div
            v-for="(px, i) in (activeMission.pixels || [])"
            :key="i"
            @click="missionFocusPixel = { x: px.x, y: px.y }; showMissionDetail = false"
            :style="{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px',
              background: 'rgba(232,121,249,0.07)',
              border: '1px solid rgba(232,121,249,0.2)',
              borderRadius: '10px', cursor: 'pointer',
              transition: 'background 0.15s',
            }"
          >
            <span :style="{ fontSize: '16px' }">♛</span>
            <div :style="{ flex: 1 }">
              <div :style="{ fontFamily: FF.label, fontSize: '13px', color: '#fff', fontWeight: 700 }">
                {{ PIXEL_NAMES[`${px.x}_${px.y}`] || px.name || `(${px.x}, ${px.y})` }}
              </div>
              <div :style="{ fontFamily: FF.label, fontSize: '10px', color: 'rgba(241,235,255,0.4)' }">
                +{{ activeMission.rewardPerPixel ?? 100 }} <KissesIcon :size="11" /> se in tuo possesso
              </div>
            </div>
            <span :style="{ fontFamily: FF.label, fontSize: '10px', color: 'rgba(232,121,249,0.5)' }">→</span>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>
