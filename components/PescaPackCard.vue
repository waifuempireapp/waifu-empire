<!-- ============================================================
  PescaPackCard — ridisegnato come nel mockup Waifu Drop.
  Card con bordo colorato per stato, avatar lettera, badge NUOVA,
  countdown, carte in scroll orizzontale (silhouette → full art),
  bottone Drop (N Kisses) o VISUALIZZAZIONE COMPLETA.
  Script invariato; solo il template è stato ridisegnato.
  ============================================================ -->
<script setup lang="ts">
const { t } = useI18n()
import type { Collezione } from '~/types/game'
import { ikUrl } from '~/utils/imagekitUrl'

interface CartaPack {
  id:       string
  tipo?:    string
  rarita?:  string
  nome?:    string
  immagine?:string
  hot?:     boolean
}

interface Pack {
  id:           string
  ownerName?:   string
  ownerUid?:    string
  cards?:       CartaPack[]
  alreadyFished?:boolean
  hasHot?:      boolean
  isNuovo?:     boolean
  createdAt?:   string | number
  expiresAt?:   string | number
  dropName?:    string
  isGhost?:     boolean
}

const props = defineProps<{
  pack:         Pack
  kissesCost?:  number
  userKisses?:  number
  collezione?:  Collezione | null
  hasHardPass?: boolean
}>()

const emit = defineEmits<{ pesca: [pack: Pack] }>()

const kissesCost = computed(() => props.kissesCost ?? 10)
const userKisses = computed(() => props.userKisses ?? 0)
const puoPescare  = computed(() => userKisses.value >= kissesCost.value)
const giaFiscata  = computed(() => props.pack.alreadyFished === true)
const cards       = computed(() => props.pack.cards ?? [])

// Pack bloccato: contiene hot content e l'utente non ha Hard Pass
const packBloccato = computed(() => props.pack.hasHot === true && !props.hasHardPass)

const isNuovo = computed(() => {
  if (!props.pack.createdAt) return false
  return Date.now() - new Date(props.pack.createdAt).getTime() < 3 * 60 * 60 * 1000
})

const avatarLetter = computed(() => (props.pack.ownerName ?? '?')[0].toUpperCase())

function getCopie(carta: CartaPack): number {
  if (!props.collezione) return 0
  if (carta.tipo === 'waifu')  return props.collezione.waifu?.[carta.id]?.copie  ?? 0
  if (carta.tipo === 'outfit') return props.collezione.outfit?.[carta.id]?.quantita ?? 0
  if (carta.tipo === 'posa')   return props.collezione.pose?.[carta.id]?.quantita  ?? 0
  return 0
}

function isNew(carta: CartaPack): boolean {
  if (!props.collezione) return false
  if (carta.tipo === 'waifu')  return !props.collezione.waifu?.[carta.id]
  if (carta.tipo === 'outfit') return !props.collezione.outfit?.[carta.id]
  return !props.collezione.pose?.[carta.id]
}

// Colore bordo basato sullo stato del pack
const borderColor = computed(() => {
  if (giaFiscata.value) return 'rgba(167,139,250,0.12)'
  if (isNuovo.value) return 'rgba(255,165,30,0.7)'
  return 'rgba(167,139,250,0.65)'
})
const glowColor = computed(() => {
  if (giaFiscata.value) return 'transparent'
  if (isNuovo.value) return 'rgba(255,165,30,0.20)'
  return 'rgba(167,139,250,0.22)'
})
const avatarGradient = computed(() => {
  if (isNuovo.value) return 'linear-gradient(135deg, #ff8c00, #ff4500)'
  return 'linear-gradient(135deg, #7c3aed, #2563eb)'
})

const RARITY_COLORS: Record<string,string> = {
  comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff',
  leggendario: '#ffc861', immersivo: '#ff7eb6',
}
function rarityColor(r?: string) { return RARITY_COLORS[r ?? ''] ?? '#b4bcc8' }
function rarityBorder(r?: string) {
  const c = RARITY_COLORS[r ?? ''] ?? 'rgba(255,255,255,0.12)'
  return `1.5px solid ${c}66`
}
function rarityGlow(r?: string) {
  const c = RARITY_COLORS[r ?? ''] ?? 'transparent'
  return `0 0 12px ${c}44`
}

// Timer
const remaining = ref('')
let timerInterval: ReturnType<typeof setInterval> | null = null
function calcRemaining() {
  if (!props.pack.expiresAt) return
  const diff = new Date(props.pack.expiresAt).getTime() - Date.now()
  if (diff <= 0) { remaining.value = t('pesca.expired'); return }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  remaining.value = `${h}h ${m}m ${s}s`
}
onMounted(() => {
  if (props.pack.expiresAt) { calcRemaining(); timerInterval = setInterval(calcRemaining, 1000) }
})
onUnmounted(() => { if (timerInterval) clearInterval(timerInterval) })
</script>

