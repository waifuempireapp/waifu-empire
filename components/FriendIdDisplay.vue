<!-- ============================================================
  FriendIdDisplay: mostra il Friend ID dell'utente corrente
  con pulsante per copiarlo negli appunti.
  ============================================================ -->
<script setup lang="ts">
// Props: friendId opzionale (può essere undefined prima del caricamento)
defineProps<{
  friendId?: string | null
}>()

// Stato copia negli appunti
const copiato = ref(false)

// Copia il friendId nella clipboard e mostra feedback temporaneo
const copia = async (friendId?: string | null) => {
  await navigator.clipboard.writeText(friendId || '')
  copiato.value = true
  setTimeout(() => { copiato.value = false }, 2000)
}
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 rounded-xl px-[18px] py-[14px]"
    :style="{
      background: 'rgba(255,45,120,0.07)',
      border: '1px solid rgba(255,45,120,0.3)',
    }"
  >
    <div>
      <div
        class="mb-1 tracking-widest uppercase"
        style="font-size: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; color: rgba(238,232,220,0.5);"
      >
        Il tuo Friend ID
      </div>
      <div
        style="font-family: 'Orbitron', sans-serif; font-size: 20px; font-weight: 900; color: #ff2d78; letter-spacing: 4px; text-shadow: 0 0 12px rgba(255,45,120,0.6);"
      >
        {{ friendId || '—' }}
      </div>
    </div>

    <button
      @click="copia(friendId)"
      :style="{
        background: copiato ? 'rgba(0,230,118,0.15)' : 'rgba(255,45,120,0.12)',
        border: `1px solid ${copiato ? 'rgba(0,230,118,0.5)' : 'rgba(255,45,120,0.4)'}`,
        borderRadius: '8px',
        color: copiato ? '#00e676' : '#ff2d78',
        fontFamily: '\'Orbitron\', sans-serif',
        fontSize: '9px',
        letterSpacing: '1px',
        padding: '8px 14px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }"
    >
      {{ copiato ? '✓ COPIATO' : 'COPIA' }}
    </button>
  </div>
</template>
