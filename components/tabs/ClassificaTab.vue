<!-- ============================================================
  ClassificaTab: scheda principale della classifica globale per
  territori conquistati. Mostra podio, posizione personale e lista
  completa con paginazione. Include la classifica waifu tramite
  WaifuRankingList.
  ============================================================ -->
<script setup lang="ts">
import { getClassifica, premioPerPosizione } from '~/utils/firestoreService'

// Prop: utente Firebase autenticato
const props = defineProps<{
  user: any
}>()

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

// Colori podio: oro, argento, bronzo
const podiumColors = [C.gold, '#cfd8e3', '#ff9b6b']

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
const premiRiga1 = [
  { label: '🥇 1°', pack: 10, col: C.gold     },
  { label: '🥈 2°', pack: 5,  col: '#cfd8e3'  },
  { label: '🥉 3°', pack: 3,  col: '#ff9b6b'  },
]
const premiRiga2 = [
  { label: '🏅 Top 100', pack: 2, col: C.violet  },
  { label: '✦ Tutti',    pack: 1, col: '#5aa9ff' },
]
</script>

<template>
  <!-- Contenitore scheda con animazione fade-in -->
  <div class="fade-in" :style="{ paddingTop: '14px' }">

    <!-- Tab bar: Giocatori / Classifica Waifu -->
    <div :style="{
      display: 'flex', gap: 0,
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '12px', padding: '3px', marginBottom: '20px',
    }">
      <button
        v-for="t in [{ id: 'giocatori', label: 'Giocatori' }, { id: 'waifu', label: 'Classifica Waifu' }]"
        :key="t.id"
        @click="subTab = (t.id as 'giocatori' | 'waifu')"
        :style="{
          flex: 1, padding: '9px 8px', borderRadius: '10px',
          border: 'none', cursor: 'pointer',
          background: subTab === t.id ? 'rgba(245,197,96,0.18)' : 'transparent',
          color: subTab === t.id ? C.goldL : 'rgba(241,235,255,0.45)',
          fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.15em',
          fontWeight: subTab === t.id ? 700 : 500,
          textTransform: 'uppercase', transition: 'all 0.18s',
          boxShadow: subTab === t.id ? '0 0 12px rgba(245,197,96,0.2)' : 'none',
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
          fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.42em',
          color: C.goldL, textTransform: 'uppercase', marginBottom: '6px',
          fontWeight: 700,
        }">◆ Stagione 7 · reset in {{ prossimoLunedi }}</div>

        <!-- Titolo principale -->
        <h1 :style="{
          fontFamily: FF.display,
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 800, margin: 0,
          letterSpacing: '-0.01em', lineHeight: 0.95, color: '#fff',
        }" class="shimmer-text">Classifica Globale</h1>

        <!-- Sottotitolo descrittivo -->
        <div :style="{
          fontFamily: FF.body, fontSize: '12px',
          color: 'rgba(241,235,255,0.6)', marginTop: '6px',
          lineHeight: 1.4, marginBottom: '18px',
        }">Conquista più territori, sali di livello mappa, vinci più premi.</div>
      </div>

      <!-- Premio settimanale: due righe di box colorati -->
      <div :style="{
        background: 'linear-gradient(135deg, rgba(245,197,96,0.10), rgba(255,126,182,0.08))',
        border: `1px solid ${C.gold}44`,
        borderRadius: '16px', padding: '14px 16px', marginBottom: '16px',
        boxShadow: `0 0 20px ${C.gold}1a`,
      }">
        <div :style="{
          fontFamily: FF.label, fontSize: '10px', color: C.goldL,
          letterSpacing: '0.28em', marginBottom: '10px', fontWeight: 700,
          textTransform: 'uppercase',
        }">🎁 Premi settimanali</div>

        <!-- Riga 1: 1°, 2°, 3° posto -->
        <div :style="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
          <div
            v-for="p in premiRiga1"
            :key="p.label"
            :style="{
              flex: 1,
              background: `${p.col}10`,
              border: `1px solid ${p.col}45`,
              borderRadius: '11px', padding: '8px 10px', textAlign: 'center',
            }"
          >
            <div :style="{ fontSize: '11px', color: p.col, fontWeight: 700, fontFamily: FF.label, letterSpacing: '0.12em' }">{{ p.label }}</div>
            <div :style="{ fontSize: '18px', color: '#fff', fontFamily: FF.mono, fontWeight: 800, marginTop: '2px', textShadow: `0 0 8px ${p.col}55` }">{{ p.pack }}</div>
            <div :style="{ fontSize: '8px', color: 'rgba(241,235,255,0.45)', fontFamily: FF.label, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '2px' }">🎴 PREMIO</div>
          </div>
        </div>

        <!-- Riga 2: Top 100 e tutti i partecipanti -->
        <div :style="{ display: 'flex', gap: '8px' }">
          <div
            v-for="p in premiRiga2"
            :key="p.label"
            :style="{
              flex: 1,
              background: `${p.col}10`,
              border: `1px solid ${p.col}45`,
              borderRadius: '11px', padding: '8px 10px', textAlign: 'center',
            }"
          >
            <div :style="{ fontSize: '11px', color: p.col, fontWeight: 700, fontFamily: FF.label, letterSpacing: '0.12em' }">{{ p.label }}</div>
            <div :style="{ fontSize: '18px', color: '#fff', fontFamily: FF.mono, fontWeight: 800, marginTop: '2px', textShadow: `0 0 8px ${p.col}55` }">{{ p.pack }}</div>
            <div :style="{ fontSize: '8px', color: 'rgba(241,235,255,0.45)', fontFamily: FF.label, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '2px' }">🎴 PREMIO</div>
          </div>
        </div>
      </div>

      <!-- Spinner di caricamento -->
      <div
        v-if="loading"
        :style="{
          textAlign: 'center', padding: '32px 16px',
          color: 'rgba(241,235,255,0.45)', fontFamily: FF.label,
          fontSize: '10px', letterSpacing: '0.22em',
          textTransform: 'uppercase', fontWeight: 700,
        }"
      >
        <span :style="{
          display: 'inline-block', width: '18px', height: '18px',
          borderRadius: '50%', border: `2px solid ${C.goldL}`,
          borderTopColor: 'transparent', verticalAlign: 'middle',
          marginRight: '10px', animation: 'spinSlow 1s linear infinite',
        }"/>
        Caricamento classifica…
      </div>

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
            background: `linear-gradient(135deg, ${podiumColors[idx]}, ${C.violet})`,
            border: `2.5px solid ${podiumColors[idx]}`,
            boxShadow: `0 0 20px ${podiumColors[idx]}66`,
            display: 'grid', placeItems: 'center',
            position: 'relative', zIndex: 2,
            color: '#fff', fontFamily: FF.display, fontSize: '22px', fontWeight: 800,
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
                fontFamily: FF.label, fontSize: '8px', fontWeight: 800,
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
              color: '#fff', fontWeight: 700, padding: '0 6px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }">
              {{ (classifica[idx]._nomeDisplay || classifica[idx].nomeImpero || classifica[idx].nome || classifica[idx].email?.split('@')[0] || '—').slice(0, 14) }}
            </div>

            <!-- Numero di territori -->
            <div :style="{
              fontFamily: FF.label, fontSize: '8px',
              color: 'rgba(241,235,255,0.55)',
              letterSpacing: '0.22em', marginTop: '4px',
              textTransform: 'uppercase', fontWeight: 600,
            }">
              🗺️ {{ classifica[idx]._territori }}
              {{ classifica[idx]._territori === 1 ? 'territorio' : 'territori' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ===== POSIZIONE PERSONALE (se non in top 3) ===== -->
      <div
        v-if="!loading && mioIndice >= 3"
        :style="{
          background: `linear-gradient(135deg, ${C.sakura}22, rgba(13,10,38,0.92))`,
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
            fontFamily: FF.mono, fontSize: '10px',
            color: 'rgba(241,235,255,0.55)', marginTop: '2px',
            letterSpacing: '-0.01em',
          }">
            {{ classifica[mioIndice]._territori }}
            {{ classifica[mioIndice]._territori === 1 ? 'territorio' : 'territori' }}
          </div>
        </div>

        <!-- Premio per la propria posizione -->
        <div :style="{ textAlign: 'right' }">
          <div :style="{ fontFamily: FF.mono, fontSize: '13px', color: C.goldL, fontWeight: 700 }">
            {{ premioPerPosizione(mioIndice + 1) }} 🎴
          </div>
          <div :style="{
            fontSize: '7px', color: 'rgba(241,235,255,0.4)',
            fontFamily: FF.label, letterSpacing: '0.18em',
            textTransform: 'uppercase', marginTop: '2px',
          }">Premio</div>
        </div>
      </div>

      <!-- ===== LISTA COMPLETA ===== -->
      <UiPannelloOrnato
        v-if="!loading && classifica.length > 0"
        :glow="C.gold"
        variant="default"
        :extra-style="{ padding: '0', overflow: 'hidden' }"
      >
        <!-- Intestazione colonne -->
        <div :style="{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px',
          borderBottom: `1px solid ${C.inkLine}`,
          fontFamily: FF.label, fontSize: '8px', letterSpacing: '0.22em',
          color: 'rgba(241,235,255,0.4)', textTransform: 'uppercase', fontWeight: 700,
        }">
          <div :style="{ minWidth: '30px' }">#</div>
          <div :style="{ flex: 1 }">Giocatore</div>
          <div :style="{ minWidth: '60px', textAlign: 'center' }">Territori</div>
          <div :style="{ minWidth: '38px', textAlign: 'right' }">Premio</div>
        </div>

        <!-- Righe classifica con scroll interno -->
        <div :style="{ maxHeight: '440px', overflowY: 'auto' }">
          <div
            v-for="(u, i) in classifica.slice(0, visibili)"
            :key="u.id"
            :style="{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px',
              background: (user && u.id === user.uid)
                ? `linear-gradient(90deg, ${C.gold}1a, transparent)`
                : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              borderLeft: (user && u.id === user.uid)
                ? `3px solid ${C.gold}` : '3px solid transparent',
              borderBottom: '1px solid rgba(174,156,255,0.06)',
              transition: 'background 0.15s',
            }"
          >
            <!-- Posizione: medaglia per top 3, numero per gli altri -->
            <div :style="{ minWidth: '30px', textAlign: 'center' }">
              <span v-if="i < 3" :style="{ fontSize: '18px' }">{{ ['🥇','🥈','🥉'][i] }}</span>
              <span
                v-else
                :style="{
                  fontFamily: FF.mono, fontSize: '11px', fontWeight: (user && u.id === user.uid) ? 800 : 600,
                  color: i < 3 ? podiumColors[i] : (user && u.id === user.uid) ? C.gold : 'rgba(241,235,255,0.4)',
                }"
              >#{{ i + 1 }}</span>
            </div>

            <!-- Nome giocatore con indicatore "TU" -->
            <div :style="{ flex: 1, minWidth: 0 }">
              <div :style="{
                fontFamily: FF.display, fontSize: '11px',
                color: i < 3 ? podiumColors[i] : (user && u.id === user.uid) ? C.gold : 'rgba(241,235,255,0.85)',
                fontWeight: (user && u.id === user.uid) || i < 3 ? 700 : 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }">
                {{ (u._nomeDisplay || u.nomeImpero || u.nome || u.email?.split('@')[0] || 'Giocatore').slice(0, 22) }}
                <span
                  v-if="user && u.id === user.uid"
                  :style="{
                    marginLeft: '6px', fontSize: '8px', color: C.gold,
                    fontFamily: FF.label, letterSpacing: '0.18em',
                  }"
                >← TU</span>
              </div>
            </div>

            <!-- Conteggio territori -->
            <div :style="{
              minWidth: '60px', textAlign: 'center',
              fontFamily: FF.mono, fontSize: '11px', fontWeight: 600,
              color: i < 3 ? podiumColors[i] : (user && u.id === user.uid) ? C.gold : 'rgba(241,235,255,0.55)',
            }">🗺️ {{ u._territori }}</div>

            <!-- Premio per posizione -->
            <div :style="{
              minWidth: '38px', textAlign: 'right',
              fontFamily: FF.mono, fontSize: '10px',
              color: premioPerPosizione(i + 1) >= 3 ? C.goldL : 'rgba(241,235,255,0.4)',
              fontWeight: premioPerPosizione(i + 1) >= 3 ? 700 : 500,
            }">{{ premioPerPosizione(i + 1) }} 🎴</div>
          </div>
        </div>

        <!-- Pulsante "Carica altri 20" per paginazione incrementale -->
        <div
          v-if="visibili < classifica.length"
          :style="{
            padding: '12px 16px', textAlign: 'center',
            borderTop: `1px solid ${C.inkLine}`,
          }"
        >
          <button
            @click="visibili += 20"
            :style="{
              background: 'rgba(245,197,96,0.08)',
              border: `1px solid ${C.gold}40`,
              borderRadius: '10px', color: C.goldL,
              fontFamily: FF.label, fontSize: '10px',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              padding: '8px 20px', cursor: 'pointer',
            }"
          >Carica altri 20 ({{ classifica.length - visibili }} rimanenti)</button>
        </div>

        <!-- Stato vuoto (nessun giocatore) -->
        <div
          v-if="classifica.length === 0"
          :style="{ padding: '40px', textAlign: 'center' }"
        >
          <div :style="{ fontSize: '38px', marginBottom: '8px', filter: `drop-shadow(0 0 12px ${C.gold}88)` }">🏆</div>
          <div :style="{
            fontFamily: FF.label, fontSize: '10px', color: C.gold,
            letterSpacing: '0.24em', marginBottom: '6px',
            textTransform: 'uppercase', fontWeight: 700,
          }">Classifica vuota</div>
          <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">
            Sii il primo a conquistare territori<br/>e scalare la classifica!
          </div>
        </div>
      </UiPannelloOrnato>

      <!-- Nota sui criteri di ordinamento -->
      <div :style="{
        textAlign: 'center', marginTop: '14px',
        fontSize: '8px', color: 'rgba(241,235,255,0.3)',
        fontFamily: FF.label, letterSpacing: '0.22em',
        textTransform: 'uppercase', fontWeight: 600,
      }">
        Criteri · Territori conquistati → Pass Hard (spareggio) → Data iscrizione
      </div>

    </template>
  </div>
</template>
