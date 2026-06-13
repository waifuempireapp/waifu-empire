<!--
  AdminPrezziTab.vue
  Gestione prezzi in-app: pacchetti Kisses (PayPal), Pass, beni con Kisses.
  Carica la configurazione da Firestore tramite firestoreService e invalida
  la cache server-side dopo il salvataggio.
-->
<script setup lang="ts">
import { getPrezziConfig, setPrezziConfig } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'

const emit = defineEmits<{ flash: [t: string, c: string] }>()

const authStore = useAuthStore()
const prezzi = ref<any>(null)
const busy = ref(false)

onMounted(async () => {
  prezzi.value = await getPrezziConfig()
})

function aggiorna(path: string, value: any) {
  const keys = path.split('.')
  const next = JSON.parse(JSON.stringify(prezzi.value))
  let cur = next
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]]
  cur[keys[keys.length - 1]] = value
  prezzi.value = next
}

async function salva() {
  busy.value = true
  try {
    await setPrezziConfig(prezzi.value)
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/admin/clear-prezzi-cache', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    emit('flash', 'Prezzi salvati!', '')
  } catch (e: any) {
    emit('flash', 'Errore: ' + e.message, '#ff4d4d')
  } finally {
    busy.value = false
  }
}

const inputStyle = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: '6px',
  color: '#f5e6d3',
  fontFamily: 'Orbitron',
  fontSize: '11px',
  padding: '5px 8px',
  width: '90px',
}
const inputStyleWide = { ...inputStyle, width: '130px' }
const labelStyle = {
  fontFamily: 'Orbitron',
  fontSize: '9px',
  color: 'rgba(238,232,220,0.5)',
  letterSpacing: '1px',
  marginBottom: '3px',
}
const sectionStyle = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(245,158,11,0.15)',
  borderRadius: '12px',
  padding: '16px 18px',
  marginBottom: '14px',
}
</script>

<template>
  <AppLoading v-if="!prezzi" />

  <div v-else :style="{ maxWidth: '600px' }">
    <div :style="{ fontFamily: 'Orbitron', fontSize: '14px', color: '#f5a623', marginBottom: '16px', fontWeight: '700' }">
      💰 GESTIONE PREZZI
    </div>

    <!-- Tagli Kisses -->
    <div :style="sectionStyle">
      <div :style="{ fontFamily: 'Orbitron', fontSize: '11px', color: '#f5a623', marginBottom: '12px', fontWeight: '700' }">
        Pacchetti Kisses (PayPal)
      </div>
      <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px' }">
        <div
          v-for="(t, id) in prezzi.tagli_kisses"
          :key="id"
          :style="{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }"
        >
          <span :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: '#eedcd4', width: '20px', textAlign: 'right' }">
            {{ String(id).toUpperCase() }}
          </span>
          <div>
            <div :style="labelStyle">Kisses</div>
            <input
              type="number"
              :value="t.kisses"
              :style="inputStyle"
              @change="aggiorna(`tagli_kisses.${id}.kisses`, Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div>
            <div :style="labelStyle">Bonus Kisses</div>
            <input
              type="number"
              :value="t.bonus ?? 0"
              :style="inputStyle"
              @change="aggiorna(`tagli_kisses.${id}.bonus`, Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div>
            <div :style="labelStyle">€ EUR</div>
            <input
              type="text"
              :value="t.price_eur"
              :style="inputStyle"
              @change="aggiorna(`tagli_kisses.${id}.price_eur`, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <div :style="labelStyle">Label</div>
            <input
              type="text"
              :value="t.label || ''"
              :style="inputStyleWide"
              @change="aggiorna(`tagli_kisses.${id}.label`, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Pass -->
    <div :style="sectionStyle">
      <div :style="{ fontFamily: 'Orbitron', fontSize: '11px', color: '#f5a623', marginBottom: '12px', fontWeight: '700' }">
        Pass (una tantum + abbonamenti)
      </div>
      <div
        v-for="item in [{ id: 'pass_hard', label: '🔞 Hard Pass' }, { id: 'pass_scambi', label: '🔓 Trade Pass' }]"
        :key="item.id"
        :style="{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }"
      >
        <span :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: '#eedcd4', width: '110px' }">{{ item.label }}</span>
        <div>
          <div :style="labelStyle">Kisses</div>
          <input
            type="number"
            :value="prezzi[item.id]?.kisses || 0"
            :style="inputStyle"
            @change="aggiorna(`${item.id}.kisses`, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div>
          <div :style="labelStyle">€ EUR</div>
          <input
            type="text"
            :value="prezzi[item.id]?.price_eur || ''"
            :style="inputStyle"
            @change="aggiorna(`${item.id}.price_eur`, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <!-- Swap Pass mensile -->
      <div :style="{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(236,72,153,0.2)' }">
        <span :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: '#ec4899', width: '110px' }">💋 Swap Pass /mese</span>
        <div>
          <div :style="labelStyle">€ EUR/mese</div>
          <input
            type="number"
            step="0.01"
            :value="prezzi.swap_pass ?? 2.99"
            :style="inputStyle"
            @change="aggiorna('swap_pass', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </div>

    <!-- Beni Kisses -->
    <div :style="sectionStyle">
      <div :style="{ fontFamily: 'Orbitron', fontSize: '11px', color: '#f5a623', marginBottom: '12px', fontWeight: '700' }">
        Beni con Kisses
      </div>
      <div
        v-for="item in [
          { id: 'pack_sfida', label: '🎁 Pack Sfida (1x)' },
          { id: 'pack_sfida_10', label: '🎁🎁 Pack Sfida (10x)' },
          { id: 'energia', label: '⚡ Energia' },
        ]"
        :key="item.id"
        :style="{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }"
      >
        <span :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: '#eedcd4', width: '110px' }">{{ item.label }}</span>
        <div>
          <div :style="labelStyle">Kisses</div>
          <input
            type="number"
            :value="prezzi.beni?.[item.id]?.kisses || 0"
            :style="inputStyle"
            @change="aggiorna(`beni.${item.id}.kisses`, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </div>

    <button
      :disabled="busy"
      :style="{
        background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
        border: 'none',
        borderRadius: '10px',
        color: '#000',
        fontFamily: 'Orbitron',
        fontSize: '11px',
        padding: '10px 28px',
        cursor: busy ? 'wait' : 'pointer',
        fontWeight: '700',
      }"
      @click="salva"
    >
      {{ busy ? 'Salvataggio…' : '💾 SALVA PREZZI' }}
    </button>
  </div>
</template>