<template>
  <!-- Card principale — click sull'intera card avvia la pesca (bottone Drop rimosso) -->
  <div
    @click="!giaFiscata && !packBloccato && emit('pesca', pack)"
    :style="{
    background:'var(--theme-surface)',
    border:       `1.5px solid ${borderColor}`,
    borderRadius: '20px',
    overflow:     'visible',
    position:     'relative',
    zIndex:       1,
    boxShadow:    `0 4px 32px ${glowColor}, 0 1px 0 rgba(167,139,250,0.06) inset`,
    transition:   'all 0.2s',
    opacity:      giaFiscata ? 0.55 : 1,
    cursor:       giaFiscata || packBloccato ? 'default' : 'pointer',
  }">

    <!-- Inner wrapper: clip il contenuto rispettando border-radius senza bloccare il badge esterno -->
    <div :style="{
      borderRadius:'19px', overflow:'hidden', position:'relative',
      filter: packBloccato ? 'blur(6px) brightness(0.4)' : 'none',
      pointerEvents: packBloccato ? 'none' : 'auto',
      userSelect: packBloccato ? 'none' : 'auto',
      transition: 'filter 0.3s',
    }">

    <!-- Overlay Hard Pass: sopra il blur, non interattivo -->
    <div v-if="packBloccato" style="position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:19px;pointer-events:none;">
      <div style="font-size:36px;line-height:1;filter:drop-shadow(0 0 12px rgba(255,140,0,0.7))">🔒</div>
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:14px;font-weight:900;color:#ffa020;letter-spacing:0.14em;text-transform:uppercase;text-align:center;text-shadow:0 0 16px rgba(255,140,0,0.8);">{{ $t('pesca.hard_pass_required') }}</div>
      <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:11px;color:rgba(255,255,255,0.55);text-align:center;padding:0 20px;">{{ $t('pesca.hard_pass_desc') }}</div>
    </div>

    <!-- Overlay PESCATA -->
    <div v-if="giaFiscata" style="position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);pointer-events:none">
      <div style="background:var(--theme-surface);border:1px solid var(--theme-border);border-radius:20px;padding:7px 20px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:2px;color:var(--theme-text-2);font-weight:700">
        🎣 GIÀ PESCATA
      </div>
    </div>

    <!-- ── HEADER ── -->
    <div style="padding:18px 16px 8px;display:flex;align-items:center;gap:12px;">
      <!-- Avatar lettera -->
      <div :style="{
        width:'44px', height:'44px', borderRadius:'50%', flexShrink:0,
        background: avatarGradient,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--ff-display,Unbounded,sans-serif)',
        fontSize:'18px', fontWeight:900, color:'#fff',
        boxShadow: isNuovo ? '0 0 16px rgba(255,140,0,0.55)' : '0 0 10px rgba(124,58,237,0.5)',
      }">{{ avatarLetter }}</div>

      <!-- Nome + timer -->
      <div style="flex:1;min-width:0;">
        <div style="font-family:var(--ff-display,Unbounded,sans-serif);font-size:14px;font-weight:700;color:var(--theme-text);letter-spacing:0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          {{ pack.ownerName }}
        </div>
        <div v-if="pack.expiresAt && !giaFiscata" style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:12px;color:var(--theme-text-3);display:flex;align-items:center;gap:4px;margin-top:3px;">
          <span>⏱</span> TEMPO RIMANENTE: {{ remaining }}
        </div>
      </div>
    </div>

    <!-- Chip espansione: centrato, colore = colore bordo card -->
    <div v-if="pack.dropName" :style="{
      padding: '6px 16px 12px',
    }">
      <div :style="{
        display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
        background: isNuovo ? 'rgba(255,165,30,0.18)' : 'rgba(167,139,250,0.12)',
        border: `1px solid ${isNuovo ? 'rgba(255,165,30,0.55)' : 'rgba(167,139,250,0.55)'}`,
        borderRadius:'999px', padding:'7px 16px', width:'100%', boxSizing:'border-box',
        fontFamily:'var(--ff-label,\'Saira Condensed\',sans-serif)',
        fontSize:'12px',
        color: isNuovo ? '#ffa020' : '#a78bfa',
        fontWeight:700, letterSpacing:'0.1em',
        boxShadow: isNuovo ? '0 0 14px rgba(255,165,30,0.2)' : '0 0 14px rgba(167,139,250,0.2)',
      }">★ {{ pack.dropName }}</div>
    </div>

    <!-- ── CARTE: 2 centrate sopra + 3 sotto ── -->
    <div style="padding:16px 12px 20px;">

      <!-- riga 1: 2 carte, ciascuna larga 1/3, centrate -->
      <div style="display:flex; justify-content:center; gap:12px; margin-bottom:12px;">
        <template v-for="carta in cards.slice(0,2)" :key="carta.id">
          <!-- slot card: larghezza fissa = 1/3 container -->
          <div style="width:calc((100% - 24px) / 3); flex-shrink:0; position:relative;">
            <div v-if="isNew(carta)" style="position:absolute;top:-10px;left:-4px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.5);border-radius:999px;padding:2px 7px;font-size:10px;font-weight:900;color:#000;line-height:1;white-space:nowrap;">{{ $t('pesca.new_badge') }}</div>
            <div v-if="getCopie(carta)>0" style="position:absolute;top:-10px;right:-4px;z-index:20;min-width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;padding:0 4px;" :style="getCopie(carta)>=3?{background:'linear-gradient(135deg,#00c853,#58e0a3)',border:'2px solid rgba(89,224,163,0.8)'}:{background:'linear-gradient(135deg,#3b1fa8,#6d28d9)',border:'2px solid rgba(139,111,216,0.8)'}">{{ getCopie(carta)>=3?'C':getCopie(carta) }}</div>
            <!-- CONTENITORE IMMAGINE: padding-bottom:150% = ratio 2:3 FISSO — impossibile da sovrascrivere -->
            <div style="position:relative; width:100%; padding-bottom:150%; border-radius:10px; overflow:hidden;"
                 :style="{border:rarityBorder(carta.rarita), boxShadow:rarityGlow(carta.rarita), background:'var(--theme-bg-secondary)'}">
              <img v-if="carta.immagine"
                   :src="ikUrl(carta.immagine,'thumbnail')??undefined" :alt="carta.nome"
                   style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
              <div v-else style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--surface-sunken);">
                <img src="~/assets/images/New_Logo.png" alt="" style="width:50%;height:auto;display:block;" />
              </div>
              <div style="position:absolute;bottom:4px;left:4px;z-index:3;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:800;text-transform:capitalize;backdrop-filter:blur(4px);"
                   :style="{background:rarityColor(carta.rarita)+'33',border:'1px solid '+rarityColor(carta.rarita)+'88',color:rarityColor(carta.rarita)}">{{ carta.rarita||'?' }}</div>
            </div>
            <div style="padding:4px 0 0;text-align:center;font-size:11px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ carta.nome||'—' }}</div>
          </div>
        </template>
      </div>

      <!-- riga 2: 3 carte grid, stessa larghezza 1fr -->
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
        <template v-for="carta in cards.slice(2,5)" :key="carta.id">
          <div style="position:relative;">
            <div v-if="isNew(carta)" style="position:absolute;top:-10px;left:-4px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.5);border-radius:999px;padding:2px 7px;font-size:10px;font-weight:900;color:#000;line-height:1;white-space:nowrap;">{{ $t('pesca.new_badge') }}</div>
            <div v-if="getCopie(carta)>0" style="position:absolute;top:-10px;right:-4px;z-index:20;min-width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;padding:0 4px;" :style="getCopie(carta)>=3?{background:'linear-gradient(135deg,#00c853,#58e0a3)',border:'2px solid rgba(89,224,163,0.8)'}:{background:'linear-gradient(135deg,#3b1fa8,#6d28d9)',border:'2px solid rgba(139,111,216,0.8)'}">{{ getCopie(carta)>=3?'C':getCopie(carta) }}</div>
            <!-- STESSO CONTENITORE: padding-bottom:150% fisso inline -->
            <div style="position:relative; width:100%; padding-bottom:150%; border-radius:10px; overflow:hidden;"
                 :style="{border:rarityBorder(carta.rarita), boxShadow:rarityGlow(carta.rarita), background:'var(--theme-bg-secondary)'}">
              <img v-if="carta.immagine"
                   :src="ikUrl(carta.immagine,'thumbnail')??undefined" :alt="carta.nome"
                   style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
              <div v-else style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--surface-sunken);">
                <img src="~/assets/images/New_Logo.png" alt="" style="width:50%;height:auto;display:block;" />
              </div>
              <div style="position:absolute;bottom:4px;left:4px;z-index:3;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:800;text-transform:capitalize;backdrop-filter:blur(4px);"
                   :style="{background:rarityColor(carta.rarita)+'33',border:'1px solid '+rarityColor(carta.rarita)+'88',color:rarityColor(carta.rarita)}">{{ carta.rarita||'?' }}</div>
            </div>
            <div style="padding:4px 0 0;text-align:center;font-size:11px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ carta.nome||'—' }}</div>
          </div>
        </template>
      </div>

    </div>
    <!-- Bottone Drop eliminato — il click sulla card avviene nel componente padre -->

    </div><!-- fine inner wrapper -->
  </div>
</template>

<style scoped>
/* Nessuna regola di sizing qui — tutto è inline nel template per massima priorità */
</style>
