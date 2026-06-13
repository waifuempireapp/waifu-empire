<!-- RoundViewer — Gestisce le fasi di un round battaglia: pre-round, pick 3-from-5, arena. -->
<!-- Porta RoundViewer.jsx: fasi 'pre' | 'pick' | 'battle' con logica Bo3. -->
<script setup lang="ts">
import {
  initBattleWaifu,
  initBattleTeam,
  generateCPUMovesFromCatalog,
} from '~/utils/battleEngine'
import { useAuthStore } from '~/stores/auth'

// ── Costanti locali (da _shared.jsx) ─────────────────────────────────────────
const C = {
  violet: '#a78bfa',
  sakura: '#ff85b6',
  gold:   '#ffc861',
  aqua:   '#5ee7df',
  err:    '#ff5b6c',
}
const FF = {
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

// ── Schema rarità per deck CPU basato sulla difficoltà ───────────────────────
const CPU_DECK_PLAN: Record<string, { combat: string[]; filler: string[] }> = {
  easy:    { combat: ['comune','comune','raro'],                filler: ['raro','comune']       },
  medium:  { combat: ['raro','raro','raro'],                    filler: ['raro','comune']       },
  hard:    { combat: ['epico','epico','leggendario'],           filler: ['raro','epico']        },
  extreme: { combat: ['leggendario','leggendario','immersivo'], filler: ['epico','leggendario'] },
  expert:  { combat: ['leggendario','leggendario','immersivo'], filler: ['epico','leggendario'] },
}

// ── Moltiplicatori stat CPU per difficoltà ───────────────────────────────────
const DIFFICULTY_STAT_MULT: Record<string, { hp: number; speed: number; crit: number }> = {
  easy:    { hp: 1.0,  speed: 1.0,  crit: 1.0  },
  medium:  { hp: 1.25, speed: 1.15, crit: 1.05 },
  hard:    { hp: 1.65, speed: 1.40, crit: 1.10 },
  extreme: { hp: 2.0,  speed: 1.65, crit: 1.15 },
  expert:  { hp: 2.0,  speed: 1.65, crit: 1.15 },
}

function applyDifficultyScaling(team: any[], mult: { hp: number; speed: number; crit: number }) {
  if (!mult || (mult.hp === 1.0 && mult.speed === 1.0 && mult.crit === 1.0)) return team
  return team.map(w => ({
    ...w,
    maxHp:      Math.round(w.maxHp * mult.hp),
    hp:         Math.round(w.hp    * mult.hp),
    speed:      Math.min(1000, Math.round(w.speed * mult.speed)),
    critChance: Math.min(0.9, parseFloat((w.critChance * mult.crit).toFixed(3))),
  }))
}

function buildCPUDifficultyDeck(candidates: any[], difficulty: string): any[] {
  const plan = CPU_DECK_PLAN[difficulty] ?? CPU_DECK_PLAN.easy
  const used = new Set<string>()
  const shuffle = (a: any[]) => [...a].sort(() => Math.random() - 0.5)

  const pickOne = (rarity: string) => {
    const avail = candidates.filter(w => w.rarita === rarity && !used.has(w.id))
    const pool  = avail.length > 0 ? avail : candidates.filter(w => !used.has(w.id))
    const w = shuffle(pool)[0] ?? null
    if (w) used.add(w.id)
    return w
  }

  const deck: any[] = []
  for (const r of plan.combat) { const w = pickOne(r); if (w) deck.push(w) }
  for (const r of plan.filler) { const w = pickOne(r); if (w) deck.push(w) }
  while (deck.length < 5) {
    const extra = shuffle(candidates.filter(w => !used.has(w.id)))
    if (!extra.length) break
    used.add(extra[0].id)
    deck.push(extra[0])
  }
  return deck.slice(0, 5)
}

// ── Props ed emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  battle?:      Record<string, any> | null
  waifuCat?:    any[]
  mosseCat?:    any[]
  collezione?:  Record<string, any> | null
  profilo?:     Record<string, any> | null
  hasHardPass?: boolean
  // onRoundComplete → emit 'conquista' con (isVictory, choice, prevPlayerIds, prevEnemyIds)
}>()

const emit = defineEmits<{
  /** Round completato: passa risultato, scelta continuazione e team ids precedenti */
  conquista: [risultato: any]
  /** Chiude il viewer */
  chiudi: []
}>()

// ── Auth + tema ───────────────────────────────────────────────────────────────
const authStore  = useAuthStore()
const { isDark } = useTheme()

