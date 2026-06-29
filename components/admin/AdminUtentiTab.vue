<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const emit = defineEmits<{ notif: [testo: string, colore: string] }>()

// ── Ricerca ──────────────────────────────────────────────────────────────────
const searchInput = ref('')
const loading     = ref(false)
const utente      = ref<Record<string, any> | null>(null)
const errore      = ref('')

async function cerca() {
  if (!searchInput.value.trim()) return
  loading.value = true; errore.value = ''; utente.value = null
  try {
    const token = await authStore.user?.getIdToken()
    const isUid = searchInput.value.trim().length > 20 && !searchInput.value.includes('@')
    const qs    = isUid ? `uid=${encodeURIComponent(searchInput.value.trim())}` : `email=${encodeURIComponent(searchInput.value.trim())}`
    const data = await $fetch(`/api/admin/users/search?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    }) as Record<string, any>
    utente.value = { ...data }
    // Copia locale per editing
    form.value = {
      kisses:             data.kisses,
      energia:            data.energia,
      livello:            data.livello,
      xp:                 data.xp,
      pacchettiOmaggio:   data.pacchettiOmaggio,
      pacchettiSfida:     data.pacchettiSfida,
      pacchettiBenvenuto: data.pacchettiBenvenuto,
      hardPass:           data.hardPass,
      swapPassActive:     data.swapPassActive,
      tradePassActive:    data.tradePassActive,
    }
  } catch (e: any) {
    errore.value = e?.data?.message ?? e?.message ?? 'Errore'
  } finally {
    loading.value = false
  }
}

// ── Form editing ─────────────────────────────────────────────────────────────
const form    = ref<Record<string, any>>({})
const saving  = ref(false)

async function salva() {
  if (!utente.value) return
  saving.value = true
  try {
    const token = await authStore.user?.getIdToken()
    await $fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { uid: utente.value.uid, patch: form.value },
    })
    // Aggiorna i valori mostrati
    Object.assign(utente.value, form.value)
    emit('notif', '✅ Utente aggiornato', '#06d6a0')
  } catch (e: any) {
    emit('notif', '❌ ' + (e?.data?.message ?? e?.message ?? 'Errore'), '#ff5b6c')
  } finally {
    saving.value = false
  }
}

// ── Campi numerici e booleani ────────────────────────────────────────────────
const FIELDS_NUM = [
  { k: 'kisses',             l: '💋 Kisses' },
  { k: 'energia',            l: '⚡ Energia' },
  { k: 'livello',            l: '📊 Livello' },
  { k: 'xp',                 l: '✨ XP' },
  { k: 'pacchettiOmaggio',   l: '🎁 Pack Omaggio' },
  { k: 'pacchettiSfida',     l: '📦 Pack Sfida' },
  { k: 'pacchettiBenvenuto', l: '🆕 Pack Benvenuto' },
]
const FIELDS_BOOL = [
  { k: 'hardPass',        l: '🔞 Hard Pass' },
  { k: 'swapPassActive',  l: '💋 Swap Pass' },
  { k: 'tradePassActive', l: '🔄 Trade Pass' },
]
</script>

<template>
  <div style="padding:24px;max-width:720px;">

    <h2 style="font-size:20px;font-weight:800;margin-bottom:20px;color:var(--text-primary);">
      👤 Gestione Utenti
    </h2>

    <!-- Ricerca -->
    <div style="display:flex;gap:10px;margin-bottom:24px;">
      <input
        v-model="searchInput"
        placeholder="Email o UID utente"
        @keydown.enter="cerca"
        style="flex:1;padding:10px 14px;border-radius:10px;border:1px solid var(--border-medium);background:var(--bg-card);color:var(--text-primary);font-size:14px;outline:none;"
      />
      <button
        @click="cerca"
        :disabled="loading"
        class="admin-btn-accent"
        style="min-width:100px;"
      >
        {{ loading ? '…' : '🔍 Cerca' }}
      </button>
    </div>

    <div v-if="errore" style="color:#ff5b6c;font-size:14px;margin-bottom:16px;">⚠ {{ errore }}</div>

    <!-- Scheda utente -->
    <template v-if="utente">
      <!-- Info intestazione -->
      <div style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:14px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:800;color:var(--text-primary);margin-bottom:4px;">
          {{ utente.nomeImpero || utente.displayName || '—' }}
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">{{ utente.email }} · UID: {{ utente.uid }}</div>
        <div style="display:flex;gap:14px;font-size:12px;color:var(--text-tertiary);">
          <span>🃏 Waifu: <strong style="color:var(--text-primary)">{{ utente.waifuCount }}</strong></span>
          <span>👗 Outfit: <strong style="color:var(--text-primary)">{{ utente.outfitCount }}</strong></span>
          <span>📸 Pose: <strong style="color:var(--text-primary)">{{ utente.poseCount }}</strong></span>
        </div>
      </div>

      <!-- Campi numerici -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div v-for="f in FIELDS_NUM" :key="f.k" style="background:var(--bg-card);border:1px solid var(--border-medium);border-radius:10px;padding:12px 14px;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;font-weight:600;">{{ f.l }}</div>
          <input
            v-model.number="form[f.k]"
            type="number"
            min="0"
            style="width:100%;background:transparent;border:none;outline:none;font-size:18px;font-weight:800;color:var(--text-primary);font-family:var(--ff-mono,'JetBrains Mono',monospace);"
          />
        </div>
      </div>

      <!-- Campi booleani (Pass) -->
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <label
          v-for="f in FIELDS_BOOL"
          :key="f.k"
          style="display:flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border-medium);border-radius:10px;padding:10px 14px;cursor:pointer;user-select:none;"
        >
          <input type="checkbox" v-model="form[f.k]" style="width:16px;height:16px;cursor:pointer;" />
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">{{ f.l }}</span>
        </label>
      </div>

      <!-- Salva -->
      <button
        @click="salva"
        :disabled="saving"
        class="admin-btn-accent"
        style="width:100%;padding:14px;"
      >
        {{ saving ? 'Salvataggio…' : '💾 Salva modifiche' }}
      </button>
    </template>

  </div>
</template>
