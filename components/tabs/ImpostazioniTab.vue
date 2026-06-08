<!-- ImpostazioniTab.vue — Tab impostazioni con layout full-page (specchio estetico delle vecchie missioni) -->
<script setup lang="ts">
// Icone Lucide — User, Heart, Globe, Settings, ShoppingCart, LogOut
import { User, Heart, Globe, Settings, ShoppingCart, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import { useGameStore } from '~/stores/game'

const authStore = useAuthStore()
const gameStore = useGameStore()
const router    = useRouter()

// i18n
const { locale, locales, setLocale } = useI18n()
const currentLocale     = computed(() => locale.value)
const availableLocales  = computed(() =>
  (locales.value as { code: string; name: string }[]).map(l => ({ code: l.code, name: l.name }))
)
const currentLocaleName = computed(() => {
  const found = availableLocales.value.find(l => l.code === currentLocale.value)
  return found?.name ?? String(currentLocale.value)
})

// Admin check
const config  = useRuntimeConfig()
const isAdmin = computed(() => {
  const emails = ((config.public as Record<string, unknown>).adminEmails as string || '').split(',').map(e => e.trim().toLowerCase())
  return emails.includes(authStore.user?.email?.toLowerCase() ?? '')
})

// Dropdown lingua
const langDropdownOpen = ref(false)

async function switchLocale(code: string) {
  await setLocale(code as 'en' | 'it' | 'de' | 'es' | 'ja')
  if (typeof window !== 'undefined') localStorage.setItem('waifu_locale', code)
  langDropdownOpen.value = false
}
</script>

<template>
  <!-- Impostazioni — layout full-page verticale, specchio estetico delle vecchie missioni -->
  <div style="display:flex;flex-direction:column;height:100%;padding:16px;gap:14px;overflow:hidden;">

    <!-- Header -->
    <div style="text-align:center;flex-shrink:0;">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;letter-spacing:0.28em;color:rgba(168,85,247,0.7);text-transform:uppercase;font-weight:700;margin-bottom:4px;">
        Impostazioni
      </div>
      <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:24px;font-weight:900;color:#fff;">
        Il tuo profilo
      </div>
    </div>

    <!-- Profilo centrato (avatar + nome + email + lv) -->
    <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px;background:linear-gradient(135deg,rgba(124,58,237,0.08),rgba(168,85,247,0.04));border:1px solid rgba(168,85,247,0.2);border-radius:16px;">
      <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);box-shadow:0 0 22px rgba(124,58,237,0.5);display:grid;place-items:center;">
        <User :size="28" stroke-width="1.5" style="color:#fff;" />
      </div>
      <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:#fff;margin-top:4px;">
        {{ gameStore.profilo?.nomeImpero ?? '—' }}
      </div>
      <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:11px;color:rgba(255,255,255,0.35);">
        {{ authStore.user?.email ?? '' }}
      </div>
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;letter-spacing:0.14em;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2));border:1px solid rgba(168,85,247,0.5);border-radius:999px;padding:4px 14px;color:rgba(245,197,96,0.9);text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;margin-top:2px;">
        LV. {{ gameStore.profilo?.livello ?? 1 }} · {{ gameStore.profilo?.kisses ?? 0 }} <Heart :size="12" stroke-width="1.5" style="color:#ff85b6;" />
      </div>
    </div>

    <!-- Selezione lingua -->
    <div style="flex-shrink:0;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.22em;color:rgba(245,197,96,0.6);text-transform:uppercase;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <Globe :size="13" stroke-width="1.5" /> {{ $t('settings.language.title') }}
      </div>
      <!-- Overlay chiudi dropdown -->
      <div v-if="langDropdownOpen" @click="langDropdownOpen = false" style="position:fixed;inset:0;z-index:499;" />
      <div style="position:relative;z-index:500;">
        <button
          @click="langDropdownOpen = !langDropdownOpen"
          style="width:100%;background:rgba(20,10,40,0.95);border:1.5px solid rgba(168,85,247,0.5);color:#fff;border-radius:14px;padding:12px 44px 12px 18px;font-size:15px;font-family:var(--ff-body,'DM Sans',sans-serif);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:space-between;"
          :style="langDropdownOpen ? 'border-radius:14px 14px 0 0;' : ''"
        >
          <span>{{ currentLocaleName }}</span>
          <span :style="{ transition:'transform 0.2s', transform:langDropdownOpen?'rotate(180deg)':'rotate(0)', color:'rgba(168,85,247,0.85)', fontSize:'18px', lineHeight:1 }">▾</span>
        </button>
        <div v-if="langDropdownOpen" style="position:absolute;top:100%;left:0;right:0;z-index:500;background:rgba(20,10,40,0.98);border:1.5px solid rgba(168,85,247,0.5);border-top:none;border-radius:0 0 14px 14px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.7);">
          <button
            v-for="loc in availableLocales"
            :key="loc.code"
            @click="switchLocale(loc.code)"
            style="width:100%;padding:12px 18px;background:transparent;border:none;border-top:1px solid rgba(255,255,255,0.05);cursor:pointer;text-align:left;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:14px;font-weight:600;display:flex;align-items:center;gap:10px;"
            :style="{ color:loc.code===currentLocale?'#a855f7':'rgba(241,235,255,0.85)', background:loc.code===currentLocale?'rgba(124,58,237,0.18)':'transparent' }"
          >
            <span v-if="loc.code===currentLocale" style="font-size:12px;">✓</span>
            <span v-else style="width:12px;display:inline-block;"></span>
            {{ loc.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Voci menu — stile full-page, non dentro una card -->
    <div style="flex:1;display:flex;flex-direction:column;gap:2px;overflow:hidden;">
      <button
        v-if="isAdmin"
        style="display:flex;align-items:center;gap:14px;padding:14px 4px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;color:#b573ff;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:15px;font-weight:600;width:100%;text-align:left;"
        @click="router.push('/admin')"
      >
        <Settings :size="20" stroke-width="1.5" style="width:26px;flex-shrink:0;" /> {{ $t('settings.admin_panel') }}
      </button>
      <button
        style="display:flex;align-items:center;gap:14px;padding:14px 4px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;color:rgba(241,235,255,0.85);font-family:var(--ff-body,'DM Sans',sans-serif);font-size:15px;font-weight:600;width:100%;text-align:left;"
        @click="gameStore.toggleNegozio(true)"
      >
        <ShoppingCart :size="20" stroke-width="1.5" style="width:26px;flex-shrink:0;" /> {{ $t('settings.shop') }}
      </button>
      <button
        style="display:flex;align-items:center;gap:14px;padding:14px 4px;background:transparent;border:none;cursor:pointer;color:#f87171;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:15px;font-weight:600;width:100%;text-align:left;margin-top:4px;"
        @click="authStore.logout()"
      >
        <LogOut :size="20" stroke-width="1.5" style="width:26px;flex-shrink:0;" /> {{ $t('settings.logout') }}
      </button>
    </div>

  </div>
</template>