// ── Fase iniziale basata su nextRoundChoice ───────────────────────────────────
type Phase = 'pre' | 'pick' | 'battle'
const initialPhase: Phase =
  props.battle?.nextRoundChoice === 'same'   ? 'battle' :
  props.battle?.nextRoundChoice === 'switch' ? 'pick'   : 'pre'

const phase = ref<Phase>(initialPhase)

// ── Team giocatore (inizializzato se nextRoundChoice === 'same') ──────────────
const playerTeam = ref<any[] | null>((() => {
  if (props.battle?.nextRoundChoice === 'same' && props.battle?.prevPlayerTeamIds?.length === 3) {
    const waifu = props.battle.prevPlayerTeamIds
      .map((id: string) => {
        const cat  = props.waifuCat?.find(w => w.id === id)
        const coll = props.collezione?.waifu?.[id] ?? {}
        const mosseData: Record<string, any> = {}
        for (const mid of Object.values(coll.mosse_slot ?? {}).filter(Boolean) as string[]) {
          const userMossa = props.collezione?.mosse?.[mid]
          const catMossa  = props.mosseCat?.find(m => m.id === mid)
          if (catMossa) mosseData[mid] = { ...catMossa, ...(userMossa || {}) }
        }
        return cat ? { ...cat, ...coll, _mosseData: mosseData } : null
      })
      .filter(Boolean)
    if (waifu.length !== 3) return null
    return waifu.map((w: any) => initBattleWaifu(w, {
      livello: w.livello ?? 1, velocita: w.velocita ?? null,
      crit_chance: w.crit_chance ?? null, hp: w.hp ?? null,
      mosse_slot: w.mosse_slot ?? null, _mosseData: w._mosseData ?? null,
    }))
  }
  return null
})())

// ── Team nemico (inizializzato se nextRoundChoice === 'same') ─────────────────
const enemyTeam = ref<any[] | null>((() => {
  if (props.battle?.nextRoundChoice === 'same' && props.battle?.prevEnemyTeamIds?.length === 3) {
    const patchW = (w: any) => w ? ({ ...w, asset_statica: w.asset_statica || w.asset_immagine || null }) : null
    const waifu = props.battle.prevEnemyTeamIds
      .map((id: string) => props.waifuCat?.find(w => w.id === id))
      .map(patchW)
      .filter(Boolean)
    if (waifu.length !== 3) return null
    const team = initBattleTeam(waifu, {})
    const mult = DIFFICULTY_STAT_MULT[props.battle?.cpuDifficulty ?? 'easy']
    return props.battle?.defenderUid === 'CPU' ? applyDifficultyScaling(team, mult) : team
  }
  return null
})())

// Risultato battaglia corrente (sincrono, salvato prima di onExit)
const battleResult = ref<boolean | null>(null)

// ── Offset header (evita overlap con header fisso) ────────────────────────────
const topOffset = ref(0)
onMounted(() => {
  const hdr  = document.querySelector('.hdr-root')
  const ntabs = document.querySelector('.ntabs-root')
  topOffset.value =
    (hdr   ? hdr.getBoundingClientRect().height   : 0) +
    (ntabs ? ntabs.getBoundingClientRect().height : 0)
})

// ── roster5P: le 5 waifu del giocatore (BattleModal) con _mosseData ──────────
const roster5P = computed(() =>
  (props.battle?.attackerTeam || [])
    .map((id: string) => {
      const cat  = props.waifuCat?.find(w => w.id === id)
      const coll = props.collezione?.waifu?.[id] ?? {}
      const mosseData: Record<string, any> = {}
      for (const mid of Object.values(coll.mosse_slot ?? {}).filter(Boolean) as string[]) {
        const userMossa = props.collezione?.mosse?.[mid]
        const catMossa  = props.mosseCat?.find(m => m.id === mid)
        if (catMossa) mosseData[mid] = { ...catMossa, ...(userMossa || {}) }
      }
      return cat ? { ...cat, ...coll, _mosseData: mosseData } : null
    })
    .filter(Boolean)
)

