<!-- ============================================================
  Pagina negozio: acquisto beni con Kisses e ricarica Kisses via PayPal.
  Equivalente di src/app/negozio/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore }             from '~/stores/auth'
import { useGameStore }             from '~/stores/game'
import { getUserProfile }           from '~/utils/firestoreService'

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const gameStore = useGameStore()
const router    = useRouter()
const config    = useRuntimeConfig()

const prezzi       = ref<Record<string, unknown> | null>(null)
const kisses       = ref<number>(Number(gameStore.profilo?.kisses ?? 0))
const caricato     = ref(false)
const notif        = ref<{ testo: string; colore: string } | null>(null)

const PAYPAL_CLIENT_ID = (config.public as Record<string, unknown>).paypalClientId as string

onMounted(async () => {
  if (!authStore.user) return
  const profilo = await getUserProfile(authStore.user.uid)
  if (!profilo) { router.replace('/onboarding'); return }
  kisses.value = (profilo.kisses as number) ?? 0
  // Carica prezzi dal server
  try {
    const token = await authStore.user.getIdToken()
    const data  = await ($fetch('/api/negozio/config', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { prezzi: Record<string, unknown> }
    prezzi.value = data.prezzi
  } catch {
    // Usa default
    prezzi.value = {
      beni: {
        pack_sfida:  { kisses: 50,  label: '🎁 Pack Sfida',   descrizione: '+1 pacchetto sfida' },
        energia:     { kisses: 20,  label: '⚡ Energia',      descrizione: 'Ricarica 10 unità energia' },
        pass_hard:   { kisses: 500, label: '🔞 Hard Pass',    descrizione: 'Sblocca carte Hot' },
        trade_pass:  { kisses: 100, label: '🔄 Trade Pass',   descrizione: 'Scambi illimitati per sempre' },
      },
      tagli_kisses: [
        { id: 'xs', kisses: 100,  bonus: '',              price_eur: '0.99' },
        { id: 'sm', kisses: 300,  bonus: '+30 Kisses',    price_eur: '2.49' },
        { id: 'md', kisses: 600,  bonus: '+80 Kisses',    price_eur: '3.99' },
        { id: 'lg', kisses: 1400, bonus: '+200 Kisses',   price_eur: '7.99' },
      ],
    }
  }
  caricato.value = true
})

function flash(testo: string, colore = '#06d6a0') {
  notif.value = { testo, colore }
  setTimeout(() => (notif.value = null), 2500)
}

async function acquistaBene(beneId: string) {
  if (!authStore.user) return
  const costo = (prezzi.value?.beni as Record<string, { kisses: number }>)?.[beneId]?.kisses ?? 0
  if ((kisses.value ?? 0) < costo) {
    flash(`Kisses insufficienti — servono ${costo}`, '#ff4d4d')
    return
  }
  try {
    const token    = await authStore.user.getIdToken()
    const endpoint = beneId === 'pack_sfida'  ? '/api/kisses/buy-pack'
                   : beneId === 'energia'     ? '/api/kisses/buy-energia'
                   : beneId === 'pass_hard'   ? '/api/kisses/buy-passhard'
                   : beneId === 'trade_pass'  ? '/api/kisses/buy-tradepass'
                   : null
    if (!endpoint) return
    const data = await ($fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })) as { kissesCost: number; newKisses?: number }
    kisses.value -= data.kissesCost
    gameStore.setKisses(kisses.value)
    const label = (prezzi.value?.beni as Record<string, { label: string }>)?.[beneId]?.label ?? beneId
    flash(`✓ ${label} acquistato!`)
  } catch (e: unknown) {
    flash((e as { data?: { message?: string } })?.data?.message ?? 'Errore acquisto', '#ff4d4d')
  }
}
</script>

