<!-- ============================================================
  Pagina di onboarding: creazione del primo profilo utente.
  Assegna nome impero, colore bandiera e pacchetti benvenuto.
  Equivalente di src/app/onboarding/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore }         from '~/stores/auth'
import { getUserProfile, createUserProfile, setCollezione } from '~/utils/firestoreService'

definePageMeta({ middleware: 'auth' })

const authStore    = useAuthStore()
const router       = useRouter()
const nomeImpero   = ref('')
const coloreImpero = ref('#f59e0b')
const busy         = ref(false)

const COLORI = ['#f59e0b', '#ec4899', '#a855f7', '#06d6a0', '#3b82f6', '#ef4444', '#10b981', '#fbbf24']

// Se l'utente ha già un profilo, va direttamente al gioco
onMounted(async () => {
  if (!authStore.user) return
  const profilo = await getUserProfile(authStore.user.uid)
  if (profilo) router.replace('/gioco')
})

async function conferma() {
  if (!nomeImpero.value.trim() || !authStore.user) return
  busy.value = true
  try {
    const uid = authStore.user.uid

    await createUserProfile(uid, {
      nomeImpero:             nomeImpero.value.trim(),
      coloreImpero:           coloreImpero.value,
      email:                  authStore.user.email,
      displayName:            authStore.user.displayName || nomeImpero.value.trim(),
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
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="fade-up w-full max-w-[460px] rounded-2xl p-7"
         style="background:rgba(15,10,30,0.7);backdrop-filter:blur(12px);
                border:1px solid rgba(245,158,11,0.3);
                box-shadow:0 0 40px rgba(168,85,247,0.2)">

      <!-- Header -->
      <div class="text-center mb-5">
        <div class="glow-pulse text-5xl text-amber-400">♛</div>
        <h2 class="font-cinzel tracking-widest text-xl mt-2 mb-0
                   bg-gradient-to-br from-amber-400 via-pink-500 to-purple-500
                   bg-clip-text text-transparent">
          FONDA IL TUO IMPERO
        </h2>
        <p class="text-sm leading-relaxed mt-3" style="color:#d4c5b9">
          Benvenuta/o nell'Impero delle Waifu. Inizia scegliendo il nome del tuo dominio
          e riceverai
          <strong class="text-amber-400">5 pacchetti di benvenuto</strong> senza doppioni.
        </p>
      </div>

      <!-- Nome -->
      <label class="text-xs tracking-widest font-cinzel text-purple-400">
        NOME IMPERO
      </label>
      <input
        v-model="nomeImpero"
        maxlength="30"
        placeholder="Es. Impero del Sol Levante"
        class="w-full px-3 py-3 mt-1.5 mb-4 rounded-lg text-sm text-amber-50
               placeholder-amber-50/30 outline-none box-border
               focus:border-amber-400/60 transition-colors"
        style="background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3)"
      />

      <!-- Colore bandiera -->
      <label class="text-xs tracking-widest font-cinzel text-purple-400 block">
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
        class="w-full py-3 mt-5 rounded-lg font-cinzel font-semibold text-sm
               tracking-widest text-black cursor-pointer
               bg-gradient-to-r from-amber-400 to-pink-500
               hover:opacity-90 transition-opacity disabled:opacity-40"
        @click="conferma"
      >
        {{ busy ? 'CREAZIONE...' : "FONDA L'IMPERO" }}
      </button>
    </div>
  </div>
</template>
