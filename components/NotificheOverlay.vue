<!-- ============================================================
  Centro notifiche: mostra gli avvisi dell'utente (es. una waifu che
  possiede è salita di rarità a fine mese). Apre da /api/notifiche/list
  (che innesca chiusura mensile + reconcile) e segna tutto letto.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { Bell, Trophy } from 'lucide-vue-next'
import { ikUrl } from '~/utils/imagekitUrl'

const emit = defineEmits<{ close: []; read: [] }>()
const authStore = useAuthStore()
const { t } = useI18n()

const FF = {
  display: "var(--ff-display, 'Fredoka', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
}
const RARITY_NAMES: Record<string, string> = {
  comune: 'Comune', raro: 'Raro', epico: 'Epico', leggendario: 'Leggendario', immersivo: 'Immersivo',
}
const RARITY_COLORS: Record<string, string> = {
  comune: '#9ca3af', raro: '#3b82f6', epico: '#a855f7', leggendario: '#f59e0b', immersivo: '#ec4899',
}

interface Notif { id: string; tipo: string; nome?: string | null; oldRarita?: string | null; newRarita?: string | null; image?: string | null; read: boolean; createdAt?: number | null }
const notifiche = ref<Notif[]>([])
const loading   = ref(true)

function timeAgo(ms?: number | null): string {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'ora'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m fa`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h fa`
  return `${Math.floor(h / 24)}g fa`
}

onMounted(async () => {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/notifiche/list', { headers: { Authorization: `Bearer ${token}` } })) as { notifiche: Notif[] }
    notifiche.value = data.notifiche ?? []
    // Segna tutte lette
    if (notifiche.value.some(n => !n.read)) {
      await ($fetch('/api/notifiche/read', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: {} }))
      emit('read')
    }
  } finally { loading.value = false }
})
</script>

<template>
  <div class="notif-overlay" @click.self="emit('close')">
    <div class="notif-panel">
      <div class="notif-head">
        <span class="notif-title" :style="{ fontFamily: FF.display }">{{ t('notifications.title') }}</span>
        <button class="notif-close" @click="emit('close')">✕</button>
      </div>

      <AppLoading v-if="loading" />

      <div v-else-if="notifiche.length === 0" class="notif-empty">
        <Bell :size="42" stroke-width="1.5" style="opacity:0.35;margin-bottom:10px;" />
        <div :style="{ fontFamily: FF.label, color: 'var(--theme-text-2)', fontSize: '14px', fontWeight: 700 }">{{ t('notifications.empty') }}</div>
      </div>

      <div v-else class="notif-list">
        <div v-for="n in notifiche" :key="n.id" class="notif-item" :class="{ 'notif-item--unread': !n.read }">
          <div class="notif-thumb" :style="{ borderColor: RARITY_COLORS[n.newRarita ?? 'comune'] }">
            <img v-if="n.image" :src="ikUrl(n.image, 'thumbnail') ?? ''" :alt="n.nome ?? ''" />
            <div v-else class="notif-thumb-ph">✦</div>
          </div>
          <div class="notif-body">
            <div class="notif-item-title" :style="{ fontFamily: FF.label }">
              <Trophy :size="14" stroke-width="2" style="display:inline-block;vertical-align:-2px;" /> {{ t('notifications.rarity_up_title') }}
            </div>
            <div class="notif-item-text" :style="{ fontFamily: FF.body }">
              <strong>{{ n.nome }}</strong>
              {{ t('notifications.rarity_up_body') }}
              <span :style="{ color: RARITY_COLORS[n.oldRarita ?? 'comune'], fontWeight: 700 }">{{ RARITY_NAMES[n.oldRarita ?? 'comune'] }}</span>
              →
              <span :style="{ color: RARITY_COLORS[n.newRarita ?? 'comune'], fontWeight: 800 }">{{ RARITY_NAMES[n.newRarita ?? 'comune'] }}</span>
            </div>
            <div class="notif-item-time" :style="{ fontFamily: FF.body }">{{ timeAgo(n.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-overlay {
  position: fixed; inset: 0; z-index: 120;
  background: var(--theme-overlay); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  display: flex; align-items: flex-start; justify-content: center;
  padding: max(64px, env(safe-area-inset-top)) 14px 14px;
}
.notif-panel {
  width: 100%; max-width: 460px; max-height: 82dvh;
  display: flex; flex-direction: column;
  background: var(--theme-surface); border: 1px solid var(--theme-border);
  border-radius: 20px; box-shadow: 0 12px 40px var(--theme-shadow); overflow: hidden;
}
.notif-head {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; border-bottom: 1px solid var(--theme-border);
}
.notif-title { font-size: 15px; font-weight: 900; color: var(--theme-text); letter-spacing: 0.02em; }
.notif-close {
  width: 32px; height: 32px; border-radius: 9px;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  color: var(--theme-text-2); font-size: 13px; cursor: pointer;
}
.notif-empty { padding: 48px 20px; text-align: center; }
.notif-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.notif-item {
  display: flex; gap: 12px; align-items: center;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  border-radius: 14px; padding: 12px;
}
.notif-item--unread { border-color: var(--theme-accent); box-shadow: 0 0 0 1px var(--theme-accent) inset; }
.notif-thumb {
  width: 52px; height: 68px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
  border: 2px solid var(--theme-border); background: var(--theme-bg-secondary);
}
.notif-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.notif-thumb-ph { display: flex; align-items: center; justify-content: center; height: 100%; opacity: .3; }
.notif-body { flex: 1; min-width: 0; }
.notif-item-title { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--theme-accent); margin-bottom: 4px; }
.notif-item-text { font-size: 13px; color: var(--theme-text); line-height: 1.4; }
.notif-item-time { font-size: 11px; color: var(--theme-text-3); margin-top: 5px; }
</style>
