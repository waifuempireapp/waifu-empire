<!--
  ╔══════════════════════════════════════════════════════════════════╗
  ║  AdminMosseTab — Gestione catalogo mosse e configurazioni        ║
  ║                                                                  ║
  ║  Sub-tab interni:                                                ║
  ║   • mosse  → CRUD mosse attacco (MosseTab)                       ║
  ║   • rarity → Moltiplicatori rarità velocità/crit (RarityMultTab) ║
  ║   • config → Range PP/danno/crit + incrementi levelup +          ║
  ║              log chiusure classifica (ConfigMosseTab)            ║
  ║   • tipi   → Editor ciclo pentagonale tipi waifu (TipiWaifuTab)  ║
  ║                                                                  ║
  ║  Props: mosse[], waifu[]                                         ║
  ║  Emits: flash(t, c), reload()                                    ║
  ╚══════════════════════════════════════════════════════════════════╝
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  RARITY_MULTIPLIERS_DEFAULT,
  MOVE_RANGES_DEFAULT,
  MOVE_LEVELUP_DEFAULT,
  type RaritaKey,
} from '~/utils/constants'
import { getDb } from '~/utils/firebase'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore'

// ── Props / Emits ────────────────────────────────────────────────
defineProps<{
  mosse: unknown[]
  waifu: unknown[]
}>()

const emit = defineEmits<{
  flash: [t: string, c: string]
  reload: []
}>()

// ── Navigazione sub-tab ──────────────────────────────────────────
type SubTab = 'mosse' | 'rarity' | 'config' | 'tipi'
const activeTab = ref<SubTab>('mosse')

const TABS: { id: SubTab; label: string }[] = [
  { id: 'mosse',  label: '⚔ Mosse' },
  { id: 'rarity', label: '⚡ Moltiplicatori' },
  { id: 'config', label: '⚙ Config Mosse' },
  { id: 'tipi',   label: '🌀 Tipi Waifu' },
]

// ════════════════════════════════════════════════════════════════
// SUB-TAB: MOSSE ATTACCO
// ════════════════════════════════════════════════════════════════
const TIPI_MOSSA = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco']
const RARITA_LIST: RaritaKey[] = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']

interface MossaForm {
  id?: string
  nome: string
  tipologia: string
  rarita: string
  pp: number
  danno: number
  danno_critico: number
  abilita: string
  nome_waifu: string
  immagine_url: string
  espansione_id: string
}

const MOSSA_EMPTY: Omit<MossaForm, 'id'> = {
  nome: '',
  tipologia: 'Arcana',
  rarita: 'comune',
  pp: 20,
  danno: 30,
  danno_critico: 0.08,
  abilita: '',
  nome_waifu: '',
  immagine_url: '/images/mosse/placeholder.png',
  espansione_id: 'esp_genesi',
}

const mossaEditor = ref<MossaForm | null>(null)
const mossaBusy   = ref(false)

function apriNuovaMossa() {
  mossaEditor.value = { ...MOSSA_EMPTY }
}

function apriModificaMossa(m: unknown) {
  mossaEditor.value = { ...(m as MossaForm) }
}

async function salvaMossa() {
  if (!mossaEditor.value) return
  mossaBusy.value = true
  try {
    const db  = getDb()
    const m   = mossaEditor.value
    const ref = m.id
      ? doc(db, 'catalogo_mosse', m.id)
      : doc(collection(db, 'catalogo_mosse'))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = m
    await setDoc(ref, { ...rest, aggiornato: new Date() }, { merge: true })
    emit('flash', '✅ Mossa salvata', '#06d6a0')
    mossaEditor.value = null
    emit('reload')
  } catch (e: unknown) {
    emit('flash', '❌ ' + (e instanceof Error ? e.message : String(e)), '#ef4444')
  } finally {
    mossaBusy.value = false
  }
}

async function eliminaMossa(id: string) {
  if (!confirm('Eliminare la mossa?')) return
  const db = getDb()
  await deleteDoc(doc(db, 'catalogo_mosse', id))
  emit('flash', 'Mossa eliminata', '#f59e0b')
  emit('reload')
}

// ════════════════════════════════════════════════════════════════
// SUB-TAB: MOLTIPLICATORI RARITÀ
// ════════════════════════════════════════════════════════════════
const rarities: RaritaKey[] = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']

