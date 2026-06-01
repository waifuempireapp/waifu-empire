<!-- ============================================================
  PescaPackCard — ridisegnato come nel mockup Waifu Drop.
  Card con bordo colorato per stato, avatar lettera, badge NUOVA,
  countdown, carte in scroll orizzontale (silhouette → full art),
  bottone Drop (N Kisses) o VISUALIZZAZIONE COMPLETA.
  Script invariato; solo il template è stato ridisegnato.
  ============================================================ -->
<script setup lang="ts">
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
  if (giaFiscata.value) return 'rgba(255,255,255,0.08)'
  if (isNuovo.value) return 'rgba(255,165,30,0.7)'
  return 'rgba(56,230,200,0.45)'
})
const glowColor = computed(() => {
  if (giaFiscata.value) return 'transparent'
  if (isNuovo.value) return 'rgba(255,165,30,0.20)'
  return 'rgba(56,230,200,0.12)'
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
  if (diff <= 0) { remaining.value = 'Scaduta'; return }
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
  <!-- Card principale con bordo colorato per stato -->
  <div :style="{
    background:   'linear-gradient(160deg, rgba(10,6,28,0.98) 0%, rgba(6,3,18,0.99) 100%)',
    border:       `1.5px solid ${borderColor}`,
    borderRadius: '20px',
    overflow:     'visible',
    position:     'relative',
    zIndex:       1,
    boxShadow:    `0 4px 32px ${glowColor}, 0 1px 0 rgba(255,255,255,0.04) inset`,
    transition:   'all 0.2s',
    opacity:      giaFiscata ? 0.55 : 1,
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
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:14px;font-weight:900;color:#ffa020;letter-spacing:0.14em;text-transform:uppercase;text-align:center;text-shadow:0 0 16px rgba(255,140,0,0.8);">Hard Pass<br/>Richiesto</div>
      <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:11px;color:rgba(255,255,255,0.55);text-align:center;padding:0 20px;">Acquista il Pass per vedere e pescare i contenuti hot</div>
    </div>

    <!-- Overlay PESCATA -->
    <div v-if="giaFiscata" style="position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);pointer-events:none">
      <div style="background:rgba(6,3,15,0.88);border:1px solid rgba(255,255,255,0.14);border-radius:20px;padding:7px 20px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);font-weight:700">
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
        <div style="font-family:var(--ff-display,Unbounded,sans-serif);font-size:14px;font-weight:700;color:#fff;letter-spacing:0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          {{ pack.ownerName }}
        </div>
        <div v-if="pack.expiresAt && !giaFiscata" style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:11px;color:rgba(255,255,255,0.45);display:flex;align-items:center;gap:4px;margin-top:3px;">
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
        background: isNuovo ? 'rgba(255,165,30,0.18)' : 'rgba(56,230,200,0.12)',
        border: `1px solid ${isNuovo ? 'rgba(255,165,30,0.55)' : 'rgba(56,230,200,0.45)'}`,
        borderRadius:'999px', padding:'7px 16px', width:'100%', boxSizing:'border-box',
        fontFamily:'var(--ff-label,\'Saira Condensed\',sans-serif)',
        fontSize:'12px',
        color: isNuovo ? '#ffa020' : '#38e6c8',
        fontWeight:700, letterSpacing:'0.1em',
        boxShadow: isNuovo ? '0 0 14px rgba(255,165,30,0.2)' : '0 0 14px rgba(56,230,200,0.15)',
      }">★ {{ pack.dropName }}</div>
    </div>

    <!-- ── CARTE: grid 3 colonne, row 1 = col 1-2, row 2 = col 1-2-3 ── -->
    <div style="padding:16px 12px 8px; overflow:visible;">
      <div style="display:grid; grid-template-columns:repeat(3,1fr); grid-auto-rows:auto; gap:12px;">

        <!-- Riga 1: 2 carte centrate — wrapper flex su 3 colonne -->
        <div style="grid-column:1/-1; grid-row:1; display:flex; justify-content:center; gap:12px; margin-top:14px;">

        <!-- Carta 0 -->
        <div v-if="cards[0]" style="width:calc((100% - 24px) / 3); position:relative; flex-shrink:0;">
          <div v-if="isNew(cards[0])" style="position:absolute;top:-12px;left:-4px;z-index:20;"><div style="background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.45);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;font-weight:900;color:#000;letter-spacing:0.06em;box-shadow:0 3px 12px rgba(0,180,255,0.55);white-space:nowrap;line-height:1;">NEW</div></div>
          <div v-if="(true)&&getCopie(cards[0])>0" :style="{position:'absolute',top:'-12px',right:'-4px',zIndex:20,background:getCopie(cards[0])>=3?'linear-gradient(135deg,#00c853,#58e0a3)':'linear-gradient(135deg,#1a0a35,#2a1255)',border:getCopie(cards[0])>=3?'2px solid rgba(89,224,163,0.8)':'2px solid rgba(245,197,96,0.8)',borderRadius:'999px',minWidth:'22px',height:'22px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--ff-mono,JetBrains Mono,monospace)',fontSize:'11px',fontWeight:900,color:'#fff',padding:'0 4px'}">{{ getCopie(cards[0])>=3?'C':getCopie(cards[0]) }}</div>
          <div :style="{borderRadius:'10px',border:true?rarityBorder(cards[0].rarita):'1.5px solid rgba(255,255,255,0.08)',background:'linear-gradient(160deg,#16082e,#08041a)',boxShadow:true?rarityGlow(cards[0].rarita):'none',overflow:'hidden',transition:'all 0.25s',position:'relative'}">
            <div style="aspect-ratio:2/3;position:relative;overflow:hidden;">
              <template v-if="true">
                <img v-if="cards[0].immagine" :src="ikUrl(cards[0].immagine,'thumbnail')??undefined" :alt="cards[0].nome" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
                <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.82;" /></div>
              </template>
              <template v-else>
                <!-- unreachable --><img v-if="false" :src="ikUrl(cards[0].immagine,'thumbnail')??undefined" :alt="cards[0].nome" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;filter:blur(12px) brightness(0.5);" />
                <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.3;" /></div>
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;z-index:3;"><span style="font-size:22px;">🔒</span><div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:8px;color:rgba(255,140,0,0.9);letter-spacing:0.12em;text-transform:uppercase;font-weight:800;text-align:center;">Hard Pass</div></div>
              </template>
              <div v-if="true" :style="{position:'absolute',bottom:'4px',left:'4px',background:rarityColor(cards[0].rarita)+'33',border:'1px solid '+rarityColor(cards[0].rarita)+'88',borderRadius:'999px',padding:'2px 6px',fontFamily:'var(--ff-label,\'Saira Condensed\',sans-serif)',fontSize:'10px',fontWeight:800,color:rarityColor(cards[0].rarita),letterSpacing:'0.05em',textTransform:'capitalize',backdropFilter:'blur(4px)',zIndex:2}">{{ cards[0].rarita||'?' }}</div>
            </div>
          </div>
          <div style="padding:4px 1px 0;text-align:center;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.03em;">{{ cards[0].nome||'—' }}</div>
        </div>

        <!-- Carta 1 -->
        <div v-if="cards[1]" style="width:calc((100% - 24px) / 3); position:relative; flex-shrink:0;">
          <div v-if="isNew(cards[1])" style="position:absolute;top:-12px;left:-4px;z-index:20;"><div style="background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.45);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;font-weight:900;color:#000;letter-spacing:0.06em;box-shadow:0 3px 12px rgba(0,180,255,0.55);white-space:nowrap;line-height:1;">NEW</div></div>
          <div v-if="(true)&&getCopie(cards[1])>0" :style="{position:'absolute',top:'-12px',right:'-4px',zIndex:20,background:getCopie(cards[1])>=3?'linear-gradient(135deg,#00c853,#58e0a3)':'linear-gradient(135deg,#1a0a35,#2a1255)',border:getCopie(cards[1])>=3?'2px solid rgba(89,224,163,0.8)':'2px solid rgba(245,197,96,0.8)',borderRadius:'999px',minWidth:'22px',height:'22px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--ff-mono,JetBrains Mono,monospace)',fontSize:'11px',fontWeight:900,color:'#fff',padding:'0 4px'}">{{ getCopie(cards[1])>=3?'C':getCopie(cards[1]) }}</div>
          <div :style="{borderRadius:'10px',border:true?rarityBorder(cards[1].rarita):'1.5px solid rgba(255,255,255,0.08)',background:'linear-gradient(160deg,#16082e,#08041a)',boxShadow:true?rarityGlow(cards[1].rarita):'none',overflow:'hidden',transition:'all 0.25s',position:'relative'}">
            <div style="aspect-ratio:2/3;position:relative;overflow:hidden;">
              <template v-if="true">
                <img v-if="cards[1].immagine" :src="ikUrl(cards[1].immagine,'thumbnail')??undefined" :alt="cards[1].nome" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
                <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.82;" /></div>
              </template>
              <div v-if="true" :style="{position:'absolute',bottom:'4px',left:'4px',background:rarityColor(cards[1].rarita)+'33',border:'1px solid '+rarityColor(cards[1].rarita)+'88',borderRadius:'999px',padding:'2px 6px',fontFamily:'var(--ff-label,\'Saira Condensed\',sans-serif)',fontSize:'10px',fontWeight:800,color:rarityColor(cards[1].rarita),letterSpacing:'0.05em',textTransform:'capitalize',backdropFilter:'blur(4px)',zIndex:2}">{{ cards[1].rarita||'?' }}</div>
            </div>
          </div>
          <div style="padding:4px 1px 0;text-align:center;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.03em;">{{ cards[1].nome||'—' }}</div>
        </div>

        </div><!-- fine wrapper riga 1 -->

        <!-- Carte 2-4: row2, col 1-2-3 -->
        <div
          v-for="(carta, i) in cards.slice(2,5)"
          :key="i+2"
          :style="{gridColumn: String(i+1), gridRow:'2', position:'relative', marginTop:'14px'}"
        >
          <div v-if="isNew(carta)" style="position:absolute;top:-12px;left:-4px;z-index:20;"><div style="background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.45);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;font-weight:900;color:#000;letter-spacing:0.06em;box-shadow:0 3px 12px rgba(0,180,255,0.55);white-space:nowrap;line-height:1;">NEW</div></div>
          <div v-if="(true)&&getCopie(carta)>0" :style="{position:'absolute',top:'-12px',right:'-4px',zIndex:20,background:getCopie(carta)>=3?'linear-gradient(135deg,#00c853,#58e0a3)':'linear-gradient(135deg,#1a0a35,#2a1255)',border:getCopie(carta)>=3?'2px solid rgba(89,224,163,0.8)':'2px solid rgba(245,197,96,0.8)',borderRadius:'999px',minWidth:'22px',height:'22px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--ff-mono,JetBrains Mono,monospace)',fontSize:'11px',fontWeight:900,color:'#fff',padding:'0 4px'}">{{ getCopie(carta)>=3?'C':getCopie(carta) }}</div>
          <div :style="{borderRadius:'10px',border:true?rarityBorder(carta.rarita):'1.5px solid rgba(255,255,255,0.08)',background:'linear-gradient(160deg,#16082e,#08041a)',boxShadow:true?rarityGlow(carta.rarita):'none',overflow:'hidden',transition:'all 0.25s',position:'relative'}">
            <div style="aspect-ratio:2/3;position:relative;overflow:hidden;">
              <template v-if="true">
                <img v-if="carta.immagine" :src="ikUrl(carta.immagine,'thumbnail')??undefined" :alt="carta.nome" style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
                <div v-else style="width:100%;height:100%;display:grid;place-items:center;"><img src="~/assets/images/Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.82;" /></div>
              </template>
              <div v-if="true" :style="{position:'absolute',bottom:'4px',left:'4px',background:rarityColor(carta.rarita)+'33',border:'1px solid '+rarityColor(carta.rarita)+'88',borderRadius:'999px',padding:'2px 6px',fontFamily:'var(--ff-label,\'Saira Condensed\',sans-serif)',fontSize:'10px',fontWeight:800,color:rarityColor(carta.rarita),letterSpacing:'0.05em',textTransform:'capitalize',backdropFilter:'blur(4px)',zIndex:2}">{{ carta.rarita||'?' }}</div>
            </div>
          </div>
          <div style="padding:4px 1px 0;text-align:center;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.03em;">{{ carta.nome||'—' }}</div>
        </div>

      </div>
    </div>
    <!-- ── FOOTER ── -->
    <div v-if="!giaFiscata" style="padding:8px 16px 14px;display:flex;justify-content:center;">

      <!-- Drop (N) button -->
      <button
        :disabled="!puoPescare"
        :style="{
          display:      'flex', alignItems:'center', justifyContent:'center', gap:'8px',
          padding:      '11px 32px', borderRadius:'999px',
          background:   puoPescare ? 'rgba(255,80,160,0.14)' : 'rgba(255,255,255,0.03)',
          border:       `2px solid ${puoPescare ? 'rgba(255,80,160,0.55)' : 'rgba(255,255,255,0.08)'}`,
          cursor:       puoPescare ? 'pointer' : 'not-allowed',
          transition:   'all 0.2s',
          width:        '100%',
          boxShadow:    puoPescare ? '0 0 20px rgba(255,80,160,0.2)' : 'none',
        }"
        @click="emit('pesca', pack)"
      >
        <span style="font-size:18px;line-height:1;">💗</span>
        <span :style="{
          fontFamily:'var(--ff-display,Unbounded,sans-serif)',
          fontSize:'13px', fontWeight:700,
          color: puoPescare ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
          letterSpacing:'0.05em',
        }">Drop ({{ kissesCost }})</span>
      </button>
    </div>

    </div><!-- fine inner wrapper -->
  </div>
</template>
