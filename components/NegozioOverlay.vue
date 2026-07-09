<!-- ============================================================
  Overlay Negozio — funzionale.
  · Beni con Kisses: pack sfida (x1 / x10), energia, Hard Pass, Trade Pass
    → endpoint /api/kisses/buy-*
  · Ricarica Kisses con denaro reale via PayPal (tagli xs/sm/md/lg)
    → /api/paypal/create-order-kisses + capture-order-kisses
  Prezzi da /api/negozio/config (Firestore config/prezzi + default).
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { ProfiloUtente } from '~/types/game'

const props = defineProps<{ profilo: ProfiloUtente | null }>()
const emit = defineEmits<{
  kissesUpdate:  [kisses: number]
  profileUpdate: [patch: Record<string, unknown>]
  close:         []
}>()

const authStore = useAuthStore()
const config    = useRuntimeConfig()
const { t }     = useI18n()

const C = {
  gold: '#f5c560', sakura: '#ff85b6', ok: '#58e0a3', err: '#ff5b6c',
}
const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
}

// Kisses locali: partono dal profilo, si aggiornano dopo ogni acquisto
const kisses = ref<number>(Number(props.profilo?.kisses ?? 0))
watch(() => props.profilo?.kisses, (k) => { if (typeof k === 'number') kisses.value = k })

const hasHardPass  = computed(() => !!(props.profilo as any)?.hardPass)
const hasTradePass = computed(() => !!(props.profilo as any)?.tradePass || !!props.profilo?.tradePassActive)

interface Taglio { id: string; kisses: number; bonus?: number; price_eur: string; label?: string }
const beni  = ref<Record<string, { kisses: number }>>({})
const tagli = ref<Taglio[]>([])
const caricato = ref(false)
const busy     = ref<string | null>(null)
const notif    = ref<{ testo: string; colore: string } | null>(null)

function flash(testo: string, colore = C.ok) {
  notif.value = { testo, colore }
  setTimeout(() => { notif.value = null }, 2600)
}

// ── Catalogo beni (metadati UI) ──────────────────────────────
const BENI_META: Record<string, { emoji: string; titleKey: string; descKey: string }> = {
  pack_sfida:    { emoji: '🎁', titleKey: 'shop.item_challenge_pack',    descKey: 'shop.item_challenge_pack_desc' },
  pack_sfida_10: { emoji: '📦', titleKey: 'shop.item_challenge_pack_10', descKey: 'shop.item_challenge_pack_10_desc' },
  energia:       { emoji: '⚡', titleKey: 'shop.item_energy',            descKey: 'shop.item_energy_desc' },
  pass_hard:     { emoji: '🔞', titleKey: 'shop.item_hard_pass',         descKey: 'shop.item_hard_pass_desc' },
  trade_pass:    { emoji: '🔄', titleKey: 'shop.item_trade_pass',        descKey: 'shop.item_trade_pass_desc' },
}
const beniOrder = ['pack_sfida', 'pack_sfida_10', 'energia', 'pass_hard', 'trade_pass']
const beniList = computed(() =>
  beniOrder
    .filter(id => beni.value[id])
    .map(id => ({ id, kisses: beni.value[id].kisses, ...BENI_META[id] }))
    // Pass già posseduti: nascosti
    .filter(b => !(b.id === 'pass_hard' && hasHardPass.value) && !(b.id === 'trade_pass' && hasTradePass.value)),
)

onMounted(async () => {
  try {
    const data = await ($fetch('/api/negozio/config')) as { prezzi: { beni: Record<string, { kisses: number }>; tagli_kisses: Taglio[] } }
    beni.value  = data.prezzi.beni
    tagli.value = data.prezzi.tagli_kisses
  } catch {
    beni.value = {
      pack_sfida: { kisses: 50 }, pack_sfida_10: { kisses: 450 }, energia: { kisses: 20 },
      pass_hard: { kisses: 500 }, trade_pass: { kisses: 100 },
    }
    tagli.value = [
      { id: 'xs', kisses: 100, bonus: 0, price_eur: '0.99' },
      { id: 'sm', kisses: 300, bonus: 30, price_eur: '2.49' },
      { id: 'md', kisses: 600, bonus: 80, price_eur: '3.99' },
      { id: 'lg', kisses: 1400, bonus: 200, price_eur: '7.99' },
    ]
  } finally {
    caricato.value = true
    loadPayPal()
  }
})