const rarityFields: [string, string, number, number, number][] = [
  ['multiplier', 'Mult',    0.1, 3,    0.05],
  ['vel_min',    'Vel Min', 1,   1000, 1   ],
  ['vel_max',    'Vel Max', 1,   1000, 1   ],
  ['crit_min',   'Crit Min', 0,  1,    0.01],
  ['crit_max',   'Crit Max', 0,  1,    0.01],
]

type RarityMultMap = Record<string, Record<string, number>>
const rarityMult = ref<RarityMultMap>(
  JSON.parse(JSON.stringify(RARITY_MULTIPLIERS_DEFAULT))
)
const rarityBusy = ref(false)

async function caricaRarityMult() {
  try {
    const db = getDb()
    const s  = await getDoc(doc(db, 'config', 'rarity_multipliers'))
    if (s.exists()) {
      rarityMult.value = { ...JSON.parse(JSON.stringify(RARITY_MULTIPLIERS_DEFAULT)), ...s.data() }
    }
  } catch { /* usa defaults */ }
}

function setRarityField(r: string, k: string, val: string) {
  rarityMult.value = {
    ...rarityMult.value,
    [r]: { ...rarityMult.value[r], [k]: parseFloat(val) },
  }
}

async function salvaRarityMult() {
  rarityBusy.value = true
  try {
    const db = getDb()
    await setDoc(doc(db, 'config', 'rarity_multipliers'), rarityMult.value)
    emit('flash', '✅ Moltiplicatori rarità salvati', '#06d6a0')
  } catch {
    emit('flash', '❌ Errore salvataggio', '#ef4444')
  } finally {
    rarityBusy.value = false
  }
}

// ════════════════════════════════════════════════════════════════
// SUB-TAB: CONFIG MOSSE (range + levelup + log chiusure)
// ════════════════════════════════════════════════════════════════
type MoveRangesMap  = Record<string, Record<string, number>>
type MoveLevelupMap = Record<string, number>

const moveRanges  = ref<MoveRangesMap>(JSON.parse(JSON.stringify(MOVE_RANGES_DEFAULT)))
const moveLevelup = ref<MoveLevelupMap>(JSON.parse(JSON.stringify(MOVE_LEVELUP_DEFAULT)))
const configBusy  = ref(false)
const logs        = ref<unknown[]>([])
const loadingLogs = ref(false)

const rangeFields: [string, string][] = [
  ['pp_min',    'PP min'],
  ['pp_max',    'PP max'],
  ['danno_min', 'Dan min'],
  ['danno_max', 'Dan max'],
  ['crit_min',  'Crit min'],
  ['crit_max',  'Crit max'],
]

async function caricaConfigMoveSub() {
  try {
    const db = getDb()
    const [rS, lS] = await Promise.all([
      getDoc(doc(db, 'config', 'move_ranges')),
      getDoc(doc(db, 'config', 'move_levelup')),
    ])
    if (rS.exists()) moveRanges.value = { ...JSON.parse(JSON.stringify(MOVE_RANGES_DEFAULT)), ...rS.data() }
    if (lS.exists()) moveLevelup.value = { ...JSON.parse(JSON.stringify(MOVE_LEVELUP_DEFAULT)), ...lS.data() }
  } catch { /* usa defaults */ }
}

function setRangeField(r: string, k: string, val: string) {
  moveRanges.value = {
    ...moveRanges.value,
    [r]: { ...moveRanges.value[r], [k]: parseFloat(val) },
  }
}

function setLevelupField(k: string, val: string) {
  moveLevelup.value = { ...moveLevelup.value, [k]: parseFloat(val) }
}

async function salvaConfigMovse() {
  configBusy.value = true
  try {
    const db = getDb()
    await Promise.all([
      setDoc(doc(db, 'config', 'move_ranges'),  moveRanges.value),
      setDoc(doc(db, 'config', 'move_levelup'), moveLevelup.value),
    ])
    emit('flash', '✅ Config mosse salvata', '#06d6a0')
  } catch (e: unknown) {
    emit('flash', '❌ ' + (e instanceof Error ? e.message : String(e)), '#ef4444')
  } finally {
    configBusy.value = false
  }
}

interface LogEntry { id: string; tipo?: string; timestamp?: { seconds: number }; totalUsersUpdated?: number; top5?: { waifuId: string; nome: string; oldRarita: string; newRarita: string; skipped?: boolean; likes?: number }[] }

