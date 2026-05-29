<!--
  ╔══════════════════════════════════════════════════════════════════╗
  ║  AdminConfigTab — Configurazione globale, distribuzione, motori  ║
  ║                                                                  ║
  ║  Sub-tab interni:                                                ║
  ║   • config  → Range statistiche + step upgrade +                 ║
  ║               god-pack probability + bonifica waifu (ConfigTab)  ║
  ║   • distrib → Grafici a barre distribuzione catalogo             ║
  ║               waifu e mosse (DistribTab)                         ║
  ║   • motori  → Lista motori AI consigliati con link (MotoriTab)   ║
  ║                                                                  ║
  ║  Props: waifu[]                                                  ║
  ║  Emits: flash(t, c), reload()                                    ║
  ╚══════════════════════════════════════════════════════════════════╝
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { upsertWaifu } from '~/utils/firestoreService'
import { STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT, RARITA } from '~/utils/constants'
import { MOTORI_AI, suggerisciDiversificazione } from '~/utils/promptGenerator'
import { getDb } from '~/utils/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

// ── Props / Emits ────────────────────────────────────────────────
const props = defineProps<{
  waifu: unknown[]
}>()

const emit = defineEmits<{
  flash: [t: string, c: string]
  reload: []
}>()

// ── Navigazione sub-tab ──────────────────────────────────────────
type SubTab = 'config' | 'distrib' | 'motori'
const activeTab = ref<SubTab>('config')

const TABS: { id: SubTab; label: string }[] = [
  { id: 'config',  label: '⚙ Configurazione' },
  { id: 'distrib', label: '📊 Distribuzione' },
  { id: 'motori',  label: '🤖 Motori AI' },
]

// ════════════════════════════════════════════════════════════════
// SUB-TAB: CONFIGURAZIONE (range, upgrade steps, god pack, bonifica)
// ════════════════════════════════════════════════════════════════

const STAT_KEYS = [
  { key: 'tette',          label: 'Tette',        icon: '✦' },
  { key: 'colore_capelli', label: 'Capelli',       icon: '✿' },
  { key: 'eta',            label: 'Età',           icon: '⌛' },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘' },
  { key: 'esperienza',     label: 'Esperienza',    icon: '★' },
]

type RangesMap = Record<string, { min: number; max: number }>
type StepsMap  = Record<string, number>

const ranges     = ref<RangesMap>(JSON.parse(JSON.stringify(STAT_RANGES_DEFAULT)))
const steps      = ref<StepsMap>(JSON.parse(JSON.stringify(UPGRADE_STEPS_DEFAULT)))
const godPackProb = ref<number>(0.005)
const loading    = ref(true)
const saving     = ref(false)

interface BonificaRisultato {
  nome: string
  ok: boolean
  dettagli?: Record<string, { prima: number; dopo: number }>
  errore?: string
}
interface BonificaState {
  inCorso: boolean
  risultati: BonificaRisultato[]
}
const bonifica = ref<BonificaState | null>(null)

async function caricaConfigSub() {
  try {
    const db = getDb()
    const rDoc = await getDoc(doc(db, 'config', 'stat_ranges'))
    if (rDoc.exists()) ranges.value = { ...JSON.parse(JSON.stringify(STAT_RANGES_DEFAULT)), ...rDoc.data() }
    const sDoc = await getDoc(doc(db, 'config', 'upgrade_steps'))
    if (sDoc.exists()) steps.value = { ...JSON.parse(JSON.stringify(UPGRADE_STEPS_DEFAULT)), ...sDoc.data() }
    const gDoc = await getDoc(doc(db, 'config', 'pack_config'))
    if (gDoc.exists() && gDoc.data().god_pack_prob !== undefined) {
      godPackProb.value = Number(gDoc.data().god_pack_prob)
    }
  } catch { /* usa defaults */ }
  loading.value = false
}

function setRangeMin(key: string, val: string) {
  ranges.value = { ...ranges.value, [key]: { ...ranges.value[key], min: +val } }
}

function setRangeMax(key: string, val: string) {
  ranges.value = { ...ranges.value, [key]: { ...ranges.value[key], max: +val } }
}

