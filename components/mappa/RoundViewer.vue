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
  label:   "'Saira Condensed', sans-serif",
  display: "'Unbounded', sans-serif",
  body:    "'DM Sans', sans-serif",
  mono:    "'JetBrains Mono', monospace",
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

// ── Auth ──────────────────────────────────────────────────────────────────────
const authStore = useAuthStore()

// ── Fase iniziale basata su nextRoundChoice ───────────────────────────────────
type Phase = 'pre' | 'pick' | 'battle'
const initialPhase: Phase =
  props.battle?.nextRoundChoice === 'same'   ? 'battle' :
  props.battle?.nextRoundChoice === 'switch' ? 'pick'   : 'pre'

const phase = ref<Phase>(initialPhase)

// ── Team giocatore (inizializzato se nextRoundChoice === 'same') ──────────────
const playerTeam = ref<any[] | null>(() => {
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
})

// ── Team nemico (inizializzato se nextRoundChoice === 'same') ─────────────────
const enemyTeam = ref<any[] | null>(() => {
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
})

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
function onPickConfirm(pTeam: any[], eTeam: any[]) {
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

function onBattleResult(isVictory: boolean) {
  battleResult.value = isVictory
}

function onBattleExit(choice: string | null) {
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

// ── Stili bottoni ─────────────────────────────────────────────────────────────
const ghostBtn = {
  flex: 1, padding: '13px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(174,156,255,0.2)',
  borderRadius: '14px', color: 'rgba(241,235,255,0.5)',
  fontFamily: "'Saira Condensed', sans-serif",
  fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
}
const primaryBtn = {
  flex: 2, padding: '13px',
  background: 'linear-gradient(135deg, #c54a86, #ff85b6)',
  border: 'none', borderRadius: '14px', color: '#fff',
  fontFamily: "'Saira Condensed', sans-serif",
  fontSize: '13px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
}
</script>

<template>
  <!-- ── FASE PRE-ROUND ───────────────────────────────────────────────── -->
  <div
    v-if="phase === 'pre'"
    :style="{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }"
  >
    <div :style="{ fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', marginBottom: '4px' }">
      Round {{ roundNum }}
    </div>
    <div :style="{ fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(174,156,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }">
      Al meglio delle 3
    </div>
    <div :style="{ fontFamily: FF.display, fontSize: '22px', color: '#fff', fontWeight: 800, marginBottom: '4px' }">
      Inizia battaglia!
    </div>
    <div :style="{ fontFamily: FF.body, fontSize: '12px', color: 'rgba(241,235,255,0.5)', marginBottom: '6px' }">
      Difficoltà CPU: <span :style="{ color: C.aqua, textTransform: 'uppercase' }">{{ cpuDifficultyLabel }}</span>
    </div>

    <!-- Punteggio Bo3 -->
    <div :style="{ display: 'flex', gap: '32px', marginBottom: '40px' }">
      <div style="text-align:center">
        <div :style="{ fontFamily: FF.label, fontSize: '9px', color: C.gold, letterSpacing: '0.2em', marginBottom: '6px' }">TU</div>
        <div :style="{ fontFamily: FF.display, fontSize: '44px', color: C.aqua, fontWeight: 900, lineHeight: 1 }">{{ battle?.attackerWins ?? 0 }}</div>
      </div>
      <div :style="{ fontFamily: FF.display, fontSize: '28px', color: 'rgba(241,235,255,0.2)', alignSelf: 'center' }">—</div>
      <div style="text-align:center">
        <div :style="{ fontFamily: FF.label, fontSize: '9px', color: C.sakura, letterSpacing: '0.2em', marginBottom: '6px' }">CPU</div>
        <div :style="{ fontFamily: FF.display, fontSize: '44px', color: C.err, fontWeight: 900, lineHeight: 1 }">{{ battle?.defenderWins ?? 0 }}</div>
      </div>
    </div>

    <div :style="{ display: 'flex', gap: '12px', width: '100%', maxWidth: '320px' }">
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
    :battleCtx="{
      nomeImperoAvversario: battleName,
      sonoAttaccante: true,
      nomeImpero: profilo?.nomeImpero || 'Tu',
    }"
    @confirm="onPickConfirm"
  />

  <!-- ── FASE BATTLE ──────────────────────────────────────────────────── -->
  <div
    v-else-if="phase === 'battle'"
    :style="{ position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, bottom: 0, zIndex: 200, background: '#07051a' }"
  >
    <WaifuBattleArena
      :playerTeam="playerTeam"
      :enemyTeam="enemyTeam"
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
