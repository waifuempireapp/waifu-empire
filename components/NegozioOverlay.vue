<!-- ============================================================
  Overlay negozio: acquisto beni e pass con Kisses.
  Versione overlay da richiamare dentro gioco/index.vue.
  TODO: migrare da src/components/NegozioOverlay.jsx
  ============================================================ -->
<script setup lang="ts">
import type { ProfiloUtente } from '~/types/game'
defineProps<{ profilo: ProfiloUtente | null }>()
defineEmits<{
  kissesUpdate:  [kisses: number]
  profileUpdate: [patch: Record<string, unknown>]
  close:         []
}>()
</script>
<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center"
       style="background:var(--theme-overlay);backdrop-filter:blur(20px)">
    <div class="text-center">
      <div class="font-orbitron text-amber-400/50 text-xs tracking-widest mb-4">
        NEGOZIO OVERLAY — in migrazione
      </div>
      <button
        class="font-orbitron text-[10px] text-amber-400 bg-transparent border border-amber-400/30 rounded-lg px-4 py-2 cursor-pointer"
        @click="$emit('close')"
      >CHIUDI</button>
    </div>
  </div>
</template>
