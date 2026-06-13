<!--
  AdminClassificaTab.vue
  Configurazione premi classifica settimanale per fascia di posizione.
  Permette anche azioni manuali: recupero vincitori, chiusura con premi, reset punteggi.
  Usa <KissesIcon /> auto-importato da components/KissesIcon.vue.
-->
<script setup lang="ts">
import {
  getPremiClassificaConfig,
  setPremiClassificaConfig,
  getDefaultPremiClassifica,
} from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'

const emit = defineEmits<{ flash: [t: string, c: string] }>()

const authStore = useAuthStore()
const config     = ref<any>(null)
const loading    = ref(true)
const saving     = ref(false)
const actionBusy = ref<string | null>(null)
const winners    = ref<any[] | null>(null)

const fasce = [
  { key: '1',      label: '🥇 1° posto',       desc: 'Il campione della stagione' },
  { key: '2',      label: '🥈 2° posto',       desc: '' },
  { key: '3',      label: '🥉 3° posto',       desc: '' },
  { key: 'top10',  label: '🏅 Top 10',         desc: 'Posizioni 4–10' },
  { key: 'top100', label: '✦ Top 100',         desc: 'Posizioni 11–100' },
  { key: 'tutti',  label: '◈ Tutti gli altri', desc: 'Posizioni > 100' },
]

onMounted(async () => {
  config.value = await getPremiClassificaConfig()
  loading.value = false
})

function aggiorna(fascia: string, campo: string, valore: string) {
  config.value = {
    ...config.value,
    [fascia]: { ...(config.value[fascia] || {}), [campo]: Number(valore) || 0 },
  }
}

async function salva() {
  saving.value = true
  try {
    await setPremiClassificaConfig(config.value)
    emit('flash', '✅ Premi classifica salvati!', '')
  } catch (e: any) {
    emit('flash', '❌ Errore: ' + e.message, '#ff4d4d')
  } finally {
    saving.value = false
  }
}

function ripristina() {
  config.value = getDefaultPremiClassifica()
}

async function azioneClassifica(action: 'winners' | 'close' | 'reset') {
  if (action === 'close' && !confirm('Assegna premi e azzera classifica? Operazione irreversibile.')) return
  if (action === 'reset' && !confirm('Reset punteggi settimanali SENZA assegnare premi. Continuare?')) return

  actionBusy.value = action
  if (action === 'winners') winners.value = null

  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/admin/territory-ranking', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { action },
    })) as any
    if (data.success) {
      if (action === 'winners') {
        winners.value = data.winners
        emit('flash', `✅ Classifica caricata: ${data.total} giocatori`, '')
      } else if (action === 'close') {
        emit('flash', `✅ Premi assegnati a ${data.assegnati} giocatori, ${data.azzerati} punteggi azzerati`, '')
      } else {
        emit('flash', `✅ ${data.azzerati} punteggi azzerati`, '')
      }
    } else {
      emit('flash', '❌ ' + data.error, '#ff4d4d')
    }
  } catch (e: any) {
    emit('flash', '❌ ' + e.message, '#ff4d4d')
  }
  actionBusy.value = null
}

// Stili input numero tabella
const numInputStyle = {
  padding: '6px 8px',
  textAlign: 'center' as const,
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.25)',
  borderRadius: '8px',
  color: '#f5e6d3',
  fontFamily: 'Orbitron',
  fontSize: '12px',
  outline: 'none',
}
</script>

