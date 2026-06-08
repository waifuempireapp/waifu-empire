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
  <div class="min-h-screen" style="background:rgb(6,3,15);padding-bottom:40px">

    <!-- Caricamento -->
    <div v-if="!caricato" class="min-h-screen flex items-center justify-center">
      <div class="text-4xl text-pink-400 font-orbitron">♥</div>
    </div>

    <template v-else>
      <!-- Header -->
      <header class="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
              style="background:rgba(6,3,15,0.95);backdrop-filter:blur(20px);
                     border-bottom:1px solid rgba(245,166,35,0.12)">
        <div class="flex items-center gap-3">
          <button
            class="border rounded-lg text-amber-400 font-orbitron text-[9px] px-3 py-1.5 cursor-pointer bg-transparent"
            style="border-color:rgba(245,166,35,0.3)"
            @click="router.push('/gioco')"
          >← GIOCO</button>
          <span class="font-orbitron text-sm font-black text-amber-400 tracking-widest">🛒 NEGOZIO</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-pink-400 text-sm">💋</span>
          <span class="font-orbitron text-sm font-black text-pink-400">{{ kisses }}</span>
        </div>
      </header>

      <!-- Notifica -->
      <Transition name="fade">
        <div v-if="notif" class="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-xs font-orbitron tracking-wider"
             :style="{ background: `${notif.colore}15`, border: `1px solid ${notif.colore}40`, color: notif.colore }">
          {{ notif.testo }}
        </div>
      </Transition>

      <div class="max-w-[480px] mx-auto px-4 py-5 flex flex-col gap-6">

        <!-- Beni con Kisses -->
        <section>
          <div class="font-orbitron text-[11px] tracking-widest mb-3" style="color:rgba(238,232,220,0.4)">
            ACQUISTA CON KISSES
          </div>
          <div class="flex flex-col gap-2.5">
            <div
              v-for="(bene, id) in (prezzi?.beni as Record<string, {kisses: number; label: string; descrizione?: string}>)"
              :key="id"
              class="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5"
              style="background:rgba(6,3,15,0.6);border:1px solid rgba(245,166,35,0.18)"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">{{ id === 'pack_sfida' ? '🎁' : id === 'energia' ? '⚡' : id === 'pass_hard' ? '🔞' : '🔄' }}</span>
                <div>
                  <div class="font-orbitron text-xs font-bold text-amber-400">{{ bene.label }}</div>
                  <div class="font-fredoka text-[10px] mt-0.5" style="color:rgba(238,232,220,0.45)">{{ bene.descrizione }}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-orbitron text-xs text-pink-400 font-bold">💋 {{ bene.kisses }}</span>
                <button
                  class="font-orbitron text-[9px] px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                  :class="kisses >= bene.kisses
                    ? 'text-amber-400 hover:opacity-80'
                    : 'opacity-30 cursor-not-allowed'"
                  :style="kisses >= bene.kisses
                    ? 'background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.4)'
                    : 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.25)'"
                  @click="acquistaBene(id)"
                >
                  {{ kisses >= bene.kisses ? 'ACQUISTA' : `MANCANO ${bene.kisses - kisses}` }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div class="h-px" style="background:linear-gradient(90deg,transparent,rgba(255,77,158,0.3),transparent)" />

        <!-- Ricarica Kisses con PayPal -->
        <section>
          <div class="font-orbitron text-[11px] tracking-widest mb-1" style="color:rgba(238,232,220,0.4)">
            RICARICA KISSES
          </div>
          <div class="font-fredoka text-xs mb-4" style="color:rgba(238,232,220,0.35)">
            Acquista Kisses con PayPal e usali per beni di gioco e Pesca Misteriosa
          </div>

          <!-- Taglie Kisses -->
          <div class="grid grid-cols-2 gap-2.5 mb-4">
            <div
              v-for="taglio in (prezzi?.tagli_kisses as any[])"
              :key="taglio.id"
              class="p-3 rounded-xl text-center cursor-pointer transition-all"
              style="background:rgba(6,3,15,0.6);border:2px solid rgba(255,77,158,0.2)"
            >
              <div class="flex items-center justify-center gap-1 mb-1">
                <span class="text-pink-400 text-sm">💋</span>
                <span class="font-orbitron text-sm text-amber-50 font-black">{{ taglio.kisses }}</span>
              </div>
              <div class="font-orbitron text-xs text-amber-400 font-bold">€{{ taglio.price_eur }}</div>
              <div v-if="taglio.bonus" class="text-[9px] text-green-400 mt-0.5 font-fredoka">{{ taglio.bonus }}</div>
            </div>
          </div>

          <div class="font-fredoka text-xs text-center" style="color:rgba(238,232,220,0.4)">
            Pagamento sicuro via PayPal
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
