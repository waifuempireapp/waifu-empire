<!-- ============================================================
  FriendRequestsList: lista delle richieste di amicizia in arrivo.
  Permette di accettare (POST /api/friends/accept) o rifiutare
  (DELETE /api/friends/remove) ogni richiesta.
  ============================================================ -->
<script setup lang="ts">
import { getUserProfile } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'

// Props ricevute dal parent AmiciTab
const props = defineProps<{
  richieste: any[]
}>()

// Evento emesso dopo accettazione/rifiuto per aggiornare la lista nel parent
const emit = defineEmits<{
  update: []
}>()

// Store autenticazione
const authStore = useAuthStore()

// Mappa uid → profilo utente per mostrare il nome dell'impero
const profiloMap = ref<Record<string, any>>({})
const busy = ref(false)

// Carica i profili degli utenti che hanno inviato le richieste
const caricaProfiloRichieste = async () => {
  if (props.richieste.length === 0) return
  const profiles = await Promise.all(props.richieste.map(r => getUserProfile(r.fromUid)))
  const map: Record<string, any> = {}
  props.richieste.forEach((r, i) => { map[r.fromUid] = profiles[i] })
  profiloMap.value = map
}

// Rispondi a una richiesta: 'accept' o 'reject'
const rispondi = async (friendshipId: string, azione: 'accept' | 'reject') => {
  busy.value = true
  try {
    const token = await authStore.user?.getIdToken()
    if (azione === 'accept') {
      await $fetch('/api/friends/accept', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { friendshipId },
      })
    } else {
      await $fetch('/api/friends/remove', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        body: { friendshipId },
      })
    }
    emit('update')
  } finally {
    busy.value = false
  }
}

// Ricarica i profili ogni volta che cambiano le richieste
watch(() => props.richieste, caricaProfiloRichieste, { immediate: true })
</script>

<template>
  <!-- Non mostrare nulla se non ci sono richieste pendenti -->
  <div v-if="richieste.length > 0">
    <!-- Intestazione sezione -->
    <div
      class="mb-[10px] uppercase tracking-widest"
      style="font-size: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; color: rgba(238,232,220,0.5);"
    >
      Richieste in arrivo ({{ richieste.length }})
    </div>

    <!-- Lista richieste -->
    <div class="flex flex-col gap-2">
      <div
        v-for="r in richieste"
        :key="r.id"
        class="flex items-center justify-between gap-[10px] rounded-[10px] px-[14px] py-[10px]"
        :style="{
          background: 'rgba(245,166,35,0.05)',
          border: '1px solid rgba(245,166,35,0.2)',
        }"
      >
        <!-- Info mittente -->
        <div>
          <div
            style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: #f5a623; font-weight: 700;"
          >
            {{ profiloMap[r.fromUid]?.nomeImpero || r.fromUid.slice(0, 8) }}
          </div>
          <div
            class="mt-[2px] opacity-40 tracking-widest"
            style="font-size: 9px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px;"
          >
            {{ profiloMap[r.fromUid]?.friendId }}
          </div>
        </div>

        <!-- Bottoni accetta / rifiuta -->
        <div class="flex gap-1.5">
          <button
            :disabled="busy"
            @click="rispondi(r.id, 'accept')"
            :style="{
              background: 'rgba(0,230,118,0.12)',
              border: '1px solid rgba(0,230,118,0.4)',
              borderRadius: '7px',
              color: '#00e676',
              fontFamily: '\'Orbitron\', sans-serif',
              fontSize: '9px',
              padding: '6px 12px',
              cursor: 'pointer',
            }"
          >✓ ACCETTA</button>
          <button
            :disabled="busy"
            @click="rispondi(r.id, 'reject')"
            :style="{
              background: 'rgba(255,77,77,0.08)',
              border: '1px solid rgba(255,77,77,0.3)',
              borderRadius: '7px',
              color: '#ff4d4d',
              fontFamily: '\'Orbitron\', sans-serif',
              fontSize: '9px',
              padding: '6px 12px',
              cursor: 'pointer',
            }"
          >✕ RIFIUTA</button>
        </div>
      </div>
    </div>
  </div>
</template>
