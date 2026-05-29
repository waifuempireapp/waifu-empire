<!-- ============================================================
  Pagina di login: accesso con Google o email/password.
  Dopo il login verifica il profilo Firestore e reindirizza
  a /gioco o /onboarding.
  Equivalente di src/app/login/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { GoogleAuthProvider }  from 'firebase/auth'
import { getFirebaseAuth }     from '~/utils/firebase'
import { useAuthStore }        from '~/stores/auth'
import { getUserProfile }      from '~/utils/firestoreService'

definePageMeta({ middleware: 'guest' })

const router    = useRouter()
const authStore = useAuthStore()

const modo      = ref<'login' | 'register'>('login')
const email     = ref('')
const password  = ref('')
const errore    = ref('')
const busy      = ref(false)

// Se già loggata, reindirizza
watch(
  () => authStore.isLoggedIn,
  async (loggedIn) => {
    if (loggedIn && authStore.user) {
      const profilo = await getUserProfile(authStore.user.uid)
      router.replace(profilo ? '/gioco' : '/onboarding')
    }
  },
  { immediate: true },
)

async function loginGoogle() {
  busy.value = true; errore.value = ''
  try {
    const auth     = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  } catch (e: unknown) {
    errore.value = traduciErrore((e as { code?: string }).code)
  } finally { busy.value = false }
}

async function loginEmail(ev: Event) {
  ev.preventDefault()
  busy.value = true; errore.value = ''
  try {
    const auth = getFirebaseAuth()
    if (modo.value === 'login') {
      await signInWithEmailAndPassword(auth, email.value, password.value)
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value)
    }
  } catch (err: unknown) {
    errore.value = traduciErrore((err as { code?: string }).code)
  } finally { busy.value = false }
}

function traduciErrore(code?: string): string {
  const m: Record<string, string> = {
    'auth/invalid-email':        'Email non valida',
    'auth/user-not-found':       'Utente non trovato',
    'auth/wrong-password':       'Password errata',
    'auth/email-already-in-use': 'Email già registrata',
    'auth/weak-password':        'Password troppo debole (min 6 caratteri)',
    'auth/popup-closed-by-user': 'Login annullato',
    'auth/network-request-failed': 'Errore di rete',
  }
  return m[code ?? ''] || 'Errore: ' + code
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <!-- Card glassmorphism -->
    <div class="fade-up w-full max-w-md rounded-2xl p-7"
         style="background:rgba(15,10,30,0.7);backdrop-filter:blur(12px);
                border:1px solid rgba(245,158,11,0.3);
                box-shadow:0 0 40px rgba(168,85,247,0.2)">

      <!-- Header -->
      <div class="text-center mb-6">
        <img src="~/assets/images/Waifu_Empire_Logo_NO_BG.png" alt="Impero delle Waifu" class="w-80 h-auto mx-auto mb-3" />
        <div class="text-xs tracking-widest text-purple-400">
          ⚜ {{ modo === 'login' ? 'ACCEDI' : 'REGISTRATI' }} ⚜
        </div>
      </div>

      <!-- Pulsante Google -->
      <button
        class="w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2.5
               bg-white text-gray-700 font-medium text-sm cursor-pointer
               hover:bg-gray-50 transition-colors"
        :disabled="busy"
        @click="loginGoogle"
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.7 39.7 16.3 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.6l6.2 5.2C42 35.7 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"/>
        </svg>
        Accedi con Google
      </button>

      <!-- Separatore -->
      <div class="flex items-center gap-3 my-5">
        <div class="flex-1 h-px" style="background:rgba(245,158,11,0.2)" />
        <span class="text-xs opacity-50 tracking-widest">OPPURE</span>
        <div class="flex-1 h-px" style="background:rgba(245,158,11,0.2)" />
      </div>

      <!-- Form email/password -->
      <form @submit="loginEmail">
        <input
          v-model="email"
          type="email" required
          placeholder="email"
          class="w-full px-3 py-3 mb-2.5 rounded-lg text-sm font-sans
                 text-amber-50 placeholder-amber-50/30 outline-none
                 focus:border-amber-400/60 transition-colors"
          style="background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3)"
        />
        <input
          v-model="password"
          type="password" required
          placeholder="password"
          minlength="6"
          class="w-full px-3 py-3 mb-2.5 rounded-lg text-sm font-sans
                 text-amber-50 placeholder-amber-50/30 outline-none
                 focus:border-amber-400/60 transition-colors"
          style="background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3)"
        />

        <div v-if="errore" class="text-red-400 text-xs py-1.5 text-center">
          ⚠ {{ errore }}
        </div>

        <button
          type="submit"
          :disabled="busy"
          class="w-full py-3 mt-1.5 rounded-lg font-semibold text-sm
                 tracking-widest text-black cursor-pointer
                 bg-gradient-to-r from-amber-400 to-pink-500
                 hover:opacity-90 transition-opacity disabled:opacity-50"
          style="font-family:'Fredoka',sans-serif;letter-spacing:0.15em"
        >
          {{ busy ? '...' : (modo === 'login' ? 'ACCEDI' : 'CREA ACCOUNT') }}
        </button>
      </form>

      <!-- Cambio modalità -->
      <div class="text-center mt-3 text-xs" style="color:#d4c5b9">
        <span v-if="modo === 'login'">
          Non hai un account?
          <button class="text-amber-400 underline cursor-pointer bg-transparent border-0 font-sans text-xs"
                  @click="modo = 'register'; errore = ''">
            Registrati
          </button>
        </span>
        <span v-else>
          Hai già un account?
          <button class="text-amber-400 underline cursor-pointer bg-transparent border-0 font-sans text-xs"
                  @click="modo = 'login'; errore = ''">
            Accedi
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
