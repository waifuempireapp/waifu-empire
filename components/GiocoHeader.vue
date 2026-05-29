<!-- ============================================================
  Header del gioco: mostra nome impero, kisses, energia e logout.
  ============================================================ -->
<script setup lang="ts">
import type { ProfiloUtente } from '~/types/game'

defineProps<{
  profilo:  ProfiloUtente | null
  isAdmin?: boolean
}>()
defineEmits<{ logout: [] }>()

const router = useRouter()
</script>

<template>
  <header class="sticky top-0 z-40 flex items-center justify-between px-4 py-2.5"
          style="background:rgba(6,3,15,0.95);backdrop-filter:blur(16px);
                 border-bottom:1px solid rgba(245,158,11,0.12)">
    <!-- Nome impero -->
    <div class="flex items-center gap-2">
      <span class="text-amber-400 text-lg font-cinzel glow-pulse">♛</span>
      <span class="font-cinzel text-sm font-semibold tracking-wider text-amber-100">
        {{ profilo?.nomeImpero ?? '...' }}
      </span>
      <NuxtLink v-if="isAdmin" to="/admin"
                class="text-[9px] font-orbitron text-purple-400 border border-purple-400/30
                       rounded px-1.5 py-0.5 hover:bg-purple-400/10 transition-colors">
        ADMIN
      </NuxtLink>
    </div>

    <!-- Risorse + logout -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1">
        <span class="text-pink-400 text-xs">💋</span>
        <span class="font-orbitron text-xs font-bold text-pink-400">{{ profilo?.kisses ?? 0 }}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-green-400 text-xs">⚡</span>
        <span class="font-orbitron text-xs font-bold text-green-400">{{ profilo?.energia ?? 0 }}</span>
      </div>
      <button
        class="font-orbitron text-[9px] text-amber-400/60 hover:text-amber-400 bg-transparent border-0 cursor-pointer transition-colors"
        @click="$emit('logout')"
      >EXIT</button>
    </div>
  </header>
</template>
