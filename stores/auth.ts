// ============================================================
// STORE: Autenticazione (Pinia)
// Gestisce lo stato dell'utente Firebase: login, logout,
// loading. Sostituisce AuthContext.jsx di React/Next.js.
// ============================================================

import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signOut } from 'firebase/auth'

// Tipo dello stato dello store auth
interface AuthState {
  // Utente Firebase corrente (null se non autenticato)
  user: User | null
  // True durante il primo controllo dello stato di autenticazione
  loading: boolean
  // Listener di cleanup per onAuthStateChanged
  unsubscribe: (() => void) | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: true,
    unsubscribe: null,
  }),

  getters: {
    isLoggedIn: (state): boolean => state.user !== null,
    uid: (state): string => state.user?.uid ?? '',
    email: (state): string => state.user?.email ?? '',
    ready: (state): boolean => !state.loading,
  },

  actions: {
    initAuthListener(auth: import('firebase/auth').Auth) {
      if (this.unsubscribe) this.unsubscribe()
      this.unsubscribe = onAuthStateChanged(auth, (user) => {
        this.user = user
        this.loading = false
      })
    },

    // Esegue il logout e pulisce lo stato
    async logout() {
      const nuxtApp = useNuxtApp()
      const { auth } = nuxtApp.$firebase as { auth: import('firebase/auth').Auth }
      await signOut(auth)
      this.user = null
    },

    // Pulisce il listener quando lo store viene distrutto
    cleanup() {
      if (this.unsubscribe) {
        this.unsubscribe()
        this.unsubscribe = null
      }
    },
  },
})
