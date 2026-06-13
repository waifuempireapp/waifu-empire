<!--
  AdminMissioniTab.vue
  Gestione missioni: sezioni e singole missioni con CRUD completo.
  Le sezioni sono documenti Firestore; ogni sezione contiene un array di missioni.
  Un modal a schermo intero permette di creare o modificare una missione.
-->
<script setup lang="ts">
import {
  getMissioniSezioni,
  upsertMissioneSezione,
  upsertMissione,
  deleteMissione,
  deleteMissioneSezione,
} from '~/utils/firestoreService'

const emit = defineEmits<{ flash: [t: string, c: string] }>()

// ── Costanti ────────────────────────────────────────────────────────────────
const TIPI_EVENTO = [
  { v: 'login',                l: '🏠 Accedi al gioco' },
  { v: 'apri_bustina',         l: '🎁 Apri una bustina' },
  { v: 'conquista_territorio', l: '🗺 Conquista un territorio' },
  { v: 'vinci_battaglia',      l: '⚔ Vinci una battaglia' },
  { v: 'pesca_carta',          l: '🎣 Pesca una carta' },
  { v: 'aggiungi_amico',       l: '♥ Aggiungi un amico' },
  { v: 'completa_drop',        l: '💎 Completa collezione drop' },
  { v: 'manuale',              l: '✦ Manuale (utente segna)' },
]
const TIPI_REWARD = ['kisses', 'pack', 'pose']

const missVuota = () => ({
  titolo: '', descrizione: '', tipoEvento: 'apri_bustina',
  target: 1, reward: { tipo: 'kisses', qty: 50 }, ordine: 0, attivo: true,
})
const secVuota = () => ({ nome: '', ordine: 0, attivo: true })

// ── State ────────────────────────────────────────────────────────────────────
const sezioni = ref<any[]>([])
const loading = ref(true)
const busy    = ref(false)
const sezioneEdit  = ref<any>(null)
const missioneEdit = ref<any>(null)

// ── Stili condivisi ──────────────────────────────────────────────────────────
const cssSec = {
  background: 'rgba(245,158,11,0.06)',
  border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: '12px', padding: '14px 16px', marginBottom: '10px',
}
const cssSecHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px',
}
const cssMiss = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(174,156,255,0.15)',
  borderRadius: '8px', padding: '10px 12px', marginBottom: '6px',
}
const cssInput = {
  background: 'var(--surface)', border: '1px solid rgba(174,156,255,0.2)',
  color: '#f1ebff', padding: '6px 10px', borderRadius: '8px', fontFamily: 'inherit',
  fontSize: '12px', width: '100%',
}

function cssBtn(col = '#f59e0b') {
  const rgb = col === '#f59e0b' ? '245,158,11' : col === '#ef4444' ? '239,68,68' : '167,139,250'
  return {
    background: `rgba(${rgb},0.15)`,
    border: `1px solid ${col}55`,
    color: col,
    borderRadius: '8px',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: '11px',
    fontFamily: 'Cinzel, serif',
  }
}

// ── Funzioni ─────────────────────────────────────────────────────────────────
async function ricarica() {
  loading.value = true
  try { sezioni.value = await getMissioniSezioni() } catch (_) {}
  loading.value = false
}

onMounted(ricarica)

async function salvaSez() {
  if (!sezioneEdit.value?.nome?.trim()) return
  busy.value = true
  try {
    await upsertMissioneSezione(sezioneEdit.value.id || null, {
      nome: sezioneEdit.value.nome,
      ordine: Number(sezioneEdit.value.ordine) || 0,
      attivo: sezioneEdit.value.attivo !== false,
    })
    emit('flash', 'Sezione salvata', '')
    sezioneEdit.value = null
    await ricarica()
  } catch (e: any) {
    emit('flash', 'Errore: ' + e.message, '#ef4444')
  }
  busy.value = false
}

async function eliminaSez(id: string) {
  if (!confirm('Eliminare questa sezione e tutte le sue missioni?')) return
  busy.value = true
  try {
    await deleteMissioneSezione(id)
    emit('flash', 'Sezione eliminata', '')
    await ricarica()
  } catch (e: any) {
    emit('flash', 'Errore: ' + e.message, '#ef4444')
  }
  busy.value = false
}