// ── roster5E: le 5 waifu del difensore (fisse per tutto il Bo3) ──────────────
const roster5E = computed(() => {
  if (!props.waifuCat?.length) return []
  const patchW = (w: any) => w ? ({ ...w, asset_statica: w.asset_statica || w.asset_immagine || null }) : null
  const isCPU  = props.battle?.defenderUid === 'CPU'
  const defIds = props.battle?.defenderTeam

  let pool: any[] = []
  if (Array.isArray(defIds) && defIds.length === 5) {
    const resolved = defIds.map((id: string) => patchW(props.waifuCat!.find(c => c.id === id))).filter(Boolean)
    if (resolved.length === 5) pool = resolved
  }

  if (!pool.length) {
    let candidates = [...props.waifuCat!]
    if (!props.hasHardPass) candidates = candidates.filter(w => !w.hot)

    if (isCPU) {
      const cpuDeck = buildCPUDifficultyDeck(candidates, props.battle?.cpuDifficulty ?? 'easy')
      pool = cpuDeck.map(w => {
        const cpuMoves = generateCPUMovesFromCatalog(w?.rarita ?? 'comune', props.mosseCat ?? [])
        return patchW(w ? { ...w, _cpuMoves: cpuMoves } : w)
      }).filter(Boolean)
    } else {
      pool = candidates.sort(() => Math.random() - 0.5).slice(0, 5).map(patchW).filter(Boolean)
    }
  }

  if (isCPU && !props.hasHardPass) {
    pool = pool.filter(w => !w.hot)
    while (pool.length < 5) {
      const extra = props.waifuCat!.filter(w => !w.hot && !pool.some(p => p.id === w.id))
      if (!extra.length) break
      pool.push(patchW(extra[Math.floor(Math.random() * extra.length)]))
    }
  }

  if (!isCPU && !props.hasHardPass) {
    pool = pool.map((w: any) => w?.hot ? { ...w, _hotBlurred: true } : w)
  }

  return pool
})

// ── Computed per la fase pre-round ────────────────────────────────────────────
const roundNum = computed(() => (props.battle?.attackerWins ?? 0) + (props.battle?.defenderWins ?? 0) + 1)

const cpuDifficultyLabel = computed(() => {
  const d = props.battle?.cpuDifficulty ?? 'easy'
  return d.charAt(0).toUpperCase() + d.slice(1)
})

const battleName = computed(() =>
  props.battle?.isRaid ? (props.battle?.name ?? 'Waifu Raid')
  : props.battle?.defenderUid === 'CPU' ? 'CPU'
  : 'Avversario'
)

// ── Gestori fasi ──────────────────────────────────────────────────────────────
function onPickConfirm({ playerPick3: pTeam, enemyPick3: eTeam }: { playerPick3: any[]; enemyPick3: any[] }) {
  battleResult.value = null
  playerTeam.value   = pTeam

  // Ripristina _hotBlurred dall'originale roster5E
  const eTeamWithFlags = eTeam.map(w => {
    const orig = roster5E.value.find((r: any) => r.id === w.id)
    return orig?._hotBlurred ? { ...w, _hotBlurred: true } : w
  })

  // Applica moltiplicatori difficoltà CPU
  const mult = DIFFICULTY_STAT_MULT[props.battle?.cpuDifficulty ?? 'easy']
  const scaledETeam = props.battle?.defenderUid === 'CPU'
    ? applyDifficultyScaling(eTeamWithFlags, mult)
    : eTeamWithFlags

  enemyTeam.value = scaledETeam
  phase.value     = 'battle'
}

function onBattleResult(result: unknown) {
  const isVictory = !!(result as { isVictory?: boolean })?.isVictory
  battleResult.value = isVictory
}

function onBattleExit(choice?: string | null) {
  const prevPlayerTeamIds = playerTeam.value?.map(w => w.id) ?? []
  const prevEnemyTeamIds  = enemyTeam.value?.map(w => w.id) ?? []
  // Emette un oggetto con tutti i dati necessari al parent per la chiamata API
  emit('conquista', {
    isVictory: battleResult.value ?? false,
    choice,
    prevPlayerTeamIds,
    prevEnemyTeamIds,
  })
}

// ── Stili bottoni — calcolati come computed per reagire a isDark ──────────────
const ghostBtn = computed(() => ({
  flex: 1, padding: '14px',
  background: 'var(--theme-shimmer)',
  border: '1px solid var(--theme-border)',
  borderRadius: '999px', color: 'var(--theme-text-2)',
  fontFamily: FF.label,
  fontSize: '14px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
}))
const primaryBtn = computed(() => ({
  flex: 2, padding: '14px',
  background: 'linear-gradient(135deg, #c54a86, #ff85b6)',
  border: 'none', borderRadius: '999px', color: '#fff',
  fontFamily: FF.label,
  fontSize: '14px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(197,74,134,0.4)',
}))
</script>

