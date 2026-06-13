<!--
  AdminSoundtrackTab.vue
  Gestione della colonna sonora del gioco: permette di impostare l'URL
  di un file audio (MP3/OGG) riprodotto in loop nel client.
  La lettura non richiede autenticazione; il salvataggio sì.
-->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const emit = defineEmits<{ flash: [t: string, c: string] }>()

const authStore = useAuthStore()
const url     = ref('')
const loading = ref(true)
const saving  = ref(false)

onMounted(async () => {
  try {
    const data = await ($fetch('/api/admin/soundtrack')) as any
    url.value = data.url ?? ''
  } catch (_) {
    // ignora errori di rete — url rimane vuoto
  } finally {
    loading.value = false
  }
})

async function salva() {
  saving.value = true
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/admin/soundtrack', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { url: url.value },
    })) as any
    if (data.success) {
      emit('flash', 'Soundtrack salvata!', '')
    } else {
      emit('flash', 'Errore: ' + data.error, '#ff4d4d')
    }
  } catch (e: any) {
    emit('flash', 'Errore: ' + e.message, '#ff4d4d')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppLoading v-if="loading" />

  <div v-else :style="{ padding: '20px', maxWidth: '600px', margin: '0 auto' }">
    <div :style="{ fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f5a623', marginBottom: '8px' }">
      Colonna Sonora
    </div>
    <div :style="{ fontFamily: 'Fredoka', fontSize: '12px', color: 'rgba(245,230,211,0.5)', marginBottom: '16px' }">
      URL diretto di un file audio (MP3/OGG) riprodotto in loop nel gioco. Deve essere accessibile pubblicamente.
    </div>

    <input
      v-model="url"
      placeholder="https://example.com/music.mp3"
      :style="{
        width: '100%',
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: '8px',
        color: '#f5e6d3',
        fontFamily: 'Fredoka',
        fontSize: '13px',
        boxSizing: 'border-box',
        marginBottom: '12px',
      }"
    />

    <audio v-if="url" :src="url" controls :style="{ display: 'block', width: '100%', marginBottom: '12px' }" />

    <button
      :disabled="saving"
      :style="{
        padding: '10px 24px',
        background: saving ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #ec4899)',
        border: 'none',
        borderRadius: '10px',
        color: '#000',
        fontFamily: 'Orbitron',
        fontSize: '10px',
        fontWeight: '700',
        cursor: saving ? 'not-allowed' : 'pointer',
      }"
      @click="salva"
    >
      {{ saving ? 'Salvataggio...' : 'SALVA SOUNDTRACK' }}
    </button>

    <div
      v-if="url"
      :style="{ marginTop: '12px', fontFamily: 'Fredoka', fontSize: '11px', color: 'rgba(6,214,160,0.7)' }"
    >
      Attiva: {{ url }}
    </div>
  </div>
</template>
