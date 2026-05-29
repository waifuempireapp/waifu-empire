<!--
  AdminMappaTab.vue
  Strumento di debug per la mappa: esegue il cleanup delle battaglie bloccate
  in stato "in_progress" marcandole come "defender_wins".
-->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const emit = defineEmits<{ flash: [t: string, c: string] }>()

const authStore = useAuthStore()
const loading = ref(false)
const result  = ref<any>(null)
const hours   = ref(0)

async function cleanup() {
  loading.value = true
  result.value  = null
  try {
    const token = await authStore.user?.getIdToken()
    const data = await $fetch<any>('/api/admin/cleanup-battles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { maxAgeHours: Number(hours.value) },
    })
    result.value = data
    if (data.success) {
      emit('flash', `✅ Pulite ${data.cleaned} battaglie stale (su ${data.total} trovate)`, '')
    } else {
      emit('flash', `❌ Errore: ${data.error}`, '#ff4d4d')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div :style="{ color: '#f5e6d3', maxWidth: '500px' }">
    <h2 :style="{ fontFamily: 'Cinzel', fontSize: '18px', color: '#f59e0b', marginBottom: '24px' }">
      🗺️ Mappa Debug
    </h2>

    <div :style="{
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: '14px',
      padding: '20px 24px',
      marginBottom: '24px',
    }">
      <h3 :style="{
        fontFamily: 'Orbitron', fontSize: '12px', color: 'rgba(245,158,11,0.7)',
        marginBottom: '16px', letterSpacing: '2px',
      }">
        CLEANUP BATTAGLIE BLOCCATE
      </h3>

      <p :style="{
        fontFamily: 'Orbitron', fontSize: '10px', color: 'rgba(245,158,11,0.5)',
        lineHeight: '1.6', marginBottom: '16px',
      }">
        Risolve le battaglie rimaste in stato "in_progress" per bug precedenti,
        permettendo di riattaccare quei territori. Le battaglie vengono marcate come "defender_wins".
      </p>

      <div :style="{ marginBottom: '16px' }">
        <label :style="{
          display: 'block', fontFamily: 'Orbitron', fontSize: '10px',
          color: 'rgba(245,158,11,0.8)', marginBottom: '6px', letterSpacing: '1px',
        }">
          Pulisci battaglie più vecchie di (ore):
        </label>
        <div :style="{ display: 'flex', gap: '8px', alignItems: 'center' }">
          <input
            v-model.number="hours"
            type="number"
            min="0"
            :style="{
              width: '80px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#f5e6d3',
              borderRadius: '8px',
              padding: '8px 12px',
              fontFamily: 'Orbitron',
              fontSize: '12px',
            }"
          />
          <span :style="{ fontFamily: 'Orbitron', fontSize: '10px', color: 'rgba(245,158,11,0.5)' }">
            {{ hours == 0 ? '(TUTTE)' : `(>${hours}h fa)` }}
          </span>
        </div>
      </div>

      <button
        :disabled="loading"
        :style="{
          padding: '10px 24px',
          background: loading ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #ec4899)',
          border: 'none',
          borderRadius: '10px',
          color: '#000',
          fontFamily: 'Orbitron',
          fontSize: '10px',
          fontWeight: '700',
          cursor: loading ? 'not-allowed' : 'pointer',
        }"
        @click="cleanup"
      >
        {{ loading ? '⏳ Pulizia…' : '🧹 ESEGUI CLEANUP' }}
      </button>

      <div
        v-if="result"
        :style="{
          marginTop: '16px',
          padding: '10px 14px',
          background: result.success ? 'rgba(0,200,118,0.1)' : 'rgba(255,61,61,0.1)',
          borderRadius: '10px',
          fontFamily: 'Orbitron',
          fontSize: '10px',
          color: result.success ? '#00e676' : '#ff4d4d',
        }"
      >
        {{ result.success
          ? `✅ Battaglie pulite: ${result.cleaned} / ${result.total} trovate`
          : `❌ ${result.error}` }}
      </div>
    </div>
  </div>
</template>
