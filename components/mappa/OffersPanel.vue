<template>
  <!-- Pannello offerte territorio: offerte in entrata e in uscita dell'utente -->
  <div :style="overlayStyle">
    <!-- Header -->
    <div :style="headerStyle">
      <div>
        <div :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase' }">Territorio</div>
        <div :style="{ fontFamily: FF.display, fontSize: '18px', color: '#fff', fontWeight: 800 }">Offerte</div>
      </div>
      <button :style="closeBtnStyle" @click="$emit('close')">✕</button>
    </div>

    <!-- Lista offerte -->
    <div :style="{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }">
      <div v-if="loading" :style="{ textAlign: 'center', color: 'rgba(241,235,255,0.3)', padding: '40px' }">
        Caricamento…
      </div>
      <template v-else>
        <!-- Offerte in entrata -->
        <div v-if="offers.incoming.length > 0" style="margin-bottom:24px">
          <div :style="sectionTitleStyle(C.sakura)">Offerte in entrata</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div
              v-for="o in offers.incoming"
              :key="o.id"
              :style="cardStyle"
            >
              <div :style="cardRowStyle">
                <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'rgba(241,235,255,0.7)' }">
                  {{ pixelLabel(o) }}
                </div>
                <span :style="statusStyle(o.status)">{{ o.status }}</span>
              </div>
              <div :style="{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: o.status === 'pending' ? '12px' : '0' }">
                <KissesIcon :size="14" />
                <span :style="{ fontFamily: FF.display, fontSize: '16px', color: '#f5c560', fontWeight: 700 }">{{ o.amount }}</span>
                <span :style="{ fontFamily: FF.label, fontSize: '10px', color: 'rgba(241,235,255,0.4)' }">kisses</span>
              </div>
              <div v-if="o.status === 'pending'" style="display:flex;gap:8px">
                <button :disabled="acting === o.id" :style="actionBtnStyle('#58e0a3','rgba(88,224,163,0.12)')" @click="handleAction(o.id,'accept')">✓ Accetta</button>
                <button :disabled="acting === o.id" :style="actionBtnStyle('#ff5b6c','rgba(255,91,108,0.12)')" @click="handleAction(o.id,'reject')">✕ Rifiuta</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tue offerte in uscita -->
        <div v-if="offers.outgoing.length > 0" style="margin-bottom:24px">
          <div :style="sectionTitleStyle(C.aqua)">Tue offerte</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div
              v-for="o in offers.outgoing"
              :key="o.id"
              :style="cardStyle"
            >
              <div :style="cardRowStyle">
                <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'rgba(241,235,255,0.7)' }">
                  {{ pixelLabel(o) }}
                </div>
                <span :style="statusStyle(o.status)">{{ o.status }}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <KissesIcon :size="14" />
                <span :style="{ fontFamily: FF.display, fontSize: '16px', color: '#f5c560', fontWeight: 700 }">{{ o.amount }}</span>
                <span :style="{ fontFamily: FF.label, fontSize: '10px', color: 'rgba(241,235,255,0.4)' }">kisses</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="offers.incoming.length === 0 && offers.outgoing.length === 0"
          :style="{ textAlign: 'center', color: 'rgba(241,235,255,0.3)', padding: '60px', fontFamily: FF.body, fontSize: '14px' }"
        >
          Nessuna offerta in corso
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Pannello offerte: carica e gestisce accettazione/rifiuto offerte sui territori
import { PIXEL_NAMES } from '~/utils/worldMap'

const authStore = useAuthStore()

const emit = defineEmits<{
  close: []
  kissesUpdate: [amount: number]
  mapUpdate: []
}>()

// Costanti colori e font
const C = {
  gold:   '#f5c560',
  goldL:  '#ffe9a8',
  sakura: '#ff85b6',
  aqua:   '#6cf0e0',
  violet: '#a78bfa',
  ok:     '#58e0a3',
  err:    '#ff5b6c',
}
const FF = {
  display: "'Cinzel', serif",
  label:   "'Saira Condensed', sans-serif",
  body:    "'Inter', sans-serif",
  mono:    "'JetBrains Mono', monospace",
}

interface Offer {
  id: string
  pixelX: number
  pixelY: number
  amount: number
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
}

const offers  = ref<{ incoming: Offer[]; outgoing: Offer[] }>({ incoming: [], outgoing: [] })
const loading = ref(true)
const acting  = ref<string | null>(null)

useScrollLock()

const pixelLabel = (o: Offer) => PIXEL_NAMES[`${o.pixelX}_${o.pixelY}`] ?? `(${o.pixelX}, ${o.pixelY})`

const loadOffers = async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await $fetch<{ incoming: Offer[]; outgoing: Offer[] }>('/api/mappa/offers', {
      headers: { Authorization: `Bearer ${token}` },
    })
    offers.value = data
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadOffers() })

const handleAction = async (offerId: string, action: 'accept' | 'reject') => {
  acting.value = offerId
  try {
    const token = await authStore.user?.getIdToken()
    const offer = [...offers.value.incoming, ...offers.value.outgoing].find(o => o.id === offerId)
    const data = await $fetch<{ success: boolean }>(`/api/mappa/offers/${offerId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { action },
    })
    if (data.success && action === 'accept' && offer) {
      emit('kissesUpdate', offer.amount)
      emit('mapUpdate')
    }
    await loadOffers()
  } finally {
    acting.value = null
  }
}

// Stili
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(3,2,12,0.95)', backdropFilter: 'blur(16px)',
  display: 'flex', flexDirection: 'column',
}
const headerStyle = {
  padding: '20px 20px 0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px',
}
const closeBtnStyle = {
  background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: '22px', cursor: 'pointer',
}
const cardStyle = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(174,156,255,0.15)',
  borderRadius: '14px', padding: '14px 16px',
}
const cardRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
}

const statusColors: Record<string, string> = {
  pending:  '#ffe9a8',
  accepted: '#58e0a3',
  rejected: '#ff5b6c',
  expired:  '#6b6390',
}
const statusStyle = (status: string) => ({
  fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.15em',
  textTransform: 'uppercase', color: statusColors[status] || '#ffe9a8',
})
const sectionTitleStyle = (color: string) => ({
  fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.2em',
  color, textTransform: 'uppercase', marginBottom: '12px',
})
const actionBtnStyle = (color: string, bg: string) => ({
  flex: 1, padding: '8px', background: bg,
  border: `1px solid ${color}55`, borderRadius: '10px', color,
  fontFamily: "'Saira Condensed', sans-serif", fontSize: '11px',
  letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
})
</script>
