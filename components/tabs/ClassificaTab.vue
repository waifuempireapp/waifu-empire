<!-- ============================================================
  ClassificaTab: scheda principale della classifica globale per
  territori conquistati. Mostra podio, posizione personale e lista
  completa con paginazione. Include la classifica waifu tramite
  WaifuRankingList.
  ============================================================ -->
<script setup lang="ts">
// Icone Lucide — Trophy per il podio, Map per territori, Gift per premi
import { Trophy, Map as MapIcon, Gift } from 'lucide-vue-next'
import { getClassifica, premioPerPosizione } from '~/utils/firestoreService'

// Prop: utente Firebase autenticato
const props = defineProps<{
  user: any
}>()

const { isDark } = useTheme()

// ---- Token visivi (design system condiviso) ----
const C = {
  ink:     '#03020c',
  ink2:    '#0d0a26',
  inkLine: 'rgba(174,156,255,0.18)',
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
}
const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

// Colori podio: oro, argento, bronzo (usati per bordi/gradienti visivi)
const podiumColors = [C.gold, '#cfd8e3', '#ff9b6b']
// Colori testo nella lista classifica (più leggibili su sfondi chiari)
const rankTextColors = [C.violet, '#5a7a96', '#ff9b6b']

// ---- Stato reattivo ----
const subTab    = ref<'giocatori' | 'waifu'>('giocatori')
const classifica = ref<any[]>([])
const loading    = ref(true)
const errore     = ref<string | null>(null)
const visibili   = ref(20) // paginazione: mostra 20 alla volta

// ---- Caricamento classifica al mount ----
onMounted(() => {
  getClassifica(200)
    .then(d => { classifica.value = d; loading.value = false })
    .catch(e => { errore.value = e.message; loading.value = false })
})

// ---- Calcolo posizione dell'utente corrente ----
const mioIndice = computed(() =>
  props.user
    ? classifica.value.findIndex(u => u.id === props.user.uid)
    : -1
)

// ---- Countdown al prossimo reset (lunedì 00:00) ----
const prossimoLunedi = computed(() => {
  const ora    = new Date()
  const giorno = ora.getDay()
  const diff   = (8 - giorno) % 7 || 7
  const lun    = new Date(ora)
  lun.setDate(ora.getDate() + diff)
  lun.setHours(0, 0, 0, 0)
  const diffMs = lun.getTime() - ora.getTime()
  const giorni = Math.floor(diffMs / 86400000)
  const ore    = Math.floor((diffMs % 86400000) / 3600000)
  const min    = Math.floor((diffMs % 3600000) / 60000)
  return giorni > 0 ? `${giorni}d ${ore}h ${min}m` : `${ore}h ${min}m`
})

// ---- Ordine visivo del podio: 2° (idx 1), 1° (idx 0), 3° (idx 2) ----
const PODIO_INDICES = [1, 0, 2]
const PODIO_HEIGHTS = [180, 150, 120] // altezza colonna in px

// ---- Premi settimanali statici ----
const premiTop = { label: '1°',      medal: '🥇', pack: 10, col: C.violet  }
const premiRiga2 = [
  { label: '2°',      medal: '🥈', pack: 5,  col: '#5a7a96' },
  { label: '3°',      medal: '🥉', pack: 3,  col: '#ff9b6b' },
]
const premiRiga3 = [
  { label: 'Top 100', medal: '🏅', pack: 2,  col: C.violet  },
  { label: 'Tutti',   medal: '✦',  pack: 1,  col: C.violet  },
]

// ---- Stato collasso lista completa ----
const listExpanded = ref(false)
</script>

