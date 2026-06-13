<!--
  AdminSwapTab.vue
  Configurazione del sistema Swap: soglie reward, kisses passivi, premi classifica
  settimanale e pannello chiusura classifica con upgrade rarità waifu.
-->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const emit = defineEmits<{ flash: [t: string, c: string] }>()

const authStore = useAuthStore()

// ── State ────────────────────────────────────────────────────────────────────
const config = ref({
  rewardThreshold: 10,
  rewardKisses: 50,
  adInterval: 10,
  passiveKissesRate: 1,
  weeklyPrizes: [500, 300, 200, 100, 50] as number[],
})
const loading  = ref(true)
const saving   = ref(false)

// Chiudi classifica panel
const closeBusy        = ref(false)
const closeResult      = ref<any>(null)
const showCloseConfirm = ref(false)

// ── Caricamento ──────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const cfgRes = await ($fetch('/api/swap/config', {
      headers: { Authorization: `Bearer ${token}` },
    })) as any
    config.value = {
      rewardThreshold:  cfgRes.rewardThreshold  ?? 10,
      rewardKisses:     cfgRes.rewardKisses      ?? 50,
      adInterval:       cfgRes.adInterval        ?? 10,
      passiveKissesRate: cfgRes.passiveKissesRate ?? 1,
      weeklyPrizes:     cfgRes.weeklyPrizes       ?? [500, 300, 200, 100, 50],
    }
  } finally {
    loading.value = false
  }
})

// ── Salvataggio config ───────────────────────────────────────────────────────
async function salva() {
  saving.value = true
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/admin/swap-config', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: config.value,
    })
    emit('flash', '✅ Configurazione Swap salvata', '')
  } catch {
    emit('flash', '❌ Errore salvataggio', '#ff4d4d')
  } finally {
    saving.value = false
  }
}

function setWeeklyPrize(index: number, value: number) {
  const prizes = [...config.value.weeklyPrizes]
  prizes[index] = value
  config.value = { ...config.value, weeklyPrizes: prizes }
}

// ── Chiudi classifica ────────────────────────────────────────────────────────
async function eseguiChiusura() {
  closeBusy.value = true
  showCloseConfirm.value = false
  closeResult.value = null
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/admin/close-swap-ranking', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })) as any
    closeResult.value = data
    if (data.success) {
      emit('flash', `✅ Classifica chiusa! ${data.totalUsersUpdated} utenti aggiornati`, '')
    } else {
      emit('flash', `❌ ${data.message || data.error}`, '#ff4d4d')
    }
  } catch (e: any) {
    emit('flash', `❌ Errore: ${e.message}`, '#ff4d4d')
  } finally {
    closeBusy.value = false
  }
}

// ── Stile campo numerico ──────────────────────────────────────────────────────
const fieldInputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid rgba(245,158,11,0.3)',
  color: '#f5e6d3',
  borderRadius: '8px',
  padding: '8px 12px',
  fontFamily: 'Orbitron',
  fontSize: '12px',
}
const fieldLabelStyle = {
  display: 'block',
  fontFamily: 'Orbitron',
  fontSize: '10px',
  color: 'rgba(245,158,11,0.8)',
  marginBottom: '6px',
  letterSpacing: '1px',
}
const boxStyle = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: '14px',
  padding: '20px 24px',
  marginBottom: '24px',
}
const boxTitleStyle = {
  fontFamily: 'Orbitron',
  fontSize: '12px',
  color: 'rgba(245,158,11,0.7)',
  marginBottom: '20px',
  letterSpacing: '2px',
}
</script>