function setStep(key: string, val: string) {
  steps.value = { ...steps.value, [key]: +val }
}

async function salvaConfig() {
  saving.value = true
  try {
    const db = getDb()
    await setDoc(doc(db, 'config', 'stat_ranges'), ranges.value)
    await setDoc(doc(db, 'config', 'upgrade_steps'), steps.value)
    await setDoc(doc(db, 'config', 'pack_config'), { god_pack_prob: Number(godPackProb.value) })
    emit('flash', 'Configurazione salvata!', '#06d6a0')
  } catch (e: unknown) {
    emit('flash', 'Errore salvataggio: ' + (e instanceof Error ? e.message : String(e)), '#ef4444')
  }
  saving.value = false
}

function resetDefaults() {
  ranges.value = JSON.parse(JSON.stringify(STAT_RANGES_DEFAULT))
  steps.value  = JSON.parse(JSON.stringify(UPGRADE_STEPS_DEFAULT))
  emit('flash', 'Valori resettati ai default (non ancora salvati)', '#f59e0b')
}

async function avviaBonifica() {
  const waifuList = props.waifu as Record<string, unknown>[]
  if (!confirm(`Bonificare ${waifuList.length} waifu con i range correnti?\nLe statistiche fuori range saranno clampate.`)) return
  bonifica.value = { inCorso: true, risultati: [] }
  const risultati: BonificaRisultato[] = []
  for (const w of waifuList) {
    const patch: Record<string, number> = {}
    const dettagli: Record<string, { prima: number; dopo: number }> = {}
    let modificata = false
    for (const { key } of STAT_KEYS) {
      const r   = ranges.value[key]
      if (!r) continue
      const val = w[key]
      if (val === undefined || val === null) continue
      const clamped = Math.max(r.min, Math.min(r.max, val as number))
      if (clamped !== val) {
        patch[key]    = clamped
        dettagli[key] = { prima: val as number, dopo: clamped }
        modificata = true
      }
    }
    if (modificata) {
      try {
        await upsertWaifu(w.id as string, patch)
        risultati.push({ nome: w.nome as string, patch, dettagli, ok: true })
      } catch (e: unknown) {
        risultati.push({ nome: w.nome as string, dettagli, errore: (e instanceof Error ? e.message : String(e)), ok: false })
      }
    }
  }
  bonifica.value = { inCorso: false, risultati }
  emit('reload')
  emit('flash', `Bonifica completata: ${risultati.filter(r => r.ok).length} waifu corrette`, '#06d6a0')
}

function statLabel(key: string): string {
  return STAT_KEYS.find(s => s.key === key)?.label || key
}

// ════════════════════════════════════════════════════════════════
// SUB-TAB: DISTRIBUZIONE CATALOGO
// ════════════════════════════════════════════════════════════════

interface BarEntry { label: string; value: number; color?: string }

// Calcoli distribuzione waifu
const raritaCount = computed<Record<string, number>>(() => {
  const acc: Record<string, number> = {}
  Object.keys(RARITA).forEach(k => { acc[k] = 0 })
  ;(props.waifu as Record<string, unknown>[]).forEach(w => {
    const r = w.rarita as string
    if (r) acc[r] = (acc[r] || 0) + 1
  })
  return acc
})

const assetCount = computed(() => {
  let conImmagine = 0
  let senzaImmagine = 0
  ;(props.waifu as Record<string, unknown>[]).forEach(w => {
    if (w.asset_statica || w.asset_immersiva) conImmagine++
    else senzaImmagine++
  })
  return { conImmagine, senzaImmagine }
})

const distribSugg = computed(() => suggerisciDiversificazione(props.waifu as Record<string, unknown>[]))

// Calcoli distribuzione mosse (mosse non è passata come prop in AdminConfigTab,
// ma DistribTab in React la riceveva; qui usiamo un array vuoto come fallback sicuro
// poiché AdminConfigTab non ha la prop mosse.)
const mosseVuote: unknown[] = []