<template>
  <AppLoading v-if="loading" />

  <div v-else :style="{ padding: '20px', maxWidth: '700px', margin: '0 auto' }">
    <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f5a623', marginBottom: '6px' }">
      🏆 Premi Classifica Settimanale
    </div>
    <div :style="{ fontSize: '11px', color: 'rgba(245,230,211,0.5)', fontFamily: 'Orbitron', marginBottom: '20px', lineHeight: '1.6' }">
      Configura i premi assegnati automaticamente ogni lunedì alle 01:00 in base alla posizione in classifica.<br />
      I premi sono cumulativi: un giocatore in 1° posto riceve solo la fascia "1° posto", non anche le fasce inferiori.
    </div>

    <!-- Tabella configurazione -->
    <div :style="{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(245,158,11,0.2)' }">
      <!-- Header -->
      <div :style="{
        display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px',
        padding: '10px 16px',
        background: 'rgba(245,158,11,0.08)',
        borderBottom: '1px solid rgba(245,158,11,0.15)',
        fontFamily: 'Orbitron', fontSize: '9px', color: '#f5a623', letterSpacing: '1.5px',
      }">
        <div>FASCIA</div>
        <div :style="{ textAlign: 'center' }">⚡ ENERGIA</div>
        <div :style="{ textAlign: 'center' }">🎴 BUSTINE SFIDA</div>
        <div :style="{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }">
          <KissesIcon :size="14" /> KISSES
        </div>
      </div>

      <!-- Righe -->
      <div
        v-for="({ key, label, desc }, i) in fasce"
        :key="key"
        :style="{
          display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px',
          padding: '12px 16px', alignItems: 'center',
          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
          borderBottom: i < fasce.length - 1 ? '1px solid rgba(245,158,11,0.08)' : 'none',
        }"
      >
        <div>
          <div :style="{ fontFamily: 'Orbitron', fontSize: '11px', color: '#f5e6d3', fontWeight: '700' }">{{ label }}</div>
          <div v-if="desc" :style="{ fontSize: '9px', color: 'rgba(245,230,211,0.35)', marginTop: '2px' }">{{ desc }}</div>
        </div>
        <!-- Energia -->
        <div :style="{ display: 'flex', justifyContent: 'center' }">
          <input
            type="number" min="0" max="99"
            :value="config?.[key]?.energia ?? 0"
            :style="{ ...numInputStyle, width: '64px' }"
            @change="aggiorna(key, 'energia', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <!-- Bustine Sfida -->
        <div :style="{ display: 'flex', justifyContent: 'center' }">
          <input
            type="number" min="0" max="999"
            :value="config?.[key]?.bustineSfida ?? 0"
            :style="{ ...numInputStyle, width: '64px' }"
            @change="aggiorna(key, 'bustineSfida', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <!-- Kisses -->
        <div :style="{ display: 'flex', justifyContent: 'center' }">
          <input
            type="number" min="0" max="99999"
            :value="config?.[key]?.kisses ?? 0"
            :style="{ ...numInputStyle, width: '80px' }"
            @change="aggiorna(key, 'kisses', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <!-- Bottoni salva/ripristina -->
    <div :style="{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }">
      <button
        :style="{
          padding: '10px 20px', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px',
          color: 'rgba(245,230,211,0.6)', fontFamily: 'Orbitron', fontSize: '10px', cursor: 'pointer',
        }"
        @click="ripristina"
      >
        ↩ Ripristina default
      </button>
      <button
        :disabled="saving"
        :style="{
          padding: '10px 24px',
          background: saving ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #ec4899)',
          border: 'none', borderRadius: '10px',
          color: '#000', fontFamily: 'Orbitron', fontSize: '10px', fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer',
        }"
        @click="salva"
      >
        {{ saving ? '⏳ Salvataggio…' : '💾 SALVA PREMI' }}
      </button>
    </div>

    <!-- Info cron -->
    <div :style="{
      marginTop: '24px', padding: '12px 16px',
      background: 'rgba(108,240,224,0.04)', border: '1px solid rgba(108,240,224,0.12)',
      borderRadius: '10px', fontSize: '10px', color: 'rgba(108,240,224,0.5)',
      fontFamily: 'Orbitron', lineHeight: '1.8',
    }">
      ⏰ Reset automatico: ogni <strong :style="{ color: 'rgba(108,240,224,0.7)' }">lunedì alle 01:00 UTC</strong> via Vercel Cron Job.
    </div>

    <!-- Azioni manuali classifica -->
    <div :style="{ marginTop: '32px', padding: '20px', background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: '12px' }">
      <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '15px', color: '#ec4899', marginBottom: '16px' }">
        ⚡ Azioni Manuali Classifica Territori
      </div>
      <div :style="{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }">
        <!-- Recupera vincitori -->
        <button
          :disabled="!!actionBusy"
          :style="{
            padding: '10px 18px',
            background: actionBusy === 'winners' ? 'rgba(108,240,224,0.2)' : 'rgba(108,240,224,0.1)',
            border: '1px solid rgba(108,240,224,0.3)', borderRadius: '8px',
            color: '#6cf0e0', fontFamily: 'Orbitron', fontSize: '10px', cursor: 'pointer',
          }"
          @click="azioneClassifica('winners')"
        >
          {{ actionBusy === 'winners' ? '⏳…' : '👁 Recupera Vincitori' }}
        </button>

        <!-- Chiudi e premia -->
        <button
          :disabled="!!actionBusy"
          :style="{
            padding: '10px 18px',
            background: actionBusy === 'close' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px',
            color: '#f59e0b', fontFamily: 'Orbitron', fontSize: '10px', cursor: 'pointer',
          }"
          @click="azioneClassifica('close')"
        >
          {{ actionBusy === 'close' ? '⏳…' : '🏆 Chiudi e Assegna Premi' }}
        </button>

        <!-- Reset senza premi -->
        <button
          :disabled="!!actionBusy"
          :style="{
            padding: '10px 18px',
            background: actionBusy === 'reset' ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
            color: '#ef4444', fontFamily: 'Orbitron', fontSize: '10px', cursor: 'pointer',
          }"
          @click="azioneClassifica('reset')"
        >
          {{ actionBusy === 'reset' ? '⏳…' : '🔄 Reset Senza Premi' }}
        </button>
      </div>

      <!-- Tabella vincitori -->
      <div v-if="winners && winners.length > 0" :style="{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'hidden' }">
        <div :style="{ fontFamily: 'Orbitron', fontSize: '9px', color: 'rgba(245,230,211,0.6)', padding: '8px 12px', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.06)' }">
          TOP 10 VINCITORI ATTUALI
        </div>
        <div
          v-for="(w, i) in winners"
          :key="w.uid"
          :style="{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
            borderBottom: i < winners.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            background: i < 3 ? 'rgba(245,197,96,0.04)' : 'transparent',
          }"
        >
          <div :style="{
            width: '24px', textAlign: 'center', fontFamily: 'Orbitron', fontSize: '11px',
            color: i === 0 ? '#ffc861' : i === 1 ? '#b0bec5' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)',
          }">{{ i + 1 }}</div>
          <div :style="{ width: '10px', height: '10px', borderRadius: '50%', background: w.coloreImpero ?? '#888', flexShrink: 0 }" />
          <div :style="{ flex: 1, fontFamily: 'Orbitron', fontSize: '10px', color: '#f5e6d3' }">{{ w.nomeImpero }}</div>
          <div :style="{ fontFamily: 'Orbitron', fontSize: '9px', color: 'rgba(108,240,224,0.7)' }">{{ w.pixelCount }} px</div>
          <div :style="{ fontFamily: 'Orbitron', fontSize: '8px', color: 'rgba(245,158,11,0.7)', textAlign: 'right' }">
            <span v-if="w.prize?.energia > 0">⚡{{ w.prize.energia }} </span>
            <span v-if="w.prize?.bustineSfida > 0">🎴{{ w.prize.bustineSfida }} </span>
            <span v-if="w.prize?.kisses > 0">💎{{ w.prize.kisses }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