async function caricaLogs() {
  loadingLogs.value = true
  try {
    const db = getDb()
    const q  = query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'), limit(10))
    const snap = await getDocs(q)
    logs.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as LogEntry))
      .filter((l: LogEntry) => l.tipo === 'swap_closure')
  } catch (e: unknown) {
    emit('flash', '❌ ' + (e instanceof Error ? e.message : String(e)), '#ef4444')
  } finally {
    loadingLogs.value = false
  }
}

function logTimestamp(log: unknown): string {
  const l = log as LogEntry
  return l.timestamp?.seconds
    ? new Date(l.timestamp.seconds * 1000).toLocaleString('it-IT')
    : l.id
}

// ════════════════════════════════════════════════════════════════
// SUB-TAB: TIPI WAIFU (ciclo pentagonale)
// ════════════════════════════════════════════════════════════════
interface TipoWaifu { nome: string; colore: string; batte: string }

const TIPI_DEFAULT: TipoWaifu[] = [
  { nome: 'Arcana', colore: '#9C27B0', batte: 'Natura' },
  { nome: 'Natura', colore: '#4CAF50', batte: 'Abisso' },
  { nome: 'Abisso', colore: '#1A237E', batte: 'Ferro'  },
  { nome: 'Ferro',  colore: '#607D8B', batte: 'Fuoco'  },
  { nome: 'Fuoco',  colore: '#F44336', batte: 'Arcana' },
]

const tipi     = ref<TipoWaifu[]>(JSON.parse(JSON.stringify(TIPI_DEFAULT)))
const tipiBusy = ref(false)

async function caricaTipiWaifu() {
  try {
    const db = getDb()
    const s  = await getDoc(doc(db, 'config', 'waifu_types'))
    if (s.exists()) {
      const data = s.data() as Record<string, { colore: string; batte: string }>
      const arr = Object.entries(data).map(([nome, val]) => ({ nome, ...val }))
      if (arr.length > 0) tipi.value = arr
    }
  } catch { /* usa defaults */ }
}

function setTipoColore(i: number, colore: string) {
  tipi.value = tipi.value.map((t, j) => j === i ? { ...t, colore } : t)
}

function setTipoBatte(i: number, batte: string) {
  tipi.value = tipi.value.map((t, j) => j === i ? { ...t, batte } : t)
}

async function salvaTipiWaifu() {
  tipiBusy.value = true
  try {
    const db   = getDb()
    const data: Record<string, { colore: string; batte: string }> = {}
    tipi.value.forEach(t => { data[t.nome] = { colore: t.colore, batte: t.batte } })
    await setDoc(doc(db, 'config', 'waifu_types'), data)
    emit('flash', '✅ Tipi Waifu salvati', '#06d6a0')
  } catch (e: unknown) {
    emit('flash', '❌ ' + (e instanceof Error ? e.message : String(e)), '#ef4444')
  } finally {
    tipiBusy.value = false
  }
}