<template>
  <!-- ── FASE PRE-ROUND ───────────────────────────────────────────────── -->
  <div
    v-if="phase === 'pre'"
    :style="{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--theme-bg)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }"
  >
    <div :style="{ fontFamily: FF.label, fontSize: '23px', letterSpacing: '0.28em', color: C.sakura, textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }">
      Round {{ roundNum }}
    </div>
    <div :style="{ fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.18em', color: 'var(--theme-text-2)', textTransform: 'uppercase', marginBottom: '12px' }">
      Al meglio delle 3
    </div>
    <div :style="{ fontFamily: FF.display, fontSize: '28px', color: 'var(--theme-text)', fontWeight: 900, marginBottom: '6px', textAlign: 'center' }">
      Inizia battaglia!
    </div>
    <div :style="{ fontFamily: FF.body, fontSize: '14px', color: 'var(--theme-text-2)', marginBottom: '32px' }">
      Difficoltà CPU: <strong :style="{ color: isDark ? C.aqua : '#0891b2', textTransform: 'uppercase' }">{{ cpuDifficultyLabel }}</strong>
    </div>

    <!-- Punteggio Bo3 -->
    <div :style="{ display: 'flex', gap: '40px', marginBottom: '48px', alignItems: 'center' }">
      <div style="text-align:center">
        <div :style="{ fontFamily: FF.label, fontSize: '18px', color: isDark ? C.aqua : '#0891b2', letterSpacing: '0.28em', marginBottom: '8px', fontWeight: 800, textTransform: 'uppercase' }">TU</div>
        <div :style="{ fontFamily: FF.display, fontSize: '52px', color: isDark ? C.aqua : '#0891b2', fontWeight: 900, lineHeight: 1 }">{{ battle?.attackerWins ?? 0 }}</div>
      </div>
      <div :style="{ fontFamily: FF.display, fontSize: '32px', color: 'var(--theme-text-3)', alignSelf: 'center' }">—</div>
      <div style="text-align:center">
        <div :style="{ fontFamily: FF.label, fontSize: '18px', color: C.sakura, letterSpacing: '0.28em', marginBottom: '8px', fontWeight: 800, textTransform: 'uppercase' }">CPU</div>
        <div :style="{ fontFamily: FF.display, fontSize: '52px', color: C.err, fontWeight: 900, lineHeight: 1 }">{{ battle?.defenderWins ?? 0 }}</div>
      </div>
    </div>

    <div :style="{ display: 'flex', gap: '12px', width: '100%', maxWidth: '340px' }">
      <button @click="emit('chiudi')" :style="ghostBtn">← Indietro</button>
      <button @click="phase = 'pick'" :style="primaryBtn">⚔ Combatti</button>
    </div>
  </div>

  <!-- ── FASE PICK ────────────────────────────────────────────────────── -->
  <!-- PickPhase non ancora portato: placeholder con componente lazy -->
  <PickPhase
    v-else-if="phase === 'pick'"
    :roster5P="roster5P"
    :roster5E="roster5E"
    :isCpu="true"
    :isPvP="false"
    :forcedEnemyIndices="battle?.isRaid ? [0] : (battle?.defenderUid === 'CPU' && !battle?.defenderTeam?.length ? [0, 1, 2] : [])"
    :battleCtx="({
      nomeImperoAvversario: battleName,
      nomeImpero: profilo?.nomeImpero || 'Tu',
    } as any)"
    @confirm="onPickConfirm"
  />

  <!-- ── FASE BATTLE ──────────────────────────────────────────────────── -->
  <div
    v-else-if="phase === 'battle'"
    :style="{ position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, bottom: 0, zIndex: 200, background: 'var(--bg-base)' }"
  >
    <WaifuBattleArena
      :playerTeam="(playerTeam as any)"
      :enemyTeam="(enemyTeam as any)"
      :waifuCat="waifuCat"
      :battleCtx="{
        nomeImperoAvversario: battleName,
        sonoAttaccante: true,
        nomeImpero: profilo?.nomeImpero || 'Tu',
        territoryName: battle?.name || `(${battle?.pixelX ?? ''}, ${battle?.pixelY ?? ''})`,
        hasHardPass: hasHardPass === true,
        isRaid: battle?.isRaid ?? false,
        bo3: {
          attackerWins: battle?.attackerWins ?? 0,
          defenderWins: battle?.defenderWins ?? 0,
        },
      }"
      @battle-result="onBattleResult"
      @exit="onBattleExit"
    />
  </div>
</template>