<template>
  <div class="negozio-root">

    <!-- Caricamento -->
    <AppLoading v-if="!caricato" fullscreen />

    <template v-else>
      <!-- Header Pocket-style -->
      <header class="negozio-header">
        <div class="negozio-header__left">
          <button class="negozio-btn-back" @click="router.push('/gioco')">← Gioco</button>
          <span class="negozio-title">🛒 Negozio</span>
        </div>
        <div class="negozio-kisses-pill">
          <span style="color:var(--theme-accent-pink)">💋</span>
          <span class="negozio-kisses-val">{{ kisses }}</span>
        </div>
      </header>

      <!-- Toast notifica -->
      <Transition name="fade">
        <div v-if="notif" class="negozio-toast"
             :style="{ background: `${notif.colore}18`, border: `1px solid ${notif.colore}40`, color: notif.colore }">
          {{ notif.testo }}
        </div>
      </Transition>

      <div class="negozio-content">

        <!-- Beni con Kisses -->
        <section>
          <SectionTitle>Acquista con Kisses</SectionTitle>
          <div class="negozio-beni-list">
            <div
              v-for="(bene, id) in (prezzi?.beni as Record<string, {kisses: number; label: string; descrizione?: string}>)"
              :key="id"
              class="negozio-bene-row"
            >
              <div class="negozio-bene-info">
                <span class="negozio-bene-emoji">{{ id === 'pack_sfida' ? '🎁' : id === 'energia' ? '⚡' : id === 'pass_hard' ? '🔞' : '🔄' }}</span>
                <div>
                  <div class="negozio-bene-label">{{ bene.label }}</div>
                  <div class="negozio-bene-desc">{{ bene.descrizione }}</div>
                </div>
              </div>
              <div class="negozio-bene-cta">
                <span class="negozio-bene-price">💋 {{ bene.kisses }}</span>
                <button
                  class="negozio-btn-buy"
                  :class="kisses >= bene.kisses ? '' : 'negozio-btn-buy--disabled'"
                  :disabled="kisses < bene.kisses"
                  @click="acquistaBene(id)"
                >
                  {{ kisses >= bene.kisses ? 'Acquista' : `Mancano ${bene.kisses - kisses}` }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Divider rainbow -->
        <div class="negozio-divider" />

        <!-- Ricarica Kisses -->
        <section>
          <SectionTitle>Ricarica Kisses</SectionTitle>
          <p class="negozio-section-desc">Acquista Kisses con PayPal e usali per beni di gioco e Pesca Misteriosa</p>

          <div class="negozio-tagli-grid">
            <div
              v-for="taglio in (prezzi?.tagli_kisses as any[])"
              :key="taglio.id"
              class="negozio-taglio-card"
            >
              <div class="negozio-taglio-kisses">
                <span style="color:var(--theme-accent-pink)">💋</span>
                <span class="negozio-taglio-num">{{ taglio.kisses }}</span>
              </div>
              <div class="negozio-taglio-price">€{{ taglio.price_eur }}</div>
              <div v-if="taglio.bonus" class="negozio-taglio-bonus">{{ taglio.bonus }}</div>
            </div>
          </div>

          <p class="negozio-paypal-note">Pagamento sicuro via PayPal</p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.negozio-root {
  min-height: 100vh;
  background: var(--bg-base);
  padding-bottom: 40px;
}

/* Header */
.negozio-header {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--theme-header);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-float);
}
.negozio-header__left { display: flex; align-items: center; gap: 12px; }
.negozio-btn-back {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-pill);
  padding: 6px 12px; cursor: pointer;
  transition: background 0.15s;
}
.negozio-btn-back:hover { background: var(--surface-raised); }
.negozio-title {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 15px; font-weight: 900;
  color: var(--text-primary); letter-spacing: -0.01em;
}
.negozio-kisses-pill {
  display: flex; align-items: center; gap: 5px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  box-shadow: var(--shadow-float);
}
.negozio-kisses-val {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 14px; font-weight: 900;
  color: var(--theme-accent-pink);
}

/* Toast */
.negozio-toast {
  position: fixed; top: 68px; left: 50%; transform: translateX(-50%);
  z-index: 50; padding: 8px 16px; border-radius: 12px;
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
  white-space: nowrap;
}

/* Content */
.negozio-content {
  max-width: 480px; margin: 0 auto;
  padding: 20px 16px;
  display: flex; flex-direction: column; gap: 24px;
}

/* Beni list */
.negozio-beni-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.negozio-bene-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: var(--shadow-float);
}
.negozio-bene-info { display: flex; align-items: center; gap: 12px; }
.negozio-bene-emoji { font-size: 22px; }
.negozio-bene-label {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 13px; font-weight: 800;
  color: var(--text-primary);
}
.negozio-bene-desc {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 11px; color: var(--text-secondary);
  margin-top: 2px;
}
.negozio-bene-cta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.negozio-bene-price {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; font-weight: 800;
  color: var(--theme-accent-pink);
}
.negozio-btn-buy {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
  color: var(--text-on-accent);
  background: var(--accent);
  border: none; border-radius: var(--radius-pill);
  padding: 7px 14px; cursor: pointer;
  box-shadow: var(--shadow-float);
  transition: transform 0.15s, background 0.15s;
}
.negozio-btn-buy:hover:not(:disabled) { background: var(--accent-strong); transform: translateY(-1px); }
.negozio-btn-buy--disabled {
  background: var(--surface-sunken);
  color: var(--text-tertiary);
  cursor: not-allowed;
  box-shadow: none;
}

/* Divider */
.negozio-divider {
  height: 2px;
  background: var(--rainbow-line);
  opacity: 0.5;
  border-radius: 999px;
}

/* Sezione Kisses */
.negozio-section-desc {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; color: var(--text-secondary);
  margin: 8px 0 16px; line-height: 1.5;
}
.negozio-tagli-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px; margin-bottom: 16px;
}
.negozio-taglio-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 14px 12px; text-align: center;
  box-shadow: var(--shadow-float);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.negozio-taglio-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-p); }
.negozio-taglio-kisses {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  margin-bottom: 4px;
}
.negozio-taglio-num {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 18px; font-weight: 900;
  color: var(--text-primary);
}
.negozio-taglio-price {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 14px; font-weight: 800;
  color: var(--accent);
}
.negozio-taglio-bonus {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 10px; color: var(--success);
  margin-top: 3px; font-weight: 700;
}
.negozio-paypal-note {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 11px; color: var(--text-tertiary);
  text-align: center;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
