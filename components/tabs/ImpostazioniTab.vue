<!-- ImpostazioniTab.vue — Tab impostazioni con layout full-page (specchio estetico delle vecchie missioni) -->
<script setup lang="ts">
// Icone Lucide — User, Heart, Globe, Settings, ShoppingCart, LogOut, Check
import { User, Heart, Globe, Settings, LogOut, Check, Lock } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import { useGameStore } from '~/stores/game'
import { useAvatar, AVATAR_PRESETS, isAvatarUnlocked } from '~/composables/useAvatar'
import { updateUserProfile } from '~/utils/firestoreService'

const authStore = useAuthStore()
const gameStore = useGameStore()
const router    = useRouter()
const { t } = useI18n()

// Avatar
const { avatarUrl, avatarValue, setAvatar } = useAvatar()
const isColorPreset   = computed(() => !!avatarUrl.value && avatarUrl.value.startsWith('#'))
const isImageUrl      = computed(() => !!avatarUrl.value && (avatarUrl.value.startsWith('http') || avatarUrl.value.startsWith('/')))
const failedPresets   = ref(new Set<string>())
function onPresetImgError(id: string) {
  failedPresets.value = new Set([...failedPresets.value, id])
}

// Icone possedute → sblocco. Le bloccate restano visibili (grigie + lucchetto).
const ownedWaifuIds = computed(() => new Set(Object.keys(gameStore.collezione?.waifu ?? {})))
// Sbloccate prima, bloccate dopo
const orderedPresets = computed(() =>
  [...AVATAR_PRESETS].sort((a, b) => {
    const ua = isAvatarUnlocked(a, ownedWaifuIds.value) ? 0 : 1
    const ub = isAvatarUnlocked(b, ownedWaifuIds.value) ? 0 : 1
    return ua - ub || a.label.localeCompare(b.label)
  }),
)
function selectPreset(preset: typeof AVATAR_PRESETS[number]) {
  if (!isAvatarUnlocked(preset, ownedWaifuIds.value)) return
  setAvatar(preset.id)
}
const initials      = computed(() => {
  const name = gameStore.profilo?.nomeImpero ?? authStore.user?.email ?? ''
  return name.slice(0, 2).toUpperCase() || '?'
})

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

// Dark mode toggle
const { isDark, toggleTheme } = useTheme()

// Dropdown lingua
const langDropdownOpen = ref(false)

async function switchLocale(code: string) {
  await setLocale(code as 'en' | 'it' | 'de' | 'es' | 'ja')
  if (typeof window !== 'undefined') localStorage.setItem('waifu_locale', code) // cache veloce
  langDropdownOpen.value = false
  // Persisti la lingua sul profilo Firebase (legata all'account)
  const uid = authStore.user?.uid
  if (uid) {
    gameStore.aggiornaProfilo({ lingua: code } as never)
    try { await updateUserProfile(uid, { lingua: code }) }
    catch (e) { console.error('[lingua] salvataggio fallito', e) }
  }
}
</script>