// ── Mount: carica tutti i dati remoti ───────────────────────────
onMounted(async () => {
  await Promise.all([
    caricaRarityMult(),
    caricaConfigMoveSub(),
    caricaTipiWaifu(),
  ])
})
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
    <!-- SUB-TAB: MOSSE ATTACCO                                     -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'mosse'">
      <!-- Modulo editor -->
      <div v-if="mossaEditor" :style="{ maxWidth: '600px' }">
        <h3 :style="{ fontFamily: 'Cinzel, serif', fontSize: '16px', color: '#f59e0b', marginBottom: '20px' }">
          {{ mossaEditor.id ? 'Modifica Mossa' : 'Nuova Mossa' }}
        </h3>

        <!-- Nome -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Nome</label>
          <input
            v-model="mossaEditor.nome"
            type="text"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Tipologia -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Tipologia</label>
          <select
            v-model="mossaEditor.tipologia"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px' }"
          >
            <option v-for="o in TIPI_MOSSA" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>

        <!-- Rarità -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Rarità</label>
          <select
            v-model="mossaEditor.rarita"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px' }"
          >
            <option v-for="o in RARITA_LIST" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>

        <!-- PP -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">PP</label>
          <input
            v-model.number="mossaEditor.pp"
            type="number" min="1" max="30"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Danno -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Danno</label>
          <input
            v-model.number="mossaEditor.danno"
            type="number" min="1" max="300"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Danno Critico -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Danno Critico (%)</label>
          <input
            v-model.number="mossaEditor.danno_critico"
            type="number" min="0.01" max="0.99" step="0.01"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Abilità -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Abilità (testo, solo epica+)</label>
          <input
            v-model="mossaEditor.abilita"
            type="text"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Nome Waifu -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Nome Waifu (solo immersiva)</label>
          <input
            v-model="mossaEditor.nome_waifu"
            type="text"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Immagine URL -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Immagine URL</label>
          <input
            v-model="mossaEditor.immagine_url"
            type="text"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Espansione ID -->
        <div :style="{ marginBottom: '12px' }">
          <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">Espansione ID</label>
          <input
            v-model="mossaEditor.espansione_id"
            type="text"
            :style="{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.3)', color: '#f5e6d3', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontSize: '11px', boxSizing: 'border-box' }"
          />
        </div>

        <!-- Pulsanti -->
        <div :style="{ display: 'flex', gap: '10px', marginTop: '16px' }">
          <button
            :disabled="mossaBusy"
            :style="{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              border: 'none', borderRadius: '10px',
              color: '#000', fontFamily: 'Orbitron, monospace', fontSize: '10px', fontWeight: 700,
              cursor: mossaBusy ? 'not-allowed' : 'pointer',
            }"
            @click="salvaMossa"
          >
            {{ mossaBusy ? '⏳' : '💾 SALVA' }}
          </button>
          <button
            :style="{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              color: '#f5e6d3', fontFamily: 'Orbitron, monospace', fontSize: '10px',
              cursor: 'pointer',
            }"
            @click="mossaEditor = null"
          >
            Annulla
          </button>
        </div>
      </div>

      <!-- Lista mosse -->
      <div v-else :style="{ maxWidth: '900px' }">
        <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }">
          <h2 :style="{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f59e0b', margin: 0 }">⚔ Mosse Attacco</h2>
          <button
            :style="{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              border: 'none', borderRadius: '8px',
              color: '#000', fontFamily: 'Orbitron, monospace', fontSize: '9px', fontWeight: 700,
              cursor: 'pointer',
            }"
            @click="apriNuovaMossa"
          >
            + NUOVA MOSSA
          </button>
        </div>
        <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }">
          <div
            v-for="m in (mosse as any[])"
            :key="(m as any).id"
            :style="{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '12px',
              padding: '14px 16px',
            }"
          >
            <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '13px', color: '#f59e0b', marginBottom: '6px' }">{{ (m as any).nome }}</div>
            <div :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.6)', marginBottom: '8px' }">
              {{ (m as any).tipologia }} · {{ (m as any).rarita }} · Lv{{ (m as any).livello ?? 1 }}
            </div>
            <div :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: '#f5e6d3', marginBottom: '10px' }">
              PP: {{ (m as any).pp }} | Danno: {{ (m as any).danno }} | Crit: {{ Math.round(((m as any).danno_critico ?? 0) * 100) }}%<span v-if="(m as any).abilita"> | 🔮</span>
            </div>
            <div :style="{ display: 'flex', gap: '8px' }">
              <button
                :style="{
                  flex: 1, padding: '6px',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '6px', color: '#f59e0b',
                  fontFamily: 'Orbitron, monospace', fontSize: '9px', cursor: 'pointer',
                }"
                @click="apriModificaMossa(m)"
              >
                ✎ Modifica
              </button>
              <button
                :style="{
                  padding: '6px 10px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: '6px', color: '#ef4444',
                  fontFamily: 'Orbitron, monospace', fontSize: '9px', cursor: 'pointer',
                }"
                @click="eliminaMossa((m as any).id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SUB-TAB: MOLTIPLICATORI RARITÀ                             -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-else-if="activeTab === 'rarity'">
      <div :style="{ color: '#f5e6d3', maxWidth: '700px' }">
        <h2 :style="{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f59e0b', marginBottom: '24px' }">⚡ Moltiplicatori Rarità</h2>
        <p :style="{ fontFamily: 'Orbitron, monospace', fontSize: '10px', color: 'rgba(245,158,11,0.6)', marginBottom: '16px', lineHeight: 1.6 }">
          Multiplier applicato a velocita e crit_chance dopo il calcolo base. Range = limiti min/max del valore finale.
        </p>

        <div
          v-for="r in rarities"
          :key="r"
          :style="{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '14px',
          }"
        >
          <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '14px', color: '#f59e0b', marginBottom: '12px', textTransform: 'capitalize' }">{{ r }}</div>
          <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }">
            <div v-for="[k, lbl, mn, mx, step] in rarityFields" :key="k">
              <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', display: 'block', marginBottom: '4px' }">{{ lbl }}</label>
              <input
                type="number"
                :min="mn" :max="mx" :step="step"
                :value="(rarityMult[r] as any)?.[k] ?? ''"
                :style="{
                  width: '100%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f5e6d3', borderRadius: '6px',
                  padding: '6px 8px',
                  fontFamily: 'Orbitron, monospace', fontSize: '10px',
                  boxSizing: 'border-box',
                }"
                @change="setRarityField(r, k, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <button
          :disabled="rarityBusy"
          :style="{
            padding: '10px 24px',
            background: rarityBusy ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #ec4899)',
            border: 'none', borderRadius: '10px',
            color: '#000', fontFamily: 'Orbitron, monospace', fontSize: '10px', fontWeight: 700,
            cursor: rarityBusy ? 'not-allowed' : 'pointer',
          }"
          @click="salvaRarityMult"
        >
          {{ rarityBusy ? '⏳ Salvataggio…' : '💾 SALVA MOLTIPLICATORI' }}
        </button>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SUB-TAB: CONFIG MOSSE + LOG CLASSIFICA                     -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-else-if="activeTab === 'config'">
      <div :style="{ color: '#f5e6d3', maxWidth: '800px' }">
        <h2 :style="{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f59e0b', marginBottom: '8px' }">⚙ Config Mosse &amp; Log</h2>

        <!-- Range statistiche per rarità -->
        <h3 :style="{ fontFamily: 'Orbitron, monospace', fontSize: '11px', color: 'rgba(245,158,11,0.7)', marginBottom: '12px', letterSpacing: '2px' }">RANGE STATISTICHE PER RARITÀ</h3>
        <div
          v-for="r in rarities"
          :key="r"
          :style="{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '8px',
          }"
        >
          <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '12px', color: '#f59e0b', marginBottom: '8px', textTransform: 'capitalize' }">{{ r }}</div>
          <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }">
            <div v-for="[k, lbl] in rangeFields" :key="k">
              <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '7px', color: 'rgba(245,158,11,0.5)', display: 'block', marginBottom: '3px' }">{{ lbl }}</label>
              <input
                type="number"
                step="0.01"
                :value="(moveRanges[r] as any)?.[k] ?? ''"
                :style="{
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f5e6d3', borderRadius: '6px',
                  padding: '5px 6px',
                  fontFamily: 'Orbitron, monospace', fontSize: '9px',
                  width: '100%', boxSizing: 'border-box',
                }"
                @change="setRangeField(r, k, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <!-- Incrementi level up -->
        <h3 :style="{ fontFamily: 'Orbitron, monospace', fontSize: '11px', color: 'rgba(245,158,11,0.7)', marginBottom: '12px', letterSpacing: '2px', marginTop: '20px' }">INCREMENTI LEVEL UP MOSSE</h3>
        <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }">
          <div
            v-for="[k, lbl] in ([['incremento_danno','Danno (livelli dispari)'],['incremento_danno_critico','Danno Critico (livelli pari)']] as [string, string][])"
            :key="k"
          >
            <label :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.6)', display: 'block', marginBottom: '4px' }">{{ lbl }}</label>
            <input
              type="number"
              step="0.01"
              :value="moveLevelup[k] ?? ''"
              :style="{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#f5e6d3', borderRadius: '8px',
                padding: '8px 12px',
                fontFamily: 'Orbitron, monospace', fontSize: '11px',
                width: '100%', boxSizing: 'border-box',
              }"
              @change="setLevelupField(k, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <button
          :disabled="configBusy"
          :style="{
            padding: '10px 24px',
            background: configBusy ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #ec4899)',
            border: 'none', borderRadius: '10px',
            color: '#000', fontFamily: 'Orbitron, monospace', fontSize: '10px', fontWeight: 700,
            cursor: configBusy ? 'not-allowed' : 'pointer',
            marginBottom: '32px',
          }"
          @click="salvaConfigMovse"
        >
          {{ configBusy ? '⏳' : '💾 SALVA CONFIG MOSSE' }}
        </button>

        <!-- Log chiusure classifica -->
        <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }">
          <h3 :style="{ fontFamily: 'Orbitron, monospace', fontSize: '11px', color: 'rgba(245,158,11,0.7)', letterSpacing: '2px', margin: 0 }">CRONOLOGIA CHIUSURE CLASSIFICA</h3>
          <button
            :disabled="loadingLogs"
            :style="{
              padding: '6px 12px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '8px', color: '#f59e0b',
              fontFamily: 'Orbitron, monospace', fontSize: '9px',
              cursor: loadingLogs ? 'not-allowed' : 'pointer',
            }"
            @click="caricaLogs"
          >
            {{ loadingLogs ? '⏳' : '🔄 Carica Log' }}
          </button>
        </div>

        <div
          v-if="logs.length === 0 && !loadingLogs"
          :style="{ fontFamily: 'Orbitron, monospace', fontSize: '10px', color: 'rgba(245,158,11,0.3)', textAlign: 'center', padding: '20px' }"
        >
          Premi "Carica Log" per vedere la cronologia
        </div>

        <div
          v-for="log in (logs as LogEntry[])"
          :key="log.id"
          :style="{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '8px',
          }"
        >
          <div :style="{ fontFamily: 'Orbitron, monospace', fontSize: '10px', color: '#f59e0b', marginBottom: '8px' }">
            {{ logTimestamp(log) }} · {{ log.totalUsersUpdated ?? 0 }} utenti aggiornati
          </div>
          <div
            v-for="(e, i) in (log.top5 ?? [])"
            :key="e.waifuId"
            :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.7)', marginBottom: '4px' }"
          >
            #{{ i + 1 }} <strong>{{ e.nome }}</strong> — {{ e.oldRarita }} → <strong :style="{ color: '#ec4899' }">{{ e.newRarita }}</strong>
            <span v-if="e.skipped"> (saltata)</span>
            <span v-else> · {{ e.likes ?? 0 }} like</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SUB-TAB: TIPI WAIFU                                        -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <template v-else-if="activeTab === 'tipi'">
      <div :style="{ color: '#f5e6d3', maxWidth: '600px' }">
        <h2 :style="{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f59e0b', marginBottom: '8px' }">🌀 Tipi Waifu</h2>
        <p :style="{ fontFamily: 'Orbitron, monospace', fontSize: '10px', color: 'rgba(245,158,11,0.5)', marginBottom: '20px', lineHeight: 1.6 }">
          Ciclo pentagonale. Ogni tipo batte il tipo indicato nel campo "Batte".
        </p>

        <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }">
          <div
            v-for="(t, i) in tipi"
            :key="t.nome"
            :style="{
              display: 'grid',
              gridTemplateColumns: '90px 50px 1fr',
              gap: '12px',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${t.colore}44`,
              borderRadius: '12px',
            }"
          >
            <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '14px', color: t.colore, fontWeight: 700 }">{{ t.nome }}</div>
            <input
              type="color"
              :value="t.colore"
              :style="{ width: '40px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', padding: '2px' }"
              @input="setTipoColore(i, ($event.target as HTMLInputElement).value)"
            />
            <div :style="{ display: 'flex', alignItems: 'center', gap: '8px' }">
              <span :style="{ fontFamily: 'Orbitron, monospace', fontSize: '9px', color: 'rgba(245,158,11,0.6)', whiteSpace: 'nowrap' }">BATTE →</span>
              <select
                :value="t.batte"
                :style="{
                  flex: 1,
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f5e6d3', borderRadius: '8px',
                  padding: '7px 10px',
                  fontFamily: 'Orbitron, monospace', fontSize: '10px',
                }"
                @change="setTipoBatte(i, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="tx in tipi" :key="tx.nome" :value="tx.nome">{{ tx.nome }}</option>
              </select>
            </div>
          </div>
        </div>

        <button
          :disabled="tipiBusy"
          :style="{
            padding: '10px 24px',
            background: tipiBusy ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #ec4899)',
            border: 'none', borderRadius: '10px',
            color: '#000', fontFamily: 'Orbitron, monospace', fontSize: '10px', fontWeight: 700,
            cursor: tipiBusy ? 'not-allowed' : 'pointer',
          }"
          @click="salvaTipiWaifu"
        >
          {{ tipiBusy ? '⏳ Salvataggio…' : '💾 SALVA TIPI WAIFU' }}
        </button>
      </div>
    </template>
  </div>
</template>