// ── Acquisto con Kisses ──────────────────────────────────────
const BENE_ENDPOINT: Record<string, string> = {
  pack_sfida:    '/api/kisses/buy-pack',
  pack_sfida_10: '/api/kisses/buy-pack-10',
  energia:       '/api/kisses/buy-energia',
  pass_hard:     '/api/kisses/buy-passhard',
  trade_pass:    '/api/kisses/buy-tradepass',
}
async function acquistaBene(id: string) {
  if (busy.value) return
  const costo = beni.value[id]?.kisses ?? 0
  if (kisses.value < costo) { flash(t('shop.missing_kisses', { n: costo - kisses.value }), C.err); return }
  const endpoint = BENE_ENDPOINT[id]
  if (!endpoint) return
  busy.value = id
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })) as { kissesCost: number; pacchettiAggiunti?: number }
    kisses.value -= data.kissesCost
    emit('kissesUpdate', kisses.value)
    // Riflette localmente l'effetto del bene sul profilo
    const patch: Record<string, unknown> = { kisses: kisses.value }
    if (id === 'pack_sfida')    patch.pacchettiSfida = ((props.profilo as any)?.pacchettiSfida ?? 0) + 1
    if (id === 'pack_sfida_10') patch.pacchettiSfida = ((props.profilo as any)?.pacchettiSfida ?? 0) + (data.pacchettiAggiunti ?? 10)
    if (id === 'energia')       patch.energia = Math.min(100, (props.profilo?.energia ?? 0) + 10)
    if (id === 'pass_hard')     patch.hardPass = true
    if (id === 'trade_pass')    patch.tradePass = true
    emit('profileUpdate', patch)
    flash('✓ ' + t(BENI_META[id].titleKey))
  } catch (e: any) {
    flash(e?.data?.message ?? t('shop.purchase_error'), C.err)
  } finally {
    busy.value = null
  }
}

// ── Ricarica Kisses con PayPal ───────────────────────────────
const selTaglio    = ref<string>('sm')
const ppRef        = ref<HTMLElement | null>(null)
const ppRendered   = ref(false)
const ppState      = ref<'idle' | 'loading' | 'error'>('idle')
const ppErr        = ref('')
const taglioScelto = computed(() => tagli.value.find(t => t.id === selTaglio.value) ?? tagli.value[0])

