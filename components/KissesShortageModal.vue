<!-- Modal acquisto Kisses quando il saldo è insufficiente. Porta KissesShortageModal.jsx -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

interface Taglio { id: string; kisses: number; bonus?: number; price_eur: string; label: string }

const TAGLI_DEFAULT: Taglio[] = [
  { id: 'xs', kisses: 100,  bonus: 0,   price_eur: '0.99', label: '100 Kisses' },
  { id: 'sm', kisses: 300,  bonus: 30,  price_eur: '2.49', label: '300 Kisses' },
  { id: 'md', kisses: 600,  bonus: 80,  price_eur: '3.99', label: '600 Kisses' },
  { id: 'lg', kisses: 1400, bonus: 200, price_eur: '7.99', label: '1400 Kisses' },
]

const props = withDefaults(defineProps<{
  missingKisses?: number
  currentKisses?: number
  tagli?: Taglio[]
}>(), {
  missingKisses: 0,
  currentKisses: 0,
})

const emit = defineEmits<{
  success: [newKisses: number]
  cancel:  []
}>()

const authStore  = useAuthStore()
const config     = useRuntimeConfig()
const lista      = computed(() => props.tagli || TAGLI_DEFAULT)
const minTaglio  = computed(() => lista.value.find(t => t.kisses >= props.missingKisses) || lista.value[lista.value.length - 1])

const selectedId  = ref(minTaglio.value?.id ?? 'xs')
const stato        = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const errMsg       = ref('')
const containerRef = ref<HTMLElement | null>(null)
const ppRendered   = ref(false)

const taglioScelto = computed(() => lista.value.find(t => t.id === selectedId.value) || minTaglio.value)

// Carica SDK PayPal e renderizza i bottoni
async function renderPayPal() {
  if (!containerRef.value || !(window as any).paypal || ppRendered.value) return
  ppRendered.value = true
  containerRef.value.innerHTML = ''

  ;(window as any).paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 40 },
    createOrder: async () => {
      const res = await $fetch<{ orderID: string }>('/api/paypal/create-order-kisses', {
        method: 'POST',
        body: { taglioId: taglioScelto.value?.id },
      })
      return res.orderID
    },
    onApprove: async (data: any) => {
      stato.value = 'loading'
      try {
        const token = await authStore.user?.getIdToken()
        const result = await $fetch<{ kissesAdded?: number }>('/api/paypal/capture-order-kisses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { orderID: data.orderID, uid: authStore.user?.uid, taglioId: taglioScelto.value?.id },
        })
        stato.value = 'success'
        const added = result.kissesAdded ?? taglioScelto.value?.kisses ?? 0
        emit('success', (props.currentKisses ?? 0) + added)
      } catch (e: any) {
        errMsg.value = e?.message ?? 'Errore pagamento'
        stato.value = 'error'
      }
    },
    onError: (err: any) => {
      console.error('[PayPal modal]', err)
      errMsg.value = 'Errore PayPal. Riprova.'
      stato.value = 'error'
    },
    onCancel: () => { /* utente ha chiuso PayPal */ },
  }).render(containerRef.value)
}

function loadSDK() {
  const clientId = (config.public as any).paypalClientId
  if (!clientId) { errMsg.value = 'Configurazione PayPal mancante.'; stato.value = 'error'; return }
  const existing = document.getElementById('paypal-sdk-modal')
  if (existing && (window as any).paypal) { ppRendered.value = false; renderPayPal(); return }
  const script    = document.createElement('script')
  script.id       = 'paypal-sdk-modal'
  script.src      = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`
  script.onload   = () => renderPayPal()
  script.onerror  = () => { errMsg.value = 'Impossibile caricare PayPal.'; stato.value = 'error' }
  document.head.appendChild(script)
}

// Re-renderizza quando cambia il taglio
watch(selectedId, () => { ppRendered.value = false; if ((window as any).paypal) renderPayPal() })

onMounted(loadSDK)
onUnmounted(() => { document.getElementById('paypal-sdk-modal')?.remove() })
</script>

<template>
  <div
    style="position:fixed;inset:0;z-index:400;background:rgba(6,3,15,0.97);backdrop-filter:blur(20px);
           display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:20px"
  >
    <!-- Stato successo -->
    <div
      v-if="stato === 'success'"
      class="fade-up"
      style="text-align:center;gap:16px;display:flex;flex-direction:column;align-items:center"
    >
      <div style="font-size:48px">💖</div>
      <div style="font-family:'Unbounded',sans-serif;font-size:14px;color:#00e676;letter-spacing:2px">KISSES ACQUISTATI!</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(238,232,220,0.7)">
        +{{ taglioScelto?.kisses }} Kisses aggiunti al tuo saldo
      </div>
    </div>

    <!-- Stato normale/error/loading -->
    <template v-else>
      <!-- Intestazione -->
      <div style="text-align:center">
        <div style="font-family:'Unbounded',sans-serif;font-size:12px;letter-spacing:3px;color:#ff4d9e;margin-bottom:6px">
          KISSES INSUFFICIENTI
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(238,232,220,0.55)">
          Ti mancano <strong style="color:#ff4d9e">{{ missingKisses }}</strong> Kisses per completare questa azione.
          Ricarica subito per proseguire.
        </div>
      </div>

      <!-- Selezione taglio -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:400px">
        <div
          v-for="t in lista" :key="t.id"
          @click="selectedId = t.id"
          :style="{
            width: '90px', padding: '10px 8px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
            background: selectedId === t.id ? 'rgba(255,77,158,0.18)' : 'rgba(6,3,15,0.7)',
            border: `2px solid ${selectedId === t.id ? '#ff4d9e' : t.kisses >= missingKisses ? 'rgba(255,77,158,0.25)' : 'rgba(255,255,255,0.1)'}`,
            transition: 'all 0.2s',
            boxShadow: selectedId === t.id ? '0 0 14px rgba(255,77,158,0.4)' : 'none',
          }"
        >
          <div style="display:flex;align-items:center;justify-content:center;gap:3px;margin-bottom:4px">
            <KissesIcon :size="12" />
            <span :style="{ fontFamily:`'Unbounded',sans-serif`, fontSize:'11px', color: selectedId === t.id ? '#ff4d9e' : '#eedcd4', fontWeight:700 }">
              {{ t.kisses }}
            </span>
          </div>
          <div style="font-family:'Unbounded',sans-serif;font-size:10px;color:#f5a623;font-weight:700">€{{ t.price_eur }}</div>
          <div v-if="(t.bonus ?? 0) > 0" style="font-size:8px;color:#00e676;margin-top:2px;font-family:'DM Sans',sans-serif">
            +{{ t.bonus }} bonus
          </div>
        </div>
      </div>

      <!-- Area PayPal / stato -->
      <div v-if="stato === 'error'" style="color:#ff4d4d;font-family:'Unbounded',sans-serif;font-size:10px;text-align:center">
        {{ errMsg }}
      </div>
      <div v-else-if="stato === 'loading'" style="color:rgba(238,232,220,0.5);font-family:'Unbounded',sans-serif;font-size:10px">
        Completamento acquisto…
      </div>
      <div v-else style="width:100%;max-width:320px">
        <div ref="containerRef" style="min-height:45px" />
      </div>

      <!-- Annulla -->
      <button
        @click="emit('cancel')"
        style="background:none;border:1px solid rgba(255,255,255,0.15);border-radius:8px;
               color:rgba(238,232,220,0.4);font-family:'Unbounded',sans-serif;
               font-size:9px;padding:8px 20px;cursor:pointer;letter-spacing:1px"
      >ANNULLA</button>
    </template>
  </div>
</template>
