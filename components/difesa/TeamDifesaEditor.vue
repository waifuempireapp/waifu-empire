<template>
  <!-- Editor team difensore: seleziona 5 waifu dalla collezione per difendere un pixel -->
  <div :style="overlayStyle">
    <!-- Header -->
    <div :style="headerStyle">
      <div>
        <div :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.22em', color: C.violet, textTransform: 'uppercase' }">{{ $t("defense.title") }}</div>
        <div :style="{ fontFamily: FF.display, fontSize: '17px', color: '#fff', fontWeight: 800 }">{{ $t("defense.choose_defender") }}</div>
        <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: 'rgba(241,235,255,0.4)', marginTop: '2px' }">
          pixel {{ pixelKey?.replace('_', ', ') }} · {{ selectedIds.length }}/5
        </div>
      </div>
      <button :style="closeBtnStyle" @click="$emit('close')">✕</button>
    </div>

    <!-- Griglia waifu -->
    <div :style="{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }">
      <div :style="gridStyle">
        <div
          v-for="w in ownedWaifu"
          :key="w.id"
          style="position:relative;cursor:pointer"
          @click="toggle(w.id)"
        >
          <div :style="cardOutlineStyle(selectedIds.includes(w.id))">
            <CartaWaifu :waifu="w" :dati-collezione="w._datiColl" dimensione="piccola" :evidenziato="false" />
          </div>
          <div v-if="selectedIds.includes(w.id)" :style="badgeStyle">
            {{ selectedIds.indexOf(w.id) + 1 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div :style="footerStyle">
      <!-- Toggle applica a tutti -->
      <label :style="{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }">
        <div :style="toggleStyle" @click="toggleApplyToAll">
          <div :style="toggleKnobStyle" />
        </div>
        <span :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.7)' }">
          Imposta per tutti i territori
        </span>
      </label>

      <!-- Avviso conferma bulk -->
      <div v-if="confirmBulk" :style="bulkWarningStyle">
        ⚠️ Sovrascrive il team difensore di TUTTI i tuoi pixel. Confermi?
      </div>

      <!-- Risultato o bottone salva -->
      <div v-if="success" :style="successStyle">{{ $t("defense.team_saved") }}</div>
      <button
        v-else
        :disabled="selectedIds.length !== 5 || loading"
        :style="saveBtnStyle"
        @click="save"
      >
        {{ loading ? '…' : confirmBulk ? '⚠️ Conferma e salva' : '⚔ Salva team difensore' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Editor team difesa: salva 5 waifu come difensori del pixel selezionato (o di tutti)
import type { CSSProperties } from 'vue'
const authStore = useAuthStore()

interface WaifuDatiColl {
  [key: string]: unknown
}
interface Waifu {
  id: string
  nome: string
  rarita: string
  [key: string]: unknown
}
interface WaifuCollezione {
  waifu?: Record<string, WaifuDatiColl>
}
interface WaifuCatalog extends Waifu {}

const props = defineProps<{
  pixelKey:    string
  collezione:  WaifuCollezione | null
  waifuCat:    WaifuCatalog[]
  profilo:     Record<string, unknown> | null
  currentTeam: string[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

// Costanti colori e font
const C = {
  gold:   '#f5c560',
  violet: '#a78bfa',
  ok:     '#58e0a3',
  err:    '#ff5b6c',
}
const FF = {
  display: "'Cinzel', serif",
  label:   "'Saira Condensed', sans-serif",
  body:    "'Inter', sans-serif",
  mono:    "'JetBrains Mono', monospace",
}

useScrollLock()

const selectedIds  = ref<string[]>(props.currentTeam?.length === 5 ? [...props.currentTeam] : [])
const applyToAll   = ref(false)
const confirmBulk  = ref(false)
const loading      = ref(false)
const success      = ref(false)

// Waifu possedute dalla collezione arricchite con i dati del catalogo
const ownedWaifu = computed(() =>
  Object.entries(props.collezione?.waifu || {})
    .map(([id, dati]) => {
      const w = props.waifuCat?.find((x: WaifuCatalog) => x.id === id)
      return w ? { ...w, ...dati, _datiColl: dati } : null
    })
    .filter(Boolean) as (WaifuCatalog & { _datiColl: WaifuDatiColl })[]
)

const toggle = (id: string) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(x => x !== id)
  } else if (selectedIds.value.length < 5) {
    selectedIds.value = [...selectedIds.value, id]
  }
}

const toggleApplyToAll = () => {
  applyToAll.value = !applyToAll.value
  confirmBulk.value = false
}

const save = async () => {
  if (selectedIds.value.length !== 5) return
  if (applyToAll.value && !confirmBulk.value) { confirmBulk.value = true; return }

  loading.value = true
  try {
    const token = await authStore.user?.getIdToken()
    let ownedPixels = [props.pixelKey]

    if (applyToAll.value) {
      const defData = await $fetch('/api/difesa', {
        headers: { Authorization: `Bearer ${token}` },
      }) as { defenseMap?: Record<string, unknown> }
      ownedPixels = Object.keys(defData.defenseMap || {})
      if (!ownedPixels.includes(props.pixelKey)) ownedPixels.push(props.pixelKey)
    }

    await $fetch('/api/difesa', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: applyToAll.value
        ? { bulk: true, team: selectedIds.value, ownedPixels }
        : { pixelKey: props.pixelKey, team: selectedIds.value },
    })

    success.value = true
    setTimeout(() => { emit('saved') }, 1200)
  } finally {
    loading.value = false
  }
}

// Stili
const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(3,2,12,0.95)', backdropFilter: 'blur(16px)',
  display: 'flex', flexDirection: 'column',
}
const headerStyle: CSSProperties = {
  padding: '18px 18px 0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
}
const closeBtnStyle: CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)',
  fontSize: '22px', cursor: 'pointer', paddingTop: '4px',
}
const gridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
}
const cardOutlineStyle = (sel: boolean): CSSProperties => ({
  outline: sel ? `3px solid ${C.violet}` : '3px solid transparent',
  borderRadius: '14px', transition: 'outline 0.15s',
  boxShadow: sel ? `0 0 16px ${C.violet}50` : 'none',
})
const badgeStyle: CSSProperties = {
  position: 'absolute', top: '6px', right: '6px', zIndex: 2,
  width: '22px', height: '22px', borderRadius: '50%',
  background: C.violet, color: '#fff',
  display: 'grid', placeItems: 'center',
  fontWeight: 900, fontSize: '12px',
  boxShadow: `0 2px 8px ${C.violet}80`,
}
const footerStyle: CSSProperties = {
  padding: '12px 16px 30px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px',
}
const toggleStyle = computed((): CSSProperties => ({
  width: '40px', height: '22px', borderRadius: '11px',
  background: applyToAll.value ? C.violet : 'rgba(255,255,255,0.1)',
  border: `1px solid ${applyToAll.value ? C.violet : 'rgba(174,156,255,0.2)'}`,
  position: 'relative', transition: 'all 0.2s', cursor: 'pointer', flexShrink: 0,
}))
const toggleKnobStyle = computed((): CSSProperties => ({
  position: 'absolute', top: '2px', left: applyToAll.value ? '20px' : '2px',
  width: '16px', height: '16px', borderRadius: '50%',
  background: '#fff', transition: 'left 0.2s',
}))
const bulkWarningStyle: CSSProperties = {
  background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: '12px', padding: '10px 14px',
  fontFamily: FF.body, fontSize: '12px', color: C.violet,
}
const successStyle: CSSProperties = {
  textAlign: 'center', padding: '14px', color: C.ok,
  fontFamily: FF.label, fontSize: '12px', letterSpacing: '0.18em',
}
const saveBtnStyle = computed((): CSSProperties => ({
  padding: '14px', width: '100%',
  background: selectedIds.value.length === 5 && !loading.value
    ? `linear-gradient(135deg, rgba(107,75,222,0.9), ${C.violet})`
    : 'rgba(255,255,255,0.05)',
  border: 'none', borderRadius: '14px',
  color: selectedIds.value.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
  fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.2em',
  textTransform: 'uppercase', fontWeight: 700,
  cursor: selectedIds.value.length === 5 ? 'pointer' : 'not-allowed',
}))
</script>