<template>
  <!-- Impostazioni — layout full-page verticale, specchio estetico delle vecchie missioni -->
  <div style="display:flex;flex-direction:column;height:100%;padding:8px 16px 16px;gap:14px;overflow-y:auto;overflow-x:visible;">

    <!-- Header -->
    <div style="text-align:center;flex-shrink:0;">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;letter-spacing:0.28em;text-transform:uppercase;font-weight:700;color:var(--theme-accent);">
        Impostazioni
      </div>
    </div>

    <!-- Profilo centrato (avatar + nome + email + lv) -->
    <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px;background:var(--theme-shimmer);border:1px solid var(--theme-border);border-radius:16px;">
      <!-- Avatar circolare (specchia logica GiocoHeader) -->
      <div
        style="width:64px;height:64px;border-radius:50%;border:2.5px solid var(--theme-accent-pink);box-shadow:0 2px 12px var(--theme-shadow);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
        :style="{
          background: isColorPreset
            ? avatarUrl!
            : isImageUrl
              ? 'transparent'
              : 'var(--theme-accent)',
        }"
      >
        <img v-if="isImageUrl" :src="avatarUrl!" alt="" @error="setAvatar(null)" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <span
          v-else-if="!isColorPreset"
          style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:18px;font-weight:800;color:#F0ECF8;user-select:none;line-height:1;"
        >{{ initials }}</span>
      </div>
      <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:800;color:var(--theme-text);margin-top:4px;">
        {{ gameStore.profilo?.nomeImpero ?? '—' }}
      </div>
      <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:11px;color:var(--theme-text-3);">
        {{ authStore.user?.email ?? '' }}
      </div>
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;letter-spacing:0.14em;background:var(--theme-tab-active);border:1px solid var(--theme-border-2);border-radius:999px;padding:4px 14px;color:var(--theme-accent);text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;margin-top:2px;">
        LV. {{ gameStore.profilo?.livello ?? 1 }} · {{ gameStore.profilo?.kisses ?? 0 }} <Heart :size="12" stroke-width="1.5" :style="{ color: 'var(--theme-accent-pink)' }" />
      </div>
    </div>

    <!-- Sezione: Immagine Profilo -->
    <div style="flex-shrink:0;padding-bottom:14px;border-bottom:1px solid var(--theme-border);">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;color:var(--theme-text-2);">
        <User :size="13" stroke-width="1.5" /> Immagine Profilo
      </div>
      <!-- Carosello orizzontale preset -->
      <div style="display:flex;gap:12px;overflow-x:auto;padding:4px 4px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
        <button
          v-for="preset in orderedPresets"
          v-show="!preset.image || !failedPresets.has(preset.id)"
          :key="preset.id"
          @click="selectPreset(preset)"
          :title="isAvatarUnlocked(preset, ownedWaifuIds) ? preset.label : t('avatar.locked_hint', { name: preset.waifuId.toUpperCase() })"
          style="position:relative;flex-shrink:0;width:68px;height:68px;border-radius:50%;padding:0;overflow:hidden;scroll-snap-align:start;transition:border-color 0.15s,box-shadow 0.15s;"
          :style="{
            background: 'var(--theme-surface)',
            cursor: isAvatarUnlocked(preset, ownedWaifuIds) ? 'pointer' : 'not-allowed',
            border: avatarValue === preset.id
              ? '3px solid var(--theme-accent)'
              : '3px solid transparent',
            boxShadow: avatarValue === preset.id
              ? 'inset 0 0 0 2px var(--theme-surface), 0 0 0 1px var(--theme-accent)'
              : 'none',
          }"
        >
          <img
            v-if="preset.image"
            :src="preset.image"
            :alt="preset.label"
            :style="{
              width:'100%',height:'100%',objectFit:'cover',display:'block',
              filter: isAvatarUnlocked(preset, ownedWaifuIds) ? 'none' : 'grayscale(1) brightness(0.45)',
            }"
            @error="onPresetImgError(preset.id)"
          />
          <!-- Lucchetto su icona bloccata -->
          <span
            v-if="!isAvatarUnlocked(preset, ownedWaifuIds)"
            style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"
          >
            <Lock :size="22" stroke-width="2" style="color:rgba(255,255,255,0.9);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));" />
          </span>
          <!-- Spunta su icona selezionata -->
          <span
            v-else-if="avatarValue === preset.id"
            style="position:absolute;bottom:2px;right:2px;width:18px;height:18px;border-radius:50%;background:var(--theme-accent);display:flex;align-items:center;justify-content:center;border:1.5px solid var(--theme-surface);"
          >
            <Check :size="10" stroke-width="3" style="color:#fff;" />
          </span>
        </button>
      </div>
      <!-- Reset avatar -->
      <button
        @click="setAvatar(null)"
        style="background:none;border:none;cursor:pointer;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:12px;font-weight:600;padding:0;text-decoration:underline;text-underline-offset:3px;"
        :style="{ color: avatarUrl ? 'var(--theme-text-2)' : 'var(--theme-text-3)', opacity: avatarUrl ? 1 : 0.4, pointerEvents: avatarUrl ? 'auto' : 'none' }"
      >{{ $t("settings.remove_image") }}</button>
    </div>

    <!-- Dark Mode Toggle -->
    <div style="flex-shrink:0;padding-bottom:14px;border-bottom:1px solid var(--theme-border);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;margin-bottom:3px;display:flex;align-items:center;gap:6px;"
            :style="{ color: isDark ? 'rgba(200,200,210,0.7)' : 'rgba(80,80,120,0.7)' }">
            {{ isDark ? '🌙 Dark Mode' : '☀️ Light Mode' }}
          </div>
          <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:12px;"
            :style="{ color: 'var(--theme-text-2)' }">
            {{ isDark ? $t('settings.theme_dark') : $t('settings.theme_light') }}
          </div>
        </div>
        <!-- Toggle switch iOS-style -->
        <div
          :class="['theme-toggle-track', isDark ? 'theme-toggle-track--on' : 'theme-toggle-track--off']"
          @click="toggleTheme"
        >
          <div :class="['theme-toggle-thumb', isDark ? 'theme-toggle-thumb--on' : 'theme-toggle-thumb--off']" />
        </div>
      </div>
    </div>

    <!-- Selezione lingua -->
    <div style="flex-shrink:0;padding-bottom:14px;border-bottom:1px solid var(--theme-border);">
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;color:var(--theme-text-2);">
        <Globe :size="13" stroke-width="1.5" /> {{ $t('settings.language.title') }}
      </div>
      <!-- Overlay chiudi dropdown — z-index 45: sopra il contenuto tab, sotto navbar (z-50) e FAB (z-60) -->
      <div v-if="langDropdownOpen" @click="langDropdownOpen = false" style="position:fixed;inset:0;z-index:45;" />
      <div style="position:relative;z-index:46;">
        <button
          @click="langDropdownOpen = !langDropdownOpen"
          style="width:100%;background:var(--theme-input-bg);border:1.5px solid var(--theme-border-2);box-shadow:none !important;color:var(--theme-text);border-radius:14px !important;padding:12px 44px 12px 18px;font-size:15px;font-family:var(--ff-body,'DM Sans',sans-serif);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:space-between;"
          :style="langDropdownOpen ? 'border-radius:14px 14px 0 0 !important;' : ''"
        >
          <span>{{ currentLocaleName }}</span>
          <span :style="{ transition:'transform 0.2s', transform:langDropdownOpen?'rotate(180deg)':'rotate(0)', color:'var(--theme-accent)', fontSize:'18px', lineHeight:1 }">▾</span>
        </button>
        <div v-if="langDropdownOpen" style="position:absolute;top:100%;left:0;right:0;z-index:46;background:var(--theme-surface);border:1.5px solid var(--theme-border-2);border-top:none;border-radius:0 0 14px 14px;overflow:hidden;box-shadow:0 12px 32px var(--theme-shadow);">
          <button
            v-for="loc in availableLocales"
            :key="loc.code"
            @click="switchLocale(loc.code)"
            style="width:100%;padding:12px 18px;border:none !important;border-radius:0 !important;box-shadow:none !important;cursor:pointer;text-align:left;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:14px;font-weight:600;display:flex;align-items:center;gap:10px;color:var(--theme-text);"
            :style="{ background: loc.code===currentLocale ? 'color-mix(in srgb, var(--theme-accent) 14%, transparent)' : 'transparent' }"
          >
            <span v-if="loc.code===currentLocale" style="font-size:12px;">✓</span>
            <span v-else style="width:12px;display:inline-block;"></span>
            {{ loc.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Voci menu — stile full-page, non dentro una card -->
    <div style="flex-shrink:0;display:flex;flex-direction:column;gap:2px;">
      <button
        v-if="isAdmin"
        style="display:flex;align-items:center;gap:14px;padding:14px 20px;background:transparent;border:none;cursor:pointer;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:15px;font-weight:600;width:100%;text-align:left;"
        :style="{ color:'var(--theme-accent)', borderBottom:'1px solid var(--theme-border)' }"
        @click="router.push('/admin')"
      >
        <Settings :size="20" stroke-width="1.5" style="width:26px;flex-shrink:0;" /> {{ $t('settings.admin_panel') }}
      </button>
      <!-- Negozio rimosso: ora è nell'header. Restano Admin (sopra) ed Esci (sotto). -->
      <button
        style="display:flex;align-items:center;gap:14px;padding:14px 20px;background:transparent;border:none;cursor:pointer;font-family:var(--ff-body,'DM Sans',sans-serif);font-size:15px;font-weight:700;width:100%;text-align:left;margin-top:4px;"
        :style="{ color: isDark ? '#E74C3C' : '#C0392B' }"
        @click="authStore.logout()"
      >
        <LogOut :size="20" stroke-width="1.5" style="width:26px;flex-shrink:0;" /> {{ $t('settings.logout') }}
      </button>
    </div>

  </div>
</template>

<style scoped>
/* Impostazioni: container trasparente, token per tutto */
div { font-family: var(--ff-body, 'Nunito', sans-serif); }
</style>