<template>
  <!-- Contenitore scheda con animazione fade-in -->
  <div class="fade-in" :style="{ paddingTop: '14px' }">

    <!-- Tab bar: Giocatori / Classifica Waifu -->
    <div :style="{
      display: 'flex', gap: 0,
      background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
      borderRadius: '12px', padding: '3px', marginBottom: '20px',
    }">
      <button
        v-for="t in [{ id: 'giocatori', label: 'Giocatori' }, { id: 'waifu', label: 'Classifica Waifu' }]"
        :key="t.id"
        @click="subTab = (t.id as 'giocatori' | 'waifu')"
        :style="{
          flex: 1, padding: '9px 8px', borderRadius: '10px',
          border: 'none', cursor: 'pointer',
          background: subTab === t.id ? 'var(--theme-tab-active)' : 'transparent',
          color: subTab === t.id ? 'var(--theme-accent)' : 'var(--theme-text-2)',
          fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.15em',
          fontWeight: subTab === t.id ? 700 : 500,
          textTransform: 'uppercase', transition: 'all 0.18s',
          boxShadow: subTab === t.id ? '0 2px 8px var(--theme-shadow)' : 'none',
        }"
      >{{ t.label }}</button>
    </div>

    <!-- ===== CLASSIFICA WAIFU ===== -->
    <ClassificaWaifuRankingList v-if="subTab === 'waifu'" :user="user" />

    <!-- ===== CLASSIFICA GIOCATORI ===== -->
    <template v-if="subTab === 'giocatori'">

      <!-- Titolo sezione con countdown reset -->
      <div :style="{ textAlign: 'center' }">
        <!-- Kicker: stagione e countdown -->
        <div :style="{
          fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.28em',
          color: isDark ? '#E0A030' : 'var(--theme-accent)',
          textTransform: 'uppercase', marginBottom: '6px',
          fontWeight: 600, opacity: 1,
        }">◆ Stagione 7 · reset in {{ prossimoLunedi }}</div>

        <!-- Titolo principale -->
        <h1 :style="{
          fontFamily: FF.display,
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 800, margin: 0,
          letterSpacing: '-0.01em', lineHeight: 0.95, color: 'var(--theme-accent)',
        }">Classifica Globale</h1>

        <!-- Sottotitolo descrittivo -->
        <div :style="{
          fontFamily: FF.body, fontSize: '12px',
          color: 'var(--theme-text-2)', marginTop: '6px',
          lineHeight: 1.4, marginBottom: '18px',
        }">Conquista più territori, sali di livello mappa, vinci più premi.</div>
      </div>

      <!-- Premio settimanale: due righe di box colorati -->
      <div :style="{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: '16px', padding: '14px 16px 16px', marginBottom: '16px',
        boxShadow: '0 4px 16px var(--theme-shadow)', overflow: 'visible',
      }">
        <div :style="{
          fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text)',
          letterSpacing: '0.2em', marginBottom: '12px', fontWeight: 700,
          textTransform: 'uppercase',
        }"><Gift :size="14" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:4px;" />Premi settimanali</div>

        <!-- Riga 1: solo 1° posto, centrato -->
        <div :style="{ display:'flex', justifyContent:'center', marginBottom:'12px', paddingTop:'14px' }">
          <div :style="{
            width:'55%', position:'relative',
            background:'var(--theme-bg-secondary)',
            border:`1.5px solid ${premiTop.col}88`,
            borderRadius:'14px', padding:'14px 14px 12px',
            boxShadow:`0 6px 20px ${premiTop.col}33`,
          }">
            <span :style="{ position:'absolute', top:'-16px', left:'-14px', fontSize:'34px', zIndex:2, filter:`drop-shadow(0 2px 10px ${premiTop.col}99)` }">{{ premiTop.medal }}</span>
            <div :style="{ position:'absolute', top:'8px', right:'10px', fontFamily:FF.label, fontSize:'20px', fontWeight:800, color:premiTop.col, lineHeight:1 }">{{ premiTop.label }}</div>
            <div :style="{ display:'flex', alignItems:'center', gap:'12px', marginTop:'6px' }">
              <img src="~/assets/images/back_card.png" alt="" :style="{ width:'42px', height:'auto', borderRadius:'5px', flexShrink:0, filter:`drop-shadow(0 3px 8px ${premiTop.col}66)` }" />
              <div>
                <div :style="{ fontFamily:FF.label, fontSize:'11px', color:'var(--theme-text-2)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'3px' }">PREMIO</div>
                <div :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:800, color:premiTop.col, lineHeight:1.15, whiteSpace:'nowrap' }">{{ premiTop.pack }} carte waifu</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Riga 2: 2° e 3° affiancati -->
        <div :style="{ display:'flex', gap:'12px', marginBottom:'12px' }">
          <div
            v-for="p in premiRiga2"
            :key="p.label"
            :style="{
              flex:1, position:'relative',
              background:'var(--theme-bg-secondary)',
              border:`1.5px solid ${p.col}77`,
              borderRadius:'14px', padding:'14px 12px 12px',
              boxShadow:`0 4px 14px ${p.col}22`,
            }"
          >
            <span :style="{ position:'absolute', top:'-14px', left:'-12px', fontSize:'28px', zIndex:2, filter:`drop-shadow(0 2px 8px ${p.col}88)` }">{{ p.medal }}</span>
            <div :style="{ position:'absolute', top:'7px', right:'9px', fontFamily:FF.label, fontSize:'17px', fontWeight:800, color:p.col, lineHeight:1 }">{{ p.label }}</div>
            <div :style="{ display:'flex', alignItems:'center', gap:'10px', marginTop:'6px' }">
              <img src="~/assets/images/back_card.png" alt="" :style="{ width:'36px', height:'auto', borderRadius:'4px', flexShrink:0, filter:`drop-shadow(0 2px 6px ${p.col}55)` }" />
              <div>
                <div :style="{ fontFamily:FF.label, fontSize:'11px', color:'var(--theme-text-2)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'3px' }">PREMIO</div>
                <div :style="{ fontFamily:FF.label, fontSize:'14px', fontWeight:800, color:p.col, lineHeight:1.15, whiteSpace:'nowrap' }">{{ p.pack }} carte waifu</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Riga 3: Top 100 e Tutti (senza icone floating) -->
        <div :style="{ display:'flex', gap:'12px' }">
          <div
            v-for="p in premiRiga3"
            :key="p.label"
            :style="{
              flex:1, position:'relative',
              background:'var(--theme-bg-secondary)',
              border:`1.5px solid ${p.col}66`,
              borderRadius:'14px', padding:'14px 12px 12px',
              boxShadow:`0 4px 14px ${p.col}22`,
            }"
          >
            <div :style="{ position:'absolute', top:'7px', right:'9px', fontFamily:FF.label, fontSize:'14px', fontWeight:800, color:p.col, lineHeight:1 }">{{ p.label }}</div>
            <div :style="{ display:'flex', alignItems:'center', gap:'10px', marginTop:'6px' }">
              <img src="~/assets/images/back_card.png" alt="" :style="{ width:'32px', height:'auto', borderRadius:'4px', flexShrink:0, filter:`drop-shadow(0 2px 6px ${p.col}55)` }" />
              <div>
                <div :style="{ fontFamily:FF.label, fontSize:'11px', color:'var(--theme-text-2)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'3px' }">PREMIO</div>
                <div :style="{ fontFamily:FF.label, fontSize:'14px', fontWeight:800, color:p.col, lineHeight:1.15, whiteSpace:'nowrap' }">{{ p.pack }} carte waifu</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Caricamento -->
      <AppLoading v-if="loading" />

      <!-- Messaggio di errore -->
      <div
        v-if="errore"
        :style="{
          textAlign: 'center', padding: '20px',
          color: C.err, fontSize: '11px',
          fontFamily: FF.body, fontWeight: 600,
        }"
      >Errore: {{ errore }}</div>

      <!-- ===== PODIO (top 3) ===== -->
      <div
        v-if="!loading && classifica.length >= 3"
        :style="{
          display: 'grid', gridTemplateColumns: '1fr 1.18fr 1fr',
          gap: '10px', alignItems: 'flex-end', marginBottom: '18px',
        }"
      >
        <div
          v-for="idx in PODIO_INDICES"
          :key="idx"
          :style="{ position: 'relative', textAlign: 'center' }"
        >
          <!-- Avatar con iniziale e badge posizione -->
          <div :style="{
            width: '60px', height: '60px', borderRadius: '16px',
            margin: '0 auto -16px',
            background: idx === 0
              ? 'linear-gradient(135deg, var(--theme-accent), var(--theme-accent-pink))'
              : 'var(--theme-bg-secondary)',
            border: `2.5px solid ${podiumColors[idx]}`,
            boxShadow: idx === 0 ? '0 0 20px var(--theme-shadow)' : 'none',
            display: 'grid', placeItems: 'center',
            position: 'relative', zIndex: 2,
            color: idx === 0 ? '#F0ECF8' : 'var(--theme-text)', fontFamily: FF.display, fontSize: '22px', fontWeight: 800,
          }">
            <!-- Iniziale del nome -->
            {{ (classifica[idx]._nomeDisplay || classifica[idx].nomeImpero || classifica[idx].email || '?')[0].toUpperCase() }}

            <!-- Badge numerico posizione -->
            <div :style="{
              position: 'absolute', top: '-10px', right: '-10px',
              background: podiumColors[idx], color: '#1a0e00',
              fontFamily: FF.display, fontSize: '15px', fontWeight: 800,
              width: '26px', height: '26px', borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              border: `2px solid ${C.ink}`,
              boxShadow: `0 0 12px ${podiumColors[idx]}`,
            }">{{ idx + 1 }}</div>

            <!-- Etichetta "TU" se è l'utente corrente -->
            <div
              v-if="user && classifica[idx].id === user.uid"
              :style="{
                position: 'absolute', bottom: '-12px', left: '50%',
                transform: 'translateX(-50%)',
                background: podiumColors[idx], color: '#1a0e00',
                fontFamily: FF.label, fontSize: '11px', fontWeight: 800,
                padding: '2px 8px', borderRadius: '999px',
                border: `1px solid ${C.ink}`, letterSpacing: '0.18em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
              }"
            >TU</div>
          </div>

          <!-- Colonna del podio -->
          <div :style="{
            height: `${PODIO_HEIGHTS[idx]}px`, paddingTop: '30px',
            position: 'relative',
            background: `linear-gradient(180deg, ${podiumColors[idx]}40 0%, ${podiumColors[idx]}10 50%, transparent 100%)`,
            borderRadius: '16px 16px 0 0',
            border: `1px solid ${podiumColors[idx]}55`, borderBottom: 'none',
            backdropFilter: 'blur(6px)',
          }">
            <!-- Corona per il primo posto -->
            <div
              v-if="idx === 0"
              :style="{
                position: 'absolute', top: '-28px', left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '22px', color: podiumColors[idx],
                filter: `drop-shadow(0 0 12px ${podiumColors[idx]})`,
              }"
            >👑</div>

            <!-- Nome giocatore -->
            <div :style="{
              fontFamily: FF.display, fontSize: '12px',
              color: 'var(--theme-text)', fontWeight: 700, padding: '0 6px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }">
              {{ (classifica[idx]._nomeDisplay || classifica[idx].nomeImpero || classifica[idx].nome || classifica[idx].email?.split('@')[0] || '—').slice(0, 14) }}
            </div>

            <!-- Numero di territori -->
            <div :style="{
              fontFamily: FF.label, fontSize: '12px',
              color: 'var(--theme-text-2)',
              letterSpacing: '0.15em', marginTop: '4px',
              textTransform: 'uppercase', fontWeight: 600,
            }">
              {{ classifica[idx]._territori }}
              {{ classifica[idx]._territori === 1 ? 'territorio' : 'territori' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ===== POSIZIONE PERSONALE (se non in top 3) ===== -->
      <div
        v-if="!loading && mioIndice >= 3"
        :style="{
          background: `linear-gradient(135deg, ${C.sakura}22, var(--theme-surface))`,
          border: `1px solid ${C.sakura}66`,
          borderRadius: '14px', padding: '14px', marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: `0 0 22px ${C.sakura}1f`,
        }"
      >
        <!-- Numero posizione evidenziato -->
        <div :style="{
          fontFamily: FF.display, fontSize: '26px', color: C.sakura,
          minWidth: '54px', textShadow: `0 0 12px ${C.sakura}`,
          fontWeight: 800,
        }">#{{ mioIndice + 1 }}</div>

        <!-- Nome e territori -->
        <div :style="{ flex: 1, minWidth: 0 }">
          <div :style="{
            fontFamily: FF.display, fontSize: '14px',
            color: '#fff', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }">
            {{ classifica[mioIndice]._nomeDisplay || classifica[mioIndice].nomeImpero || 'Tu' }}
            <span :style="{ color: C.sakura }">· TU</span>
          </div>
          <div :style="{
            fontFamily: FF.label, fontSize: '10px',
            color: 'var(--theme-text-2)', marginTop: '2px',
            letterSpacing: '-0.01em',
          }">
            {{ classifica[mioIndice]._territori }}
            {{ classifica[mioIndice]._territori === 1 ? 'territorio' : 'territori' }}
          </div>
        </div>

        <!-- Premio per la propria posizione -->
        <div :style="{ textAlign: 'right' }">
          <div :style="{ fontFamily: FF.label, fontSize: '13px', color: C.goldL, fontWeight: 700 }">
            {{ premioPerPosizione(mioIndice + 1) }} 🎴
          </div>
          <div :style="{
            fontSize: '7px', color: 'var(--theme-text-3)',
            fontFamily: FF.label, letterSpacing: '0.18em',
            textTransform: 'uppercase', marginTop: '2px',
          }">Premio</div>
        </div>
      </div>

      <!-- ===== CLASSIFICA COMPLETA — card collassabile ===== -->
      <div
        v-if="!loading"
        :style="{
          background: 'var(--theme-surface)', border: '1px solid var(--theme-border)',
          borderRadius: '16px', marginBottom: '14px',
          boxShadow: '0 4px 16px var(--theme-shadow)', overflow: 'hidden',
        }"
      >
        <!-- Header cliccabile -->
        <div
          @click="listExpanded = !listExpanded"
          :style="{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px', cursor: 'pointer',
          }"
        >
          <div :style="{ display:'flex', alignItems:'center', gap:'10px' }">
            <Trophy :size="18" stroke-width="1.5" :style="{ color: C.gold }" />
            <span :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'var(--theme-text)' }">Classifica Completa</span>
          </div>
          <div :style="{ display:'flex', alignItems:'center', gap:'10px' }">
            <span v-if="classifica.length" :style="{ fontFamily:FF.label, fontSize:'13px', color:'var(--theme-text-3)' }">{{ classifica.length }} giocatori</span>
            <span :style="{ fontFamily:FF.label, fontSize:'16px', color:'var(--theme-text-3)', transition:'transform 0.25s', display:'inline-block', transform: listExpanded ? 'rotate(180deg)' : 'none' }">▾</span>
          </div>
        </div>

        <!-- Contenuto espandibile -->
        <div v-if="listExpanded">
          <!-- Stato vuoto -->
          <div v-if="classifica.length === 0" :style="{ padding: '40px', textAlign: 'center' }">
            <Trophy :size="38" stroke-width="1" style="margin-bottom:8px;filter:drop-shadow(0 0 12px rgba(245,197,96,0.5));color:#f5c560;" />
            <div :style="{ fontFamily:FF.label, fontSize:'13px', color:C.gold, letterSpacing:'0.24em', marginBottom:'6px', textTransform:'uppercase', fontWeight:700 }">Classifica vuota</div>
            <div :style="{ fontFamily:FF.body, fontSize:'13px', color:'var(--theme-text-2)', lineHeight:1.6 }">Sii il primo a conquistare territori<br/>e scalare la classifica!</div>
          </div>

          <template v-else>
            <!-- Intestazione colonne -->
            <div :style="{
              display:'flex', alignItems:'center', gap:'10px',
              padding:'10px 18px', borderTop:'1px solid var(--theme-border)',
              fontFamily:FF.label, fontSize:'12px', letterSpacing:'0.2em',
              color:'var(--theme-text-2)', textTransform:'uppercase', fontWeight:700,
            }">
              <div :style="{ minWidth:'34px' }">#</div>
              <div :style="{ flex:1 }">Giocatore</div>
              <div :style="{ minWidth:'72px', textAlign:'center' }">Territori</div>
              <div :style="{ minWidth:'44px', textAlign:'right' }">Premio</div>
            </div>

            <!-- Righe classifica -->
            <div :style="{ maxHeight: '440px', overflowY: 'auto' }">
              <div
                v-for="(u, i) in classifica.slice(0, visibili)"
                :key="u.id"
                :style="{
                  display:'flex', alignItems:'center', gap:'10px',
                  padding:'12px 18px',
                  background: (user && u.id === user.uid)
                    ? `linear-gradient(90deg, ${C.gold}1a, transparent)`
                    : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  borderLeft: (user && u.id === user.uid) ? `3px solid ${C.gold}` : '3px solid transparent',
                  borderBottom:'1px solid var(--theme-border)',
                }"
              >
                <!-- Posizione -->
                <div :style="{ minWidth:'34px', textAlign:'center' }">
                  <span v-if="i < 3" :style="{ fontSize:'20px' }">{{ ['🥇','🥈','🥉'][i] }}</span>
                  <span v-else :style="{ fontFamily:FF.label, fontSize:'14px', fontWeight:(user && u.id === user.uid) ? 800 : 600, color:(user && u.id === user.uid) ? C.gold : 'var(--theme-text-3)' }">#{{ i + 1 }}</span>
                </div>

                <!-- Nome -->
                <div :style="{ flex:1, minWidth:0 }">
                  <div :style="{
                    fontFamily:FF.label, fontSize:'15px', fontWeight:(user && u.id === user.uid) || i <= 2 ? 800 : 600,
                    color: i <= 2 ? rankTextColors[i] : (user && u.id === user.uid) ? C.violet : 'var(--theme-text)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }">
                    {{ (u._nomeDisplay || u.nomeImpero || u.nome || u.email?.split('@')[0] || 'Giocatore').slice(0, 22) }}
                    <span v-if="user && u.id === user.uid" :style="{ marginLeft:'6px', fontSize:'12px', color:C.gold, fontFamily:FF.label, letterSpacing:'0.12em' }">← TU</span>
                  </div>
                </div>

                <!-- Territori -->
                <div :style="{
                  minWidth:'72px', textAlign:'center',
                  fontFamily:FF.label, fontSize:'14px', fontWeight:600,
                  color: i <= 2 ? rankTextColors[i] : (user && u.id === user.uid) ? C.violet : 'var(--theme-text-2)',
                }">
                  <MapIcon :size="13" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:3px;" />{{ u._territori }}
                </div>

                <!-- Premio -->
                <div :style="{ minWidth:'44px', textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }">
                  <span :style="{ fontFamily:FF.label, fontSize:'14px', fontWeight:700, color: premioPerPosizione(i + 1) >= 1 ? C.violet : 'var(--theme-text-3)' }">{{ premioPerPosizione(i + 1) }}</span>
                  <img src="~/assets/images/back_card.png" alt="" :style="{ width:'18px', height:'auto', borderRadius:'2px', opacity: premioPerPosizione(i + 1) >= 1 ? 1 : 0.3 }" />
                </div>
              </div>
            </div>

            <!-- Carica altri -->
            <div v-if="visibili < classifica.length" :style="{ padding:'14px 18px', textAlign:'center', borderTop:`1px solid ${C.inkLine}` }">
              <button
                @click="visibili += 20"
                :style="{
                  background:'rgba(245,197,96,0.08)', border:`1px solid ${C.gold}40`,
                  borderRadius:'10px', color:C.goldL,
                  fontFamily:FF.label, fontSize:'13px', letterSpacing:'0.15em',
                  textTransform:'uppercase', padding:'10px 24px', cursor:'pointer',
                }"
              >Carica altri 20 ({{ classifica.length - visibili }} rimanenti)</button>
            </div>
          </template>
        </div>
      </div>

      <!-- Nota criteri -->
      <div :style="{
        textAlign:'center', marginTop:'10px',
        fontFamily:FF.label, fontSize:'11px', color:'var(--theme-text-3)',
        letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:600,
      }">
        Criteri · Territori → Pass Hard (spareggio) → Iscrizione
      </div>

    </template>
  </div>
</template>

<style scoped>
/* Pocket-style: background del container trasparente (ereditato da game-container) */
.fade-in { background: transparent; }
/* Testo primario via token */
* { font-family: var(--ff-body, 'Nunito', sans-serif); }
</style>