// ════════════════════════════════════════════════════════════════
// Mount
// ════════════════════════════════════════════════════════════════
onMounted(async () => {
  await caricaConfigSub()
})

// ── Stili condivisi (equivalente alle costanti React) ────────────
const cardStatStyle = {
  padding: '14px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: '10px',
}

const inputStyleBase = {
  width: '100%',
  padding: '10px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: '6px',
  color: '#f5e6d3',
  fontFamily: 'inherit',
  fontSize: '13px',
  boxSizing: 'border-box' as const,
}

const btnPrimario = {
  padding: '8px 18px',
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none',
  color: '#000',
  fontWeight: 600,
  fontFamily: 'Cinzel, serif',
  fontSize: '11px',
  letterSpacing: '2px',
  borderRadius: '6px',
  cursor: 'pointer',
}

const btnSecondario = {
  padding: '5px 12px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.4)',
  color: '#f5e6d3',
  fontFamily: 'Cinzel, serif',
  fontSize: '10px',
  letterSpacing: '1px',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'inline-block',
  textAlign: 'center' as const,
}
</script>

<template>
  <div :style="{ color: '#f5e6d3' }">
    <!-- ── Barra sub-tab ────────────────────────────────────────── -->
    <div :style="{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }">
      <button
        v-for="t in TABS"
        :key="t.id"
        :disabled="activeTab === t.id"
        :style="{
          padding: '7px 16px',
          background: activeTab === t.id
            ? 'linear-gradient(135deg, #f59e0b, #ec4899)'
            : 'rgba(0,0,0,0.4)',
          border: activeTab === t.id
            ? 'none'
            : '1px solid rgba(245,158,11,0.35)',
          borderRadius: '8px',
          color: activeTab === t.id ? '#000' : '#f5e6d3',
          fontFamily: 'Orbitron, monospace',
          fontSize: '10px',
          fontWeight: 700,
          cursor: activeTab === t.id ? 'default' : 'pointer',
          letterSpacing: '1px',
        }"
        @click="activeTab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SUB-TAB: CONFIGURAZIONE                                    -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'config'">
      <!-- Loading -->
      <div
        v-if="loading"
        :style="{ textAlign: 'center', padding: '40px', color: '#f59e0b', fontFamily: 'Cinzel, serif' }"
      >
        ⏳ Caricamento configurazione...
      </div>

      <div v-else :style="{ maxWidth: '800px', margin: '0 auto' }">
        <h2 :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: '3px', margin: '0 0 6px' }">⚙ CONFIGURAZIONE</h2>
        <p :style="{ color: 'rgba(245,230,211,0.5)', fontSize: '12px', marginBottom: '24px' }">
          Modifica i range delle statistiche e gli step di upgrade. Dopo aver salvato, usa la bonifica per correggere le waifu esistenti.
        </p>

        <!-- Range statistiche -->
        <div :style="{ ...cardStatStyle, marginBottom: '20px' }">
          <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', fontSize: '13px', letterSpacing: '2px', marginBottom: '16px', marginTop: 0 }">
            📊 RANGE STATISTICHE
          </h3>
          <div :style="{ display: 'grid', gap: '14px' }">
            <div
              v-for="sk in STAT_KEYS"
              :key="sk.key"
              :style="{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: '10px', alignItems: 'center' }"
            >
              <div :style="{ fontFamily: 'Cinzel, serif', color: '#f5e6d3', fontSize: '11px' }">
                {{ sk.icon }} {{ sk.label }}
              </div>
              <div>
                <label :style="{ display: 'block', fontSize: '9px', color: '#a855f7', marginBottom: '3px', fontFamily: 'Cinzel, serif' }">MIN</label>
                <input
                  type="number"
                  :value="ranges[sk.key]?.min ?? ''"
                  :style="{ ...inputStyleBase, padding: '6px 8px' }"
                  @change="setRangeMin(sk.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div>
                <label :style="{ display: 'block', fontSize: '9px', color: '#a855f7', marginBottom: '3px', fontFamily: 'Cinzel, serif' }">MAX</label>
                <input
                  type="number"
                  :value="ranges[sk.key]?.max ?? ''"
                  :style="{ ...inputStyleBase, padding: '6px 8px' }"
                  @change="setRangeMax(sk.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Step upgrade -->
        <div :style="{ ...cardStatStyle, marginBottom: '20px' }">
          <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', fontSize: '13px', letterSpacing: '2px', marginBottom: '16px', marginTop: 0 }">
            ⚡ STEP UPGRADE (valore per +/-)
          </h3>
          <div :style="{ display: 'grid', gap: '10px' }">
            <div
              v-for="sk in STAT_KEYS"
              :key="sk.key"
              :style="{ display: 'grid', gridTemplateColumns: '130px 1fr 200px', gap: '10px', alignItems: 'center' }"
            >
              <div :style="{ fontFamily: 'Cinzel, serif', color: '#f5e6d3', fontSize: '11px' }">
                {{ sk.icon }} {{ sk.label }}
              </div>
              <input
                type="number"
                min="1"
                :value="steps[sk.key] ?? ''"
                :style="{ ...inputStyleBase, padding: '6px 8px' }"
                @change="setStep(sk.key, ($event.target as HTMLInputElement).value)"
              />
              <div :style="{ fontSize: '10px', color: 'rgba(245,230,211,0.4)', fontFamily: 'Cinzel, serif' }">
                range: {{ ranges[sk.key]?.min }}–{{ ranges[sk.key]?.max }}
              </div>
            </div>
          </div>
        </div>

        <!-- God Pack / Waifu Pack -->
        <div :style="{ ...cardStatStyle, marginBottom: '20px' }">
          <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px', marginTop: 0 }">
            ✦ WAIFU PACK (God Pack)
          </h3>
          <p :style="{ color: 'rgba(245,230,211,0.5)', fontSize: '11px', marginBottom: '16px', lineHeight: 1.6 }">
            Aprendo qualsiasi pacchetto, c'è una probabilità di trovare un
            <strong :style="{ color: '#f59e0b' }">Waifu Pack</strong>:
            invece di 2 waifu + 2 outfit + 1 posa, il giocatore trova
            <strong :style="{ color: '#f59e0b' }">5 waifu</strong>.
          </p>
          <div :style="{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', alignItems: 'center' }">
            <label :style="{ fontFamily: 'Cinzel, serif', color: '#f5e6d3', fontSize: '12px' }">
              🎴 Probabilità Waifu Pack
            </label>
            <div :style="{ display: 'flex', alignItems: 'center', gap: '12px' }">
              <input
                type="number"
                min="0" max="1" step="0.001"
                :value="godPackProb"
                :style="{
                  width: '100px', padding: '6px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '6px', color: '#f5e6d3',
                  fontFamily: 'Orbitron, monospace', fontSize: '12px',
                }"
                @change="godPackProb = Math.max(0, Math.min(1, Number(($event.target as HTMLInputElement).value)))"
              />
              <span :style="{ fontFamily: 'Orbitron, monospace', fontSize: '11px', color: '#f59e0b' }">
                = {{ (godPackProb * 100).toFixed(2) }}%
              </span>
              <span :style="{ fontSize: '10px', color: 'rgba(245,230,211,0.4)', fontFamily: 'Cinzel, serif' }">
                (0 = disabilitato, 0.005 = default 0.5%)
              </span>
            </div>
          </div>
          <div :style="{ fontSize: '9px', color: 'rgba(245,230,211,0.3)', marginTop: '10px', fontFamily: 'Orbitron, monospace', lineHeight: 1.6 }">
            ℹ Valore tra 0 e 1. Esempio: 0.01 = 1% di probabilità ad ogni apertura.
          </div>
        </div>

        <!-- Azioni -->
        <div :style="{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }">
          <button
            :disabled="saving"
            :style="btnPrimario"
            @click="salvaConfig"
          >
            {{ saving ? '⏳ Salvataggio...' : '💾 SALVA CONFIGURAZIONE' }}
          </button>
          <button :style="btnSecondario" @click="resetDefaults">↺ RESET DEFAULT</button>
          <button
            :disabled="bonifica?.inCorso"
            :style="{ ...btnSecondario, borderColor: 'rgba(239,68,68,0.5)', color: '#fca5a5' }"
            @click="avviaBonifica"
          >
            {{ bonifica?.inCorso ? '⏳ Bonifica in corso...' : `🔧 BONIFICA WAIFU (${waifu.length})` }}
          </button>
        </div>

        <!-- Risultati bonifica -->
        <div v-if="bonifica && !bonifica.inCorso" :style="cardStatStyle">
          <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#06d6a0', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px', marginTop: 0 }">
            ✅ RISULTATI BONIFICA ({{ bonifica.risultati.length }} waifu modificate)
          </h3>
          <div
            v-if="bonifica.risultati.length === 0"
            :style="{ color: 'rgba(245,230,211,0.5)', fontSize: '12px', fontFamily: 'Cinzel, serif' }"
          >
            Nessuna waifu fuori range — catalogo già conforme! ✓
          </div>
          <div
            v-else
            :style="{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }"
          >
            <div
              v-for="(r, i) in bonifica.risultati"
              :key="i"
              :style="{
                padding: '8px 12px', borderRadius: '6px',
                background: r.ok ? 'rgba(6,214,160,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${r.ok ? 'rgba(6,214,160,0.2)' : 'rgba(239,68,68,0.2)'}`,
                fontSize: '11px', fontFamily: 'Cinzel, serif',
              }"
            >
              <span :style="{ color: r.ok ? '#06d6a0' : '#fca5a5', marginRight: '8px' }">{{ r.ok ? '✓' : '✗' }}</span>
              <span :style="{ color: '#f5e6d3' }">{{ r.nome }}</span>
              <span v-if="r.ok && r.dettagli" :style="{ marginLeft: '8px', display: 'inline-flex', flexWrap: 'wrap', gap: '4px 12px' }">
                <span
                  v-for="(delta, k) in r.dettagli"
                  :key="k"
                  :style="{ color: 'rgba(245,230,211,0.6)', fontSize: '10px' }"
                >
                  <span :style="{ color: '#a0a0a0' }">{{ statLabel(k) }}:</span>
                  {{ ' ' }}
                  <span :style="{ color: '#fca5a5', fontWeight: 700 }">{{ delta.prima }}</span>
                  <span :style="{ color: '#a0a0a0' }"> → </span>
                  <span :style="{ color: '#06d6a0', fontWeight: 700 }">{{ delta.dopo }}</span>
                </span>
              </span>
              <span v-if="r.errore" :style="{ color: '#fca5a5', marginLeft: '8px' }">— {{ r.errore }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SUB-TAB: DISTRIBUZIONE CATALOGO                            -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-else-if="activeTab === 'distrib'">
      <div>
        <h2 :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: '3px', margin: '0 0 16px' }">📊 DISTRIBUZIONE CATALOGO</h2>

        <!-- Sezione Waifu -->
        <div :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: '3px', fontSize: '14px', marginTop: '16px', marginBottom: '8px' }">
          👑 WAIFU ({{ waifu.length }})
        </div>
        <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '20px' }">
          <!-- Per rarità -->
          <div :style="{ ...cardStatStyle }">
            <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '12px', marginBottom: '12px', marginTop: 0 }">★ PER RARITÀ</h3>
            <template v-for="([k, v]) in Object.entries(RARITA)" :key="k">
              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }">
                <div :style="{ width: '80px', fontSize: '10px', color: (v as any).colore, textAlign: 'right', flexShrink: 0 }">{{ (v as any).nome }}</div>
                <div :style="{ flex: 1, height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }">
                  <div :style="{
                    width: `${Math.max(1, (raritaCount[k] || 0)) / Math.max(1, ...Object.values(raritaCount)) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${(v as any).colore}cc, ${(v as any).colore})`,
                    borderRadius: '4px',
                    transition: 'width 0.5s',
                    boxShadow: `0 0 8px ${(v as any).colore}40`,
                  }" />
                  <div :style="{ position: 'absolute', right: '4px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }">{{ raritaCount[k] || 0 }}</div>
                </div>
              </div>
            </template>
          </div>

          <!-- Asset immagini -->
          <div :style="{ ...cardStatStyle }">
            <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '12px', marginBottom: '12px', marginTop: 0 }">🖼 ASSET IMMAGINI</h3>
            <template v-for="entry in ([{ label: 'Con immagine', value: assetCount.conImmagine, color: '#06d6a0' }, { label: 'Senza', value: assetCount.senzaImmagine, color: '#ef4444' }] as BarEntry[])" :key="entry.label">
              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }">
                <div :style="{ width: '80px', fontSize: '10px', color: entry.color, textAlign: 'right', flexShrink: 0 }">{{ entry.label }}</div>
                <div :style="{ flex: 1, height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }">
                  <div :style="{
                    width: `${Math.max(1, entry.value) / Math.max(1, assetCount.conImmagine + assetCount.senzaImmagine) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${entry.color}cc, ${entry.color})`,
                    borderRadius: '4px',
                    transition: 'width 0.5s',
                    boxShadow: `0 0 8px ${entry.color}40`,
                  }" />
                  <div :style="{ position: 'absolute', right: '4px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }">{{ entry.value }}</div>
                </div>
              </div>
            </template>
          </div>

          <!-- Archetipi -->
          <div :style="{ ...cardStatStyle }">
            <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '12px', marginBottom: '12px', marginTop: 0 }">📋 ARCHETIPI</h3>
            <template v-for="(a, idx) in distribSugg.distribuzioneArche.slice(0, 10)" :key="idx">
              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }">
                <div :style="{ width: '80px', fontSize: '10px', color: (a as any).conta === 0 ? '#06d6a0' : (a as any).conta > 2 ? '#ef4444' : '#a855f7', textAlign: 'right', flexShrink: 0 }">{{ ((a as any).nome as string).substring(0, 14) }}</div>
                <div :style="{ flex: 1, height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }">
                  <div :style="{
                    width: `${Math.max(1, (a as any).conta) / Math.max(1, ...distribSugg.distribuzioneArche.slice(0, 10).map((x: any) => x.conta)) * 100}%`,
                    height: '100%',
                    background: (a as any).conta === 0 ? 'linear-gradient(90deg, #06d6a0cc, #06d6a0)' : (a as any).conta > 2 ? 'linear-gradient(90deg, #ef4444cc, #ef4444)' : 'linear-gradient(90deg, #a855f7cc, #a855f7)',
                    borderRadius: '4px',
                    transition: 'width 0.5s',
                  }" />
                  <div :style="{ position: 'absolute', right: '4px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }">{{ (a as any).conta }}</div>
                </div>
              </div>
            </template>
          </div>

          <!-- Palette -->
          <div :style="{ ...cardStatStyle }">
            <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '12px', marginBottom: '12px', marginTop: 0 }">🎨 PALETTE</h3>
            <template v-for="(p, idx) in distribSugg.distribuzionePalette" :key="idx">
              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }">
                <div :style="{ width: '80px', fontSize: '10px', color: (p as any).conta === 0 ? '#06d6a0' : (p as any).conta > 2 ? '#ef4444' : '#3b82f6', textAlign: 'right', flexShrink: 0 }">{{ ((p as any).nome as string).substring(0, 14) }}</div>
                <div :style="{ flex: 1, height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }">
                  <div :style="{
                    width: `${Math.max(1, (p as any).conta) / Math.max(1, ...distribSugg.distribuzionePalette.map((x: any) => x.conta)) * 100}%`,
                    height: '100%',
                    background: (p as any).conta === 0 ? 'linear-gradient(90deg, #06d6a0cc, #06d6a0)' : (p as any).conta > 2 ? 'linear-gradient(90deg, #ef4444cc, #ef4444)' : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                    borderRadius: '4px',
                    transition: 'width 0.5s',
                  }" />
                  <div :style="{ position: 'absolute', right: '4px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }">{{ (p as any).conta }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Sezione Mosse (nessuna prop mosse su questo tab — mostra 0) -->
        <div :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '3px', fontSize: '14px', marginBottom: '8px' }">
          ⚔ MOSSE ATTACCO ({{ mosseVuote.length }})
        </div>
        <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }">
          <div :style="{ ...cardStatStyle }">
            <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '12px', marginBottom: '12px', marginTop: 0 }">★ PER RARITÀ</h3>
            <template v-for="([k, v]) in Object.entries(RARITA)" :key="k">
              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }">
                <div :style="{ width: '80px', fontSize: '10px', color: (v as any).colore, textAlign: 'right', flexShrink: 0 }">{{ (v as any).nome }}</div>
                <div :style="{ flex: 1, height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }">
                  <div :style="{ width: '0%', height: '100%', background: `linear-gradient(90deg, ${(v as any).colore}cc, ${(v as any).colore})`, borderRadius: '4px' }" />
                  <div :style="{ position: 'absolute', right: '4px', top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }">0</div>
                </div>
              </div>
            </template>
          </div>
          <div :style="{ ...cardStatStyle }">
            <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '12px', marginBottom: '12px', marginTop: 0 }">🖼 IMMAGINI</h3>
            <div :style="{ color: 'rgba(245,230,211,0.4)', fontFamily: 'Orbitron, monospace', fontSize: '10px' }">
              Passa le mosse al tab AdminMosseTab per vedere la distribuzione completa.
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SUB-TAB: MOTORI AI                                         -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-else-if="activeTab === 'motori'">
      <div>
        <h2 :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: '3px', margin: '0 0 8px' }">🤖 MOTORI AI CONSIGLIATI</h2>
        <p :style="{ fontSize: '12px', opacity: 0.8, marginBottom: '16px' }">
          Strumenti per generare gli asset a partire dai prompt che il sistema produce per ogni waifu/outfit/posa.
        </p>

        <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }">
          <div
            v-for="(m, i) in MOTORI_AI"
            :key="i"
            :style="{
              padding: '16px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '10px',
            }"
          >
            <div :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: '1px', fontSize: '14px', marginBottom: '4px' }">{{ m.nome }}</div>
            <div :style="{ fontSize: '11px', opacity: 0.7, marginBottom: '6px' }"><strong>Tipo:</strong> {{ m.target }}</div>
            <div :style="{ fontSize: '11px', opacity: 0.85, marginBottom: '8px', lineHeight: 1.5 }">{{ m.note }}</div>
            <div :style="{ fontSize: '10px', opacity: 0.7, marginBottom: '8px' }">
              <strong>Adatto per:</strong> {{ m.consigliato_per.join(', ') }}
            </div>
            <div :style="{ display: 'flex', gap: '6px', flexWrap: 'wrap' }">
              <a
                :href="m.link"
                target="_blank"
                rel="noopener"
                :style="{ ...btnSecondario, textDecoration: 'none' }"
              >🔗 SOFTWARE</a>
              <a
                v-if="m.modello_link"
                :href="m.modello_link"
                target="_blank"
                rel="noopener"
                :style="{ ...btnSecondario, textDecoration: 'none' }"
              >📦 MODELLO</a>
            </div>
          </div>
        </div>

        <!-- Workflow consigliato -->
        <div :style="{ marginTop: '20px', padding: '14px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px' }">
          <h3 :style="{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: '2px', fontSize: '13px', marginTop: 0 }">💡 WORKFLOW CONSIGLIATO</h3>
          <ol :style="{ fontSize: '12px', lineHeight: 1.8, opacity: 0.9 }">
            <li>Scegli un motore AI (consiglio <strong>ComfyUI + Animagine XL 4.0</strong> per la massima qualità)</li>
            <li>Crea una nuova waifu nell'admin compilando dati e fillers (outfit/posa/fanservice)</li>
            <li>Vai nelle tab "Prompt Paper-Doll", "Prompt Carta Statica", "Prompt Carta Immersiva"</li>
            <li>Copia il prompt e il negative, incollali nel motore AI con i parametri consigliati</li>
            <li>Genera l'immagine, poi tornaci e caricala nell'apposito uploader</li>
            <li>Il sistema linkerà l'asset alla waifu e lo userà nel gioco</li>
          </ol>
        </div>
      </div>
    </template>
  </div>
</template>