<template>
  <AppLoading v-if="loading" />

  <div v-else :style="{ color: '#f5e6d3', maxWidth: '600px' }">
    <h2 :style="{ fontFamily: 'Cinzel', fontSize: '18px', color: '#f59e0b', marginBottom: '24px' }">
      💋 Gestione Swap
    </h2>

    <!-- Configurazione reward -->
    <div :style="boxStyle">
      <h3 :style="boxTitleStyle">CONFIGURAZIONE REWARD</h3>

      <div v-for="item in [
        { label: 'Voti per reward (N)',         key: 'rewardThreshold' },
        { label: 'Kisses per reward (X)',        key: 'rewardKisses' },
        { label: 'Swipe tra annunci (M)',        key: 'adInterval' },
        { label: 'Kisses passivi per pixel/ora', key: 'passiveKissesRate' },
      ]" :key="item.key" :style="{ marginBottom: '16px' }">
        <label :style="fieldLabelStyle">{{ item.label }}</label>
        <input
          type="number"
          min="1"
          :value="(config as any)[item.key] ?? ''"
          :style="fieldInputStyle"
          @change="(config as any)[item.key] = Number(($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Premi classifica settimanale -->
      <div :style="{ marginBottom: '16px' }">
        <label :style="fieldLabelStyle">Premi classifica settimanale (#1 → #5)</label>
        <div :style="{ display: 'flex', gap: '8px' }">
          <input
            v-for="(v, i) in (config.weeklyPrizes || [500, 300, 200, 100, 50])"
            :key="i"
            type="number"
            min="0"
            :value="v"
            :style="{
              flex: '1',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#f5e6d3',
              borderRadius: '8px',
              padding: '8px 6px',
              fontFamily: 'Orbitron',
              fontSize: '11px',
              textAlign: 'center',
            }"
            @change="setWeeklyPrize(i, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

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
        {{ saving ? '⏳ Salvataggio…' : '💾 SALVA CONFIGURAZIONE' }}
      </button>
    </div>

    <!-- Dashboard voti -->
    <div :style="boxStyle">
      <h3 :style="boxTitleStyle">DASHBOARD VOTI SWAP</h3>
      <p :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: 'rgba(245,158,11,0.5)', lineHeight: '1.6' }">
        La dashboard voti in tempo reale richiede una query aggregata su /swap_votes.<br />
        Consulta Firestore direttamente o usa il cron settimanale per vedere la classifica corrente via
        <code>/api/waifu-ranking/current</code>.
      </p>
    </div>

    <!-- Pannello chiusura classifica -->
    <div :style="{
      background: 'rgba(236,72,153,0.05)',
      border: '1px solid rgba(236,72,153,0.3)',
      borderRadius: '14px',
      padding: '20px 24px',
    }">
      <h3 :style="{ fontFamily: 'Orbitron', fontSize: '12px', color: '#ec4899', marginBottom: '12px', letterSpacing: '2px' }">
        🏆 CHIUDI CLASSIFICA &amp; UPGRADE RARITÀ
      </h3>
      <p :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: 'rgba(245,158,11,0.6)', lineHeight: '1.6', marginBottom: '16px' }">
        Le top 5 waifu per voti salgono di rarità. I voti vengono azzerati. Operazione irreversibile.
      </p>

      <!-- Bottone iniziale -->
      <button
        v-if="!showCloseConfirm"
        :disabled="closeBusy"
        :style="{
          padding: '10px 24px',
          background: 'linear-gradient(135deg, #ec4899, #f59e0b)',
          border: 'none', borderRadius: '10px',
          color: '#000', fontFamily: 'Orbitron', fontSize: '10px', fontWeight: '700',
          cursor: closeBusy ? 'not-allowed' : 'pointer',
        }"
        @click="showCloseConfirm = true"
      >
        {{ closeBusy ? '⏳ Operazione in corso…' : '⚡ CHIUDI CLASSIFICA' }}
      </button>

      <!-- Conferma -->
      <div v-if="showCloseConfirm" :style="{ display: 'flex', gap: '12px', alignItems: 'center' }">
        <span :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: '#ec4899' }">
          Sei sicuro? Quest'azione è irreversibile.
        </span>
        <button
          :style="{
            padding: '8px 18px', background: '#ec4899', border: 'none',
            borderRadius: '8px', color: '#000', fontFamily: 'Orbitron', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
          }"
          @click="eseguiChiusura"
        >
          ✅ CONFERMA
        </button>
        <button
          :style="{
            padding: '8px 14px', background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px',
            color: '#f5e6d3', fontFamily: 'Orbitron', fontSize: '10px', cursor: 'pointer',
          }"
          @click="showCloseConfirm = false"
        >
          Annulla
        </button>
      </div>

      <!-- Risultato -->
      <div
        v-if="closeResult"
        :style="{
          marginTop: '16px', padding: '10px 14px',
          background: closeResult.success ? 'rgba(0,200,118,0.1)' : 'rgba(255,61,61,0.1)',
          borderRadius: '10px',
        }"
      >
        <div :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: closeResult.success ? '#00e676' : '#ff4d4d', marginBottom: '8px' }">
          {{ closeResult.success
            ? `✅ Completato — ${closeResult.totalUsersUpdated} utenti aggiornati`
            : `❌ ${closeResult.message || closeResult.error}` }}
        </div>
        <div
          v-for="(e, i) in (closeResult.top5 || [])"
          :key="e.waifuId"
          :style="{ fontFamily: 'Orbitron', fontSize: '9px', color: 'rgba(245,158,11,0.8)', marginBottom: '4px' }"
        >
          #{{ i + 1 }} {{ e.nome }} — {{ e.oldRarita }} → {{ e.newRarita }}
          {{ e.skipped ? '(saltata)' : `(${e.likes} like)` }}
        </div>
      </div>
    </div>
  </div>
</template>
