<!-- ============================================================
  AddFriendForm: form per inviare una richiesta di amicizia
  tramite Friend ID (8 caratteri). Chiama /api/friends/send.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// Store autenticazione per ottenere il token Firebase
const authStore = useAuthStore()

// Stato del form
const friendId = ref('')
const stato = ref<null | 'loading' | 'ok' | 'error'>(null)
const messaggio = ref('')

// Invia la richiesta di amicizia all'API
const invia = async () => {
  const id = friendId.value.trim().toUpperCase()
  if (id.length !== 8) {
    stato.value = 'error'
    messaggio.value = 'Il Friend ID deve essere di 8 caratteri'
    return
  }
  stato.value = 'loading'
  try {
    const token = await authStore.user?.getIdToken()
    const data = await $fetch<{ error?: string }>('/api/friends/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { friendId: id },
    })
    stato.value = 'ok'
    messaggio.value = 'Richiesta inviata!'
    friendId.value = ''
  } catch (e: any) {
    stato.value = 'error'
    messaggio.value = e?.data?.error || e?.message || 'Errore di rete'
  }
  setTimeout(() => { stato.value = null }, 3000)
}

// Normalizza l'input: solo maiuscole, max 8 caratteri
const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  friendId.value = target.value.toUpperCase().slice(0, 8)
}
</script>

<template>
  <div
    class="rounded-xl px-[18px] py-[14px]"
    :style="{
      background: 'rgba(6,3,15,0.6)',
      border: '1px solid rgba(245,166,35,0.15)',
    }"
  >
    <!-- Etichetta sezione -->
    <div
      class="mb-[10px] uppercase tracking-widest"
      style="font-size: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; color: rgba(238,232,220,0.5);"
    >
      Aggiungi amico
    </div>

    <!-- Input + bottone invio -->
    <div class="flex gap-2">
      <input
        :value="friendId"
        @input="onInput"
        placeholder="ES: AB3X9K7M"
        maxlength="8"
        :style="{
          flex: 1,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(245,166,35,0.25)',
          borderRadius: '8px',
          color: '#eedcd4',
          fontFamily: '\'Orbitron\', sans-serif',
          fontSize: '14px',
          letterSpacing: '3px',
          padding: '8px 12px',
          outline: 'none',
        }"
      />
      <button
        @click="invia"
        :disabled="stato === 'loading'"
        :style="{
          background: 'rgba(245,166,35,0.12)',
          border: '1px solid rgba(245,166,35,0.35)',
          borderRadius: '8px',
          color: '#f5a623',
          fontFamily: '\'Orbitron\', sans-serif',
          fontSize: '9px',
          letterSpacing: '1px',
          padding: '8px 14px',
          cursor: stato === 'loading' ? 'wait' : 'pointer',
        }"
      >
        {{ stato === 'loading' ? '…' : 'INVIA' }}
      </button>
    </div>

    <!-- Messaggio di feedback (ok / errore) -->
    <div
      v-if="stato && stato !== 'loading'"
      class="mt-2"
      :style="{
        fontSize: '11px',
        color: stato === 'ok' ? '#00e676' : '#ff4d4d',
        fontFamily: '\'Orbitron\', sans-serif',
        letterSpacing: '1px',
      }"
    >
      {{ messaggio }}
    </div>
  </div>
</template>
