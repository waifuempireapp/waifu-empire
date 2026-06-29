<!-- ============================================================
  Pagina di login: accesso con Google o email/password.
  Dopo il login verifica il profilo Firestore e reindirizza
  a /gioco o /onboarding.
  Equivalente di src/app/login/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import {
  signInWithPopup, signInWithRedirect,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider,
} from 'firebase/auth'
import { getFirebaseAuth }  from '~/utils/firebase'
import { useAuthStore }     from '~/stores/auth'
import { getUserProfile }   from '~/utils/firestoreService'

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
    if (!loggedIn || !authStore.user) return
    try {
      const profilo = await getUserProfile(authStore.user.uid)
      router.replace(profilo ? '/gioco' : '/onboarding')
    } catch {
      // Profilo non leggibile (nuovo progetto, regole Firestore, ecc.)
      // L'utente è autenticato: manda all'onboarding per creare il profilo
      router.replace('/onboarding')
    }
  },
  { immediate: true },
)

async function loginGoogle() {
  errore.value = ''
  busy.value   = true
  try {
    const auth     = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    // Desktop: popup — Mobile: redirect se popup bloccato
    try {
      await signInWithPopup(auth, provider)
    } catch (popupErr: unknown) {
      const c = (popupErr as { code?: string }).code
      if (c === 'auth/popup-blocked' || c === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, provider)
        return
      }
      throw popupErr
    }
  } catch (e: unknown) {
    errore.value = traduciErrore((e as { code?: string }).code)
  } finally {
    busy.value = false
  }
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

const { t } = useI18n()

function traduciErrore(code?: string): string {
  const m: Record<string, string> = {
    'auth/invalid-email':        t('login.error_invalid_email'),
    'auth/user-not-found':       t('login.error_user_not_found'),
    'auth/wrong-password':       t('login.error_wrong_password'),
    'auth/email-already-in-use': t('login.error_email_in_use'),
    'auth/weak-password':        t('login.error_weak_password'),
    'auth/popup-closed-by-user':  t('login.error_popup_closed'),
    'auth/popup-blocked':         t('login.error_popup_closed'),
    'auth/unauthorized-domain':   t('login.error_generic', { code: 'unauthorized-domain' }),
    'auth/network-request-failed': t('login.error_network'),
  }
  return m[code ?? ''] || t('login.error_generic', { code })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4" style="background: var(--theme-bg);">
    <!-- Card -->
    <div class="fade-up w-full max-w-md rounded-2xl p-7"
         style="background:var(--theme-surface);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
                border:1px solid var(--theme-border);border-radius:20px;
                box-shadow:0 0 40px var(--theme-shadow)">

      <!-- Header -->
      <div class="text-center mb-6">
        <img src="~/assets/images/New_Logo.png" alt="Impero delle Waifu" class="w-80 h-auto mx-auto mb-3" style="mask-image: radial-gradient(ellipse 90% 85% at 50% 50%, black 68%, transparent 92%); -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 50%, black 68%, transparent 92%);" />
        <div class="text-xs tracking-widest" style="color:var(--theme-accent);">
          {{ modo === 'login' ? $t('login.title_login') : $t('login.title_register') }}
        </div>
      </div>

      <!-- Pulsante Google -->
      <button
        class="w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2.5
               font-medium text-sm cursor-pointer
               transition-colors"
        style="background:var(--theme-shimmer);border:1px solid var(--theme-border);border-radius:12px;color:var(--theme-text);"
        :disabled="busy"
        @click="loginGoogle"
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.7 39.7 16.3 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.6l6.2 5.2C42 35.7 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"/>
        </svg>
        {{ $t('login.google_btn') }}
      </button>

      <!-- Separatore -->
      <div class="flex items-center gap-3 my-5">
        <div class="flex-1 h-px" style="background:var(--theme-border)" />
        <span class="text-xs tracking-widest" style="color:var(--theme-text-3)">{{ $t('login.or_separator') }}</span>
        <div class="flex-1 h-px" style="background:var(--theme-border)" />
      </div>

      <!-- Form email/password -->
      <form @submit="loginEmail">
        <input
          v-model="email"
          type="email" required
          placeholder="email"
          class="w-full px-3 py-3 mb-2.5 rounded-lg text-sm font-sans outline-none transition-colors"
          style="background:var(--theme-input-bg);border:1px solid var(--theme-border);border-radius:12px;color:var(--theme-text);"
        />
        <input
          v-model="password"
          type="password" required
          placeholder="password"
          minlength="6"
          class="w-full px-3 py-3 mb-2.5 rounded-lg text-sm font-sans outline-none transition-colors"
          style="background:var(--theme-input-bg);border:1px solid var(--theme-border);border-radius:12px;color:var(--theme-text);"
        />

        <div v-if="errore" class="text-red-400 text-xs py-1.5 text-center">
          ⚠ {{ errore }}
        </div>

        <button
          type="submit"
          :disabled="busy"
          class="w-full py-3 mt-1.5 font-semibold text-sm tracking-widest cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
          style="background:var(--theme-accent);color:#F0ECF8;border-radius:50px;border:none;font-family:'Fredoka',sans-serif;letter-spacing:0.15em;box-shadow:0 8px 24px var(--theme-shadow);"
        >
          {{ busy ? '…' : (modo === 'login' ? $t('login.submit_login') : $t('login.submit_register')) }}
        </button>
      </form>

      <!-- Cambio modalità -->
      <div class="text-center mt-3 text-xs" style="color:var(--theme-text-2)">
        <span v-if="modo === 'login'">
          {{ $t('login.no_account') }}
          <button class="text-amber-400 underline cursor-pointer bg-transparent border-0 font-sans text-xs"
                  @click="modo = 'register'; errore = ''">
            {{ $t('login.register_link') }}
          </button>
        </span>
        <span v-else>
          {{ $t('login.has_account') }}
          <button class="text-amber-400 underline cursor-pointer bg-transparent border-0 font-sans text-xs"
                  @click="modo = 'login'; errore = ''">
            {{ $t('login.login_link') }}
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
