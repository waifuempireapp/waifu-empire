<!-- ============================================================
  Tab Amici: gestione amicizie, richieste in arrivo e scambi waifu.
  Migrato da: src/app/gioco/_redesign/Amici.jsx
  Sotto-componenti: FriendIdDisplay, AddFriendForm,
  FriendRequestsList, FriendsList, ScambiList.
  ============================================================ -->
<script setup lang="ts">
import { getFriendsList, getFriendRequests } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'

// ------------------------------------------------------------------ Props
defineProps<{
  profilo: any
  collezione: any
  waifuCat: any[]
}>()

// ------------------------------------------------------------------ Emits
const emit = defineEmits<{
  collectionRefresh: []
}>()

// ------------------------------------------------------------------ Costanti locali (da _shared.jsx)
// Colori brand del design system
const C = {
  ink:     '#03020c',
  ink2:    '#0d0a26',
  inkLine: 'rgba(174,156,255,0.18)',
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
}

// ------------------------------------------------------------------ Store e stato
const authStore = useAuthStore()

// Sub-tab attivo: 'amici' oppure 'scambi'
const subTab = ref<'amici' | 'scambi'>('amici')
const scambiBadge = ref(0)

// Feature flag scambi (equivalente di NEXT_PUBLIC_TRADE_ENABLED)
const runtimeConfig = useRuntimeConfig()
const tradeEnabled = (runtimeConfig.public as any).tradeEnabled === true
  || (runtimeConfig.public as any).tradeEnabled === 'true'

// Stato amici e richieste (null = caricamento in corso)
const amici = ref<any[] | null>(null)
const richieste = ref<any[] | null>(null)
const tradesInitialData = ref<{ trades: any[]; pendingCount: number } | null>(null)

// ------------------------------------------------------------------ Caricamento dati
// Carica lista amici e richieste di amicizia da Firestore (client-side)
const caricaAmici = async () => {
  const uid = authStore.user?.uid
  if (!uid) return
  const [friendList, reqList] = await Promise.all([
    getFriendsList(uid).catch(() => []),
    getFriendRequests(uid).catch(() => []),
  ])
  amici.value = friendList as any[]
  richieste.value = reqList as any[]
}

// Carica lista scambi dall'API REST
const caricaScambi = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await $fetch<{ trades: any[]; pendingCount: number }>('/api/trades/list', {
      headers: { Authorization: `Bearer ${token}` },
    })
    tradesInitialData.value = {
      trades: data.trades || [],
      pendingCount: data.pendingCount || 0,
    }
    scambiBadge.value = data.pendingCount || 0
  } catch { /* ignora errori non critici */ }
}

// Caricamento iniziale al mount
onMounted(async () => {
  await caricaAmici()
  if (tradeEnabled) await caricaScambi()
})
</script>

<template>
  <div
    class="fade-in flex flex-col mx-auto pt-[14px]"
    style="max-width: 540px;"
  >
    <!-- ---- Titolo sezione ---- -->
    <div class="mb-[18px]">
      <div
        class="uppercase mb-1.5 font-bold"
        :style="{ fontFamily: 'var(--ff-label, \'Saira Condensed\', sans-serif)', fontSize: '10px', letterSpacing: '0.42em', color: C.sakura }"
      >
        ◆ Network · Stagione 7
      </div>
      <h1
        class="m-0 font-extrabold"
        style="font-family: var(--ff-display, 'Unbounded', sans-serif); font-size: clamp(22px, 5vw, 32px); letter-spacing: -0.01em; line-height: 0.95; color: #fff;"
      >
        <span :style="{ color: C.sakura }">♥</span>
        <span class="shimmer-text"> Amici & Scambi</span>
      </h1>
      <div
        class="mt-1.5 leading-snug"
        style="font-family: var(--ff-body, 'DM Sans', sans-serif); font-size: 12px; color: rgba(241,235,255,0.6);"
      >
        <template v-if="tradeEnabled">
          Connetti il tuo impero, scambia carte e cresci insieme.
        </template>
        <template v-else>
          Aggiungi amici per vedere le loro attività e crescere insieme.
        </template>
      </div>
    </div>

    <!-- ---- Sub-tab bar (solo se trade abilitati) ---- -->
    <div v-if="tradeEnabled" class="flex gap-1 mb-[14px]">
      <button
        v-for="tab in [
          { value: 'amici', label: '👥 Amici' },
          { value: 'scambi', label: '↔ Scambi' },
        ]"
        :key="tab.value"
        @click="subTab = tab.value as 'amici' | 'scambi'"
        class="relative flex-1 py-[9px] overflow-hidden"
        :style="{
          background: subTab === tab.value
            ? 'linear-gradient(180deg, rgba(245,197,96,0.32), rgba(245,197,96,0.10))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          color: subTab === tab.value ? '#2a1f00' : 'var(--text-dim, #b6aed6)',
          border: `1px solid ${subTab === tab.value ? 'rgba(255,233,168,0.6)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '11px',
          fontFamily: 'var(--ff-label, \'Saira Condensed\', sans-serif)',
          fontSize: '10px',
          letterSpacing: '0.18em',
          fontWeight: 700,
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: subTab === tab.value
            ? '0 1px 0 rgba(255,255,255,0.55) inset, 0 -10px 20px rgba(192,138,31,0.45) inset, 0 8px 24px rgba(245,197,96,0.35)'
            : 'none',
        }"
      >
        <!-- Riflesso gloss sul tab attivo -->
        <span
          v-if="subTab === tab.value"
          class="absolute inset-0 pointer-events-none"
          style="border-radius: inherit; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%); opacity: 0.55; mix-blend-mode: overlay;"
        />
        <span class="relative">{{ tab.label }}</span>
        <!-- Badge scambi in attesa -->
        <span
          v-if="tab.value === 'scambi' && scambiBadge > 0"
          class="absolute top-0.5 right-1.5 z-10 inline-flex items-center justify-center"
          style="background: #ff5b6c; color: #fff; border-radius: 999px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 9px; font-family: 'JetBrains Mono', monospace; font-weight: 700; box-shadow: 0 0 8px rgba(255,91,108,0.6);"
        >{{ scambiBadge }}</span>
      </button>
    </div>

    <!-- ---- Contenuto tab Amici ---- -->
    <template v-if="subTab === 'amici'">
      <!-- Spinner caricamento -->
      <div
        v-if="amici === null"
        class="text-center py-8"
        style="color: rgba(241,235,255,0.45); font-family: var(--ff-label, 'Saira Condensed', sans-serif); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 700;"
      >
        <span
          class="inline-block align-middle mr-2.5"
          style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid; border-color: #ff85b6 transparent #ff85b6 #ff85b6; animation: spin 1s linear infinite;"
        />
        Caricamento amici…
      </div>

      <!-- Lista amici e form -->
      <div v-else class="flex flex-col gap-[14px]">
        <FriendIdDisplay :friend-id="profilo?.friendId" />
        <AddFriendForm />
        <FriendRequestsList
          :richieste="richieste || []"
          @update="caricaAmici"
        />
        <FriendsList
          :amici="amici"
          @update="caricaAmici"
        />
      </div>
    </template>

    <!-- ---- Contenuto tab Scambi ---- -->
    <ScambiList
      v-if="tradeEnabled && subTab === 'scambi'"
      :profilo="profilo"
      :collezione="collezione"
      :waifuCat="waifuCat || []"
      :initialData="tradesInitialData"
      @badgeChange="(n: number) => { scambiBadge = n }"
      @refresh="caricaScambi"
      @collectionRefresh="emit('collectionRefresh')"
    />
  </div>
</template>