function renderPayPal() {
  const paypal = (window as any).paypal
  if (!ppRef.value || !paypal || ppRendered.value) return
  ppRendered.value = true
  ppRef.value.innerHTML = ''
  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 42 },
    createOrder: async () => {
      const res = await ($fetch('/api/paypal/create-order-kisses', {
        method: 'POST', body: { taglioId: taglioScelto.value?.id },
      })) as { orderID: string }
      return res.orderID
    },
    onApprove: async (data: any) => {
      ppState.value = 'loading'
      try {
        const token = await authStore.user?.getIdToken()
        const result = await ($fetch('/api/paypal/capture-order-kisses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { orderID: data.orderID, uid: authStore.user?.uid, taglioId: taglioScelto.value?.id },
        })) as { kissesAdded?: number }
        const added = result.kissesAdded ?? taglioScelto.value?.kisses ?? 0
        kisses.value += added
        emit('kissesUpdate', kisses.value)
        emit('profileUpdate', { kisses: kisses.value })
        ppState.value = 'idle'
        flash('💖 ' + t('modal.kisses_added_msg', { n: added }))
      } catch (e: any) {
        ppErr.value = e?.message ?? t('shop.purchase_error'); ppState.value = 'error'
      }
    },
    onError: (err: any) => { console.error('[PayPal shop]', err); ppErr.value = t('modal.paypal_error'); ppState.value = 'error' },
    onCancel: () => { /* chiuso da PayPal */ },
  }).render(ppRef.value)
}
function loadPayPal() {
  const clientId = (config.public as any).paypalClientId
  if (!clientId) { ppErr.value = t('modal.paypal_config_missing'); ppState.value = 'error'; return }
  if ((window as any).paypal) { ppRendered.value = false; renderPayPal(); return }
  const id = 'paypal-sdk-shop'
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`
  script.onload = () => renderPayPal()
  script.onerror = () => { ppErr.value = t('modal.paypal_loading_error'); ppState.value = 'error' }
  document.head.appendChild(script)
}
watch(selTaglio, () => { ppRendered.value = false; if ((window as any).paypal) renderPayPal() })
onUnmounted(() => { document.getElementById('paypal-sdk-shop')?.remove() })
</script>

<template>
  <div class="neg-overlay" @click.self="emit('close')">
    <div class="neg-panel">
      <!-- Header -->
      <div class="neg-head">
        <span class="neg-title" :style="{ fontFamily: FF.display }">{{ $t('shop.title') }}</span>
        <div class="neg-kisses">
          <span style="color:var(--theme-accent-pink)">💋</span>
          <span :style="{ fontFamily: FF.label, fontWeight: 900, color: 'var(--theme-accent-pink)' }">{{ kisses }}</span>
        </div>
        <button class="neg-close" @click="emit('close')" :style="{ fontFamily: FF.label }">✕</button>
      </div>

      <!-- Toast -->
      <Transition name="fade">
        <div v-if="notif" class="neg-toast"
          :style="{ background: `${notif.colore}20`, border: `1px solid ${notif.colore}55`, color: notif.colore, fontFamily: FF.label }">
          {{ notif.testo }}
        </div>
      </Transition>

      <AppLoading v-if="!caricato" />

      <div v-else class="neg-body">
        <!-- ── Beni con Kisses ── -->
        <div class="neg-section-title" :style="{ fontFamily: FF.label, color: C.sakura }">{{ $t('shop.buy_with_kisses') }}</div>
        <div class="neg-beni">
          <div v-for="b in beniList" :key="b.id" class="neg-bene">
            <span class="neg-bene-emoji">{{ b.emoji }}</span>
            <div class="neg-bene-txt">
              <div class="neg-bene-label" :style="{ fontFamily: FF.body }">{{ $t(b.titleKey) }}</div>
              <div class="neg-bene-desc" :style="{ fontFamily: FF.body }">{{ $t(b.descKey) }}</div>
            </div>
            <button
              class="neg-buy"
              :disabled="kisses < b.kisses || busy === b.id"
              :class="{ 'neg-buy--off': kisses < b.kisses }"
              :style="{ fontFamily: FF.label }"
              @click="acquistaBene(b.id)"
            >
              <template v-if="busy === b.id">…</template>
              <template v-else>💋 {{ b.kisses }}</template>
            </button>
          </div>
        </div>

        <div class="neg-divider" />

        <!-- ── Ricarica Kisses (PayPal) ── -->
        <div class="neg-section-title" :style="{ fontFamily: FF.label, color: C.gold }">{{ $t('shop.recharge_kisses') }}</div>
        <p class="neg-recharge-desc" :style="{ fontFamily: FF.body }">{{ $t('shop.recharge_desc') }}</p>

        <div class="neg-tagli">
          <button
            v-for="tg in tagli" :key="tg.id"
            @click="selTaglio = tg.id"
            class="neg-taglio"
            :class="{ 'neg-taglio--sel': selTaglio === tg.id }"
          >
            <div class="neg-taglio-k">
              <span style="color:var(--theme-accent-pink)">💋</span>
              <span :style="{ fontFamily: FF.display }">{{ tg.kisses }}</span>
            </div>
            <div class="neg-taglio-price" :style="{ fontFamily: FF.label, color: C.gold }">€{{ tg.price_eur }}</div>
            <div v-if="(tg.bonus ?? 0) > 0" class="neg-taglio-bonus" :style="{ fontFamily: FF.body, color: C.ok }">+{{ tg.bonus }} bonus</div>
          </button>
        </div>

        <!-- PayPal -->
        <div class="neg-paypal">
          <div v-if="ppState === 'error'" class="neg-pp-msg" :style="{ color: C.err, fontFamily: FF.label }">{{ ppErr }}</div>
          <div v-else-if="ppState === 'loading'" class="neg-pp-msg" :style="{ fontFamily: FF.label }">{{ $t('modal.completing_purchase') }}</div>
          <div v-show="ppState === 'idle'" ref="ppRef" style="min-height:46px" />
        </div>
        <p class="neg-secure" :style="{ fontFamily: FF.body }">{{ $t('shop.secure_payment') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.neg-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: var(--theme-overlay); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 640px) { .neg-overlay { align-items: center; } }
.neg-panel {
  width: 100%; max-width: 520px; max-height: 92dvh;
  display: flex; flex-direction: column;
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -8px 40px var(--theme-shadow);
  overflow: hidden;
  position: relative;
}
@media (min-width: 640px) { .neg-panel { border-radius: 22px; } }

.neg-head {
  flex-shrink: 0; display: flex; align-items: center; gap: 12px;
  padding: 16px 18px; border-bottom: 1px solid var(--theme-border);
}
.neg-title { font-size: 16px; font-weight: 900; color: var(--theme-text); flex: 1; }
.neg-kisses {
  display: flex; align-items: center; gap: 5px;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  border-radius: 999px; padding: 5px 12px; font-size: 14px;
}
.neg-close {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  color: var(--theme-text-2); font-size: 14px; cursor: pointer;
}

.neg-toast {
  position: absolute; top: 66px; left: 50%; transform: translateX(-50%);
  z-index: 5; padding: 8px 16px; border-radius: 12px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.05em; white-space: nowrap;
}

.neg-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 18px; }

.neg-section-title {
  font-size: 13px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 12px;
}

.neg-beni { display: flex; flex-direction: column; gap: 10px; }
.neg-bene {
  display: flex; align-items: center; gap: 12px;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  border-radius: 14px; padding: 12px 14px;
}
.neg-bene-emoji { font-size: 22px; flex-shrink: 0; }
.neg-bene-txt { flex: 1; min-width: 0; }
.neg-bene-label { font-size: 13px; font-weight: 800; color: var(--theme-text); }
.neg-bene-desc { font-size: 11px; color: var(--theme-text-2); margin-top: 2px; line-height: 1.35; }
.neg-buy {
  flex-shrink: 0; padding: 9px 14px; border-radius: 999px; border: none; cursor: pointer;
  background: var(--theme-accent); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
  min-width: 74px; transition: transform 0.12s, background 0.15s;
}
.neg-buy:hover:not(:disabled) { transform: translateY(-1px); }
.neg-buy--off { background: var(--theme-surface); color: var(--theme-text-3); cursor: not-allowed; border: 1px solid var(--theme-border); }

.neg-divider { height: 2px; background: var(--theme-border-2); opacity: 0.6; border-radius: 999px; margin: 22px 0 18px; }

.neg-recharge-desc { font-size: 12px; color: var(--theme-text-2); margin-bottom: 14px; line-height: 1.5; }
.neg-tagli { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
@media (min-width: 480px) { .neg-tagli { grid-template-columns: repeat(4, 1fr); } }
.neg-taglio {
  background: var(--theme-surface-2); border: 2px solid var(--theme-border);
  border-radius: 14px; padding: 12px 8px; text-align: center; cursor: pointer;
  transition: transform 0.12s, border-color 0.15s, box-shadow 0.15s;
}
.neg-taglio:hover { transform: translateY(-2px); }
.neg-taglio--sel { border-color: var(--theme-accent-pink); box-shadow: 0 0 14px rgba(217,70,168,0.28); }
.neg-taglio-k { display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 17px; font-weight: 900; color: var(--theme-text); margin-bottom: 3px; }
.neg-taglio-price { font-size: 14px; font-weight: 800; }
.neg-taglio-bonus { font-size: 10px; margin-top: 3px; font-weight: 700; }

.neg-paypal { min-height: 46px; margin-bottom: 10px; }
.neg-pp-msg { text-align: center; font-size: 12px; padding: 12px 0; color: var(--theme-text-2); }
.neg-secure { font-size: 11px; color: var(--theme-text-3); text-align: center; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