async function salvaMiss() {
  if (!missioneEdit.value?.titolo?.trim()) return
  busy.value = true
  try {
    const { secId, id, ...data } = missioneEdit.value
    data.target = Number(data.target) || 1
    data.ordine = Number(data.ordine) || 0
    data.reward = { tipo: data.reward?.tipo || 'kisses', qty: Number(data.reward?.qty) || 0 }
    data.attivo = data.attivo !== false
    await upsertMissione(secId, id || null, data)
    emit('flash', 'Missione salvata', '')
    missioneEdit.value = null
    await ricarica()
  } catch (e: any) {
    emit('flash', 'Errore: ' + e.message, '#ef4444')
  }
  busy.value = false
}

async function eliminaMiss(secId: string, mId: string) {
  if (!confirm('Eliminare questa missione?')) return
  busy.value = true
  try {
    await deleteMissione(secId, mId)
    emit('flash', 'Missione eliminata', '')
    await ricarica()
  } catch (e: any) {
    emit('flash', 'Errore: ' + e.message, '#ef4444')
  }
  busy.value = false
}

function tipoEventoLabel(v: string) {
  return TIPI_EVENTO.find(t => t.v === v)?.l || v
}
</script>

<template>
  <AppLoading v-if="loading" />

  <div v-else>
    <!-- Intestazione -->
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }">
      <h2 :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: '16px' }">🎯 Gestione Missioni</h2>
      <button :style="cssBtn()" @click="sezioneEdit = secVuota()">+ Nuova Sezione</button>
    </div>

    <!-- Form sezione -->
    <div
      v-if="sezioneEdit"
      :style="{ ...cssSec, borderColor: 'rgba(245,158,11,0.5)', marginBottom: '16px' }"
    >
      <div :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: '12px', marginBottom: '10px' }">
        {{ sezioneEdit.id ? 'Modifica sezione' : 'Nuova sezione' }}
      </div>
      <div :style="{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'end' }">
        <div>
          <div :style="{ fontSize: '10px', opacity: '0.6', marginBottom: '3px' }">NOME SEZIONE</div>
          <input
            v-model="sezioneEdit.nome"
            :style="cssInput"
          />
        </div>
        <div>
          <div :style="{ fontSize: '10px', opacity: '0.6', marginBottom: '3px' }">ORDINE</div>
          <input
            v-model.number="sezioneEdit.ordine"
            type="number"
            :style="{ ...cssInput, width: '60px' }"
          />
        </div>
        <label :style="{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }">
          <input
            v-model="sezioneEdit.attivo"
            type="checkbox"
          />
          Attiva
        </label>
      </div>
      <div :style="{ display: 'flex', gap: '8px', marginTop: '10px' }">
        <button :style="cssBtn()" :disabled="busy" @click="salvaSez">💾 Salva</button>
        <button :style="cssBtn('#a78bfa')" @click="sezioneEdit = null">Annulla</button>
      </div>
    </div>

    <!-- Nessuna sezione -->
    <div
      v-if="sezioni.length === 0"
      :style="{ textAlign: 'center', padding: '40px', opacity: '0.4', fontSize: '13px' }"
    >
      Nessuna sezione. Le Giornaliere sono hardcoded nell'app.
    </div>

    <!-- Lista sezioni -->
    <div v-for="sec in sezioni" :key="sec.id" :style="cssSec">
      <div :style="cssSecHeader">
        <div>
          <span :style="{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: '13px' }">{{ sec.nome }}</span>
          <span v-if="!sec.attivo" :style="{ marginLeft: '8px', fontSize: '10px', opacity: '0.5' }">(inattiva)</span>
        </div>
        <div :style="{ display: 'flex', gap: '6px' }">
          <button :style="cssBtn()" @click="sezioneEdit = { ...sec }">✏</button>
          <button :style="cssBtn('#ef4444')" @click="eliminaSez(sec.id)">🗑</button>
        </div>
      </div>

      <!-- Missioni della sezione -->
      <div v-for="m in (sec.missioni || [])" :key="m.id" :style="cssMiss">
        <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }">
          <div :style="{ flex: 1 }">
            <div :style="{ fontSize: '13px', color: '#f1ebff', fontWeight: '600' }">{{ m.titolo }}</div>
            <div v-if="m.descrizione" :style="{ fontSize: '11px', opacity: '0.55', marginTop: '2px' }">{{ m.descrizione }}</div>
            <div :style="{ fontSize: '10px', opacity: '0.5', marginTop: '4px' }">
              {{ tipoEventoLabel(m.tipoEvento) }} · Target: {{ m.target }} · {{ m.reward?.qty }} {{ m.reward?.tipo }}
            </div>
          </div>
          <div :style="{ display: 'flex', gap: '4px', flexShrink: 0 }">
            <button :style="cssBtn()" @click="missioneEdit = { secId: sec.id, ...m }">✏</button>
            <button :style="cssBtn('#ef4444')" @click="eliminaMiss(sec.id, m.id)">🗑</button>
          </div>
        </div>
      </div>

      <button
        :style="{ ...cssBtn('#a78bfa'), marginTop: '6px' }"
        @click="missioneEdit = { secId: sec.id, ...missVuota() }"
      >
        + Aggiungi missione
      </button>
    </div>

    <!-- Modal missione -->
    <div
      v-if="missioneEdit"
      :style="{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: '16px',
      }"
      @click.self="missioneEdit = null"
    >
      <div :style="{
        background: '#0d0a26', border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: '16px', padding: '20px', maxWidth: '480px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }">
        <div :style="{ fontFamily: 'Cinzel, serif', color: '#a78bfa', fontSize: '14px', marginBottom: '14px' }">
          {{ missioneEdit.id ? 'Modifica missione' : 'Nuova missione' }}
        </div>

        <div
          v-for="f in [
            { label: 'TITOLO', key: 'titolo', type: 'text' },
            { label: 'DESCRIZIONE', key: 'descrizione', type: 'text' },
            { label: 'TARGET (numero)', key: 'target', type: 'number' },
            { label: 'ORDINE', key: 'ordine', type: 'number' },
          ]"
          :key="f.key"
          :style="{ marginBottom: '10px' }"
        >
          <div :style="{ fontSize: '10px', opacity: '0.6', marginBottom: '3px' }">{{ f.label }}</div>
          <input
            :type="f.type"
            v-model="missioneEdit[f.key]"
            :style="cssInput"
          />
        </div>

        <!-- Tipo evento -->
        <div :style="{ marginBottom: '10px' }">
          <div :style="{ fontSize: '10px', opacity: '0.6', marginBottom: '3px' }">TIPO EVENTO</div>
          <select v-model="missioneEdit.tipoEvento" :style="cssInput">
            <option v-for="t in TIPI_EVENTO" :key="t.v" :value="t.v">{{ t.l }}</option>
          </select>
        </div>

        <!-- Reward -->
        <div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }">
          <div>
            <div :style="{ fontSize: '10px', opacity: '0.6', marginBottom: '3px' }">TIPO REWARD</div>
            <select
              :value="missioneEdit.reward?.tipo || 'kisses'"
              :style="cssInput"
              @change="missioneEdit.reward = { ...(missioneEdit.reward || {}), tipo: ($event.target as HTMLSelectElement).value }"
            >
              <option v-for="t in TIPI_REWARD" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <div :style="{ fontSize: '10px', opacity: '0.6', marginBottom: '3px' }">QUANTITÀ</div>
            <input
              type="number"
              :value="missioneEdit.reward?.qty ?? 0"
              :style="cssInput"
              @change="missioneEdit.reward = { ...(missioneEdit.reward || {}), qty: Number(($event.target as HTMLInputElement).value) }"
            />
          </div>
        </div>

        <!-- Attivo -->
        <label :style="{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '14px' }">
          <input v-model="missioneEdit.attivo" type="checkbox" />
          Missione attiva
        </label>

        <div :style="{ display: 'flex', gap: '8px' }">
          <button :style="cssBtn()" :disabled="busy" @click="salvaMiss">💾 Salva</button>
          <button :style="cssBtn('#a78bfa')" @click="missioneEdit = null">Annulla</button>
        </div>
      </div>
    </div>
  </div>
</template>
