<!-- ============================================================
  Pagina di onboarding: creazione del primo profilo utente.
  Assegna nome impero, colore bandiera e pacchetti benvenuto.
  Equivalente di src/app/onboarding/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore }         from '~/stores/auth'
import { getUserProfile, createUserProfile, setCollezione, isNomeImperoTaken } from '~/utils/firestoreService'

definePageMeta({ middleware: 'auth' })

const authStore    = useAuthStore()
const router       = useRouter()
const nomeImpero   = ref('')
const coloreImpero = ref('#f59e0b')
const busy         = ref(false)
const erroreNome   = ref('')

const COLORI = ['#f59e0b', '#ec4899', '#a855f7', '#06d6a0', '#3b82f6', '#ef4444', '#10b981', '#fbbf24']

// Se l'utente ha già un profilo, va direttamente al gioco
onMounted(async () => {
  if (!authStore.user) return
  const profilo = await getUserProfile(authStore.user.uid)
  if (profilo) router.replace('/gioco')
})

async function conferma() {
  const nome = nomeImpero.value.trim()
  if (!nome || !authStore.user) return
  erroreNome.value = ''
  busy.value = true
  try {
    const taken = await isNomeImperoTaken(nome)
    if (taken) {
      erroreNome.value = 'Questo nome è già preso. Scegline un altro!'
      busy.value = false
      return
    }

    const uid = authStore.user.uid

    await createUserProfile(uid, {
      nomeImpero:             nome,
      coloreImpero:           coloreImpero.value,
      email:                  authStore.user.email,
      displayName:            authStore.user.displayName || nome,
      energia:                10,
      pacchettiOmaggio:       2,
      pacchettiBenvenuto:     5,
      pacchettiSfida:         0,
      ultimaRicaricaEnergia:  new Date(),
      ultimaRicaricaPacchetti: new Date(),
    })

    await setCollezione(uid, { waifu: {}, outfit: {}, pose: {}, equipaggiamento: {}, preset: {} })

    router.replace('/gioco')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4" style="background: var(--theme-bg);">
    <div class="fade-up w-full max-w-[460px] rounded-2xl p-7"
         style="background:var(--theme-surface);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
                border:1px solid var(--theme-border);border-radius:20px;
                box-shadow:0 0 40px var(--theme-shadow)">

      <!-- Header -->
      <div class="text-center mb-5">
        <img src="~/assets/images/New_Logo.png" alt="Impero delle Waifu" class="w-32 h-auto mx-auto" style="mask-image: radial-gradient(ellipse 90% 85% at 50% 50%, black 68%, transparent 92%); -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 50%, black 68%, transparent 92%);" />
        <h2 class="font-cinzel tracking-widest text-xl mt-2 mb-0
                   bg-gradient-to-br from-amber-400 via-pink-500 to-purple-500
                   bg-clip-text text-transparent">
          FONDA IL TUO IMPERO
        </h2>
        <p class="text-sm leading-relaxed mt-3" style="color:var(--theme-text-2)">
          Benvenuta/o nell'Impero delle Waifu. Inizia scegliendo il nome del tuo dominio
          e riceverai
          <strong class="text-amber-400">5 pacchetti di benvenuto</strong> senza doppioni.
        </p>
      </div>

      <!-- Nome -->
      <label class="text-xs tracking-widest font-cinzel" style="color:var(--theme-accent)">
        NOME IMPERO
      </label>
      <input
        v-model="nomeImpero"
        maxlength="30"
        placeholder="Es. Impero del Sol Levante"
        @input="erroreNome = ''"
        class="w-full px-3 py-3 mt-1.5 rounded-lg text-sm outline-none box-border transition-colors"
        :style="`background:var(--theme-input-bg);border:1.5px solid ${erroreNome ? '#ef4444' : 'var(--theme-border)'};border-radius:12px;color:var(--theme-text);margin-bottom:${erroreNome ? '6px' : '16px'};`"
      />
      <p v-if="erroreNome" class="text-xs mb-3" style="color:#ef4444;">⚠ {{ erroreNome }}</p>

      <!-- Colore bandiera -->
      <label class="text-xs tracking-widest font-cinzel block" style="color:var(--theme-accent)">
        COLORE BANDIERA
      </label>
      <div class="flex gap-1.5 mt-2 flex-wrap">
        <button
          v-for="c in COLORI"
          :key="c"
          class="w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110"
          :style="{
            background:  c,
            border:      coloreImpero === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
            boxShadow:  `0 0 12px ${c}80`,
          }"
          @click="coloreImpero = c"
        />
      </div>

      <!-- CTA -->
      <button
        :disabled="!nomeImpero.trim() || busy"
        class="w-full py-3 mt-5 font-cinzel font-semibold text-sm tracking-widest cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
        style="background:var(--theme-accent);color:#F0ECF8;border-radius:50px;border:none;box-shadow:0 8px 24px var(--theme-shadow);"
        @click="conferma"
      >
        {{ busy ? 'CREAZIONE...' : "FONDA L'IMPERO" }}
      </button>
    </div>
  </div>
</template>
