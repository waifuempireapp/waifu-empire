<!-- ============================================================
  FriendsList: lista degli amici confermati dell'utente.
  Consente di rimuovere un amico tramite DELETE /api/friends/remove.
  ============================================================ -->
<script setup lang="ts">
import { getFriendshipDoc } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'

// Props: lista amici già caricata dal parent AmiciTab
const props = defineProps<{
  amici: any[]
}>()

// Evento emesso dopo rimozione per aggiornare il parent
const emit = defineEmits<{
  update: []
}>()

// Store autenticazione
const authStore = useAuthStore()

// Rimuove un amico: prima recupera il doc di amicizia, poi chiama l'API
const rimuovi = async (amicoUid: string) => {
  const uid = authStore.user?.uid
  if (!uid) return
  const friendship = await getFriendshipDoc(uid, amicoUid)
  if (!friendship) return
  const token = await authStore.user?.getIdToken()
  await $fetch('/api/friends/remove', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: { friendshipId: (friendship as any).id },
  })
  emit('update')
}
</script>

<template>
  <div>
    <!-- Intestazione sezione -->
    <div
      class="mb-[10px] uppercase tracking-widest"
      style="font-size: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; color: rgba(238,232,220,0.5);"
    >
      Amici ({{ amici.length }})
    </div>

    <!-- Stato vuoto -->
    <div
      v-if="amici.length === 0"
      class="py-5 text-center"
      style="font-size: 11px; color: rgba(238,232,220,0.35); font-family: 'Fredoka', sans-serif;"
    >
      Nessun amico ancora. Condividi il tuo Friend ID!
    </div>

    <!-- Lista amici -->
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="a in amici"
        :key="a.id"
        class="flex items-center justify-between rounded-[10px] px-[14px] py-[10px]"
        :style="{
          background: 'var(--surface)',
          border: '1px solid rgba(245,166,35,0.15)',
        }"
      >
        <!-- Info amico -->
        <div>
          <div
            style="font-family: 'Orbitron', sans-serif; font-size: 12px; color: #eedcd4; font-weight: 700;"
          >
            {{ a.nomeImpero || a.id.slice(0, 8) }}
          </div>
          <div
            class="mt-[2px] opacity-40 tracking-widest"
            style="font-size: 9px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px;"
          >
            {{ a.friendId }}
          </div>
        </div>

        <!-- Bottone rimuovi -->
        <button
          @click="rimuovi(a.id)"
          :style="{
            background: 'rgba(255,77,77,0.06)',
            border: '1px solid rgba(255,77,77,0.25)',
            borderRadius: '7px',
            color: '#ff4d4d',
            fontFamily: '\'Orbitron\', sans-serif',
            fontSize: '8px',
            padding: '5px 10px',
            cursor: 'pointer',
          }"
        >RIMUOVI</button>
      </div>
    </div>
  </div>
</template>
