<!-- ============================================================
  WaifuRankingList: classifica settimanale delle waifu più votate.
  Mostra top 50 paginata e lista delle waifu in pausa anti-monopolio.
  Recupera dati da /api/waifu-ranking/current con token Firebase.
  ============================================================ -->
<script setup lang="ts">
import { Heart } from 'lucide-vue-next'
import { ikUrl, ikImgFallback } from '~/utils/imagekitUrl'
import { getCollezione } from '~/utils/firestoreService'

const props = defineProps<{ user: any }>()

const C = {
  gold:   '#f5c560', goldL: '#ffe9a8',
  sakura: '#ff85b6', aqua:  '#6cf0e0',
  violet: '#a78bfa', ok:    '#58e0a3', err: '#ff5b6c',
}
const FF = {
  display: "var(--ff-display, 'Fredoka', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

const MEDAL       = ['👑', '🥈', '🥉']
const PRIZE_COLORS = [
  '#ffc861','#b0bec5','#cd7f32','#ec4899',
  '#a855f7','#6cf0e0','#58e0a3','#f59e0b','#3b82f6','#ef4444',
]
const PAGE_SIZE = 50

const RARITY_CHAIN  = ['comune','raro','epico','leggendario','immersivo']
const RARITY_COLORS: Record<string, string> = {
  comune: '#9ca3af', raro: '#3b82f6', epico: '#a855f7',
  leggendario: '#f59e0b', immersivo: '#ec4899',
}
const RARITY_NAMES: Record<string, string> = {
  comune: 'Comune', raro: 'Raro', epico: 'Epico',
  leggendario: 'Leggendario', immersivo: 'Immersivo',
}

const ranking     = ref<any>(null)
const paused      = ref<any[]>([])
const subTab      = ref<'top5' | 'pausa'>('top5')
const collezione  = ref<any>(null)
const hasHardPass = ref(false)
const isLive      = ref(false)
const loading     = ref(true)
const page        = ref(0)
const now         = Date.now()

// Countdown fine votazioni (fine mese): tick ogni secondo
const votingEndsAt = ref<number | null>(null)
const nowTick      = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { tickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (tickTimer) clearInterval(tickTimer) })
const monthCountdown = computed(() => {
  if (!votingEndsAt.value) return ''
  const ms = votingEndsAt.value - nowTick.value
  if (ms <= 0) return 'chiuse'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}g ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s % 60}s`
  return `${m}m ${s % 60}s`
})

onMounted(async () => {
  try {
    const token = await props.user.getIdToken()
    const [rankRes, collData] = await Promise.all([
      ($fetch('/api/waifu-ranking/current', { headers: { Authorization: `Bearer ${token}` } })) as Promise<any>,
      getCollezione(props.user.uid),
    ])
    ranking.value     = rankRes.ranking
    paused.value      = rankRes.paused ?? []
    collezione.value  = collData
    hasHardPass.value = !!rankRes.hasHardPass
    isLive.value      = !!rankRes.isLive
    votingEndsAt.value = rankRes.votingEndsAt ?? null
  } finally { loading.value = false }
})

const owns = (waifuId: string): boolean => !!(collezione.value?.waifu?.[waifuId])

function countdown(ms: number): string {
  if (ms <= 0) return 'ora!'
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}g ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

const topList          = computed<any[]>(() => ranking.value?.top5 ?? [])
const totalPages       = computed(() => Math.ceil(topList.value.length / PAGE_SIZE))
const currentPageItems = computed(() => topList.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))
const canPrev          = computed(() => page.value > 0)
const canNext          = computed(() => (page.value + 1) * PAGE_SIZE < topList.value.length)
</script>

<template>
  <div>
    <!-- Sub-tab: Top 50 / In pausa -->
    <div :style="{
      display: 'flex', gap: 0,
      background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
      borderRadius: '12px', padding: '3px', marginBottom: '16px',
    }">
      <button
        v-for="t in [{ id: 'top5', label: '🏆 Top 50' }, { id: 'pausa', label: '⏸ In pausa' }]"
        :key="t.id"
        @click="subTab = (t.id as 'top5' | 'pausa'); page = 0"
        :style="{
          flex: 1, padding: '9px 8px', borderRadius: '10px',
          border: 'none', cursor: 'pointer',
          background: subTab === t.id ? 'var(--theme-tab-active)' : 'transparent',
          color: subTab === t.id ? C.sakura : 'var(--theme-text-2)',
          fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.15em',
          fontWeight: subTab === t.id ? 700 : 500,
          textTransform: 'uppercase', transition: 'all 0.18s',
          boxShadow: subTab === t.id ? '0 2px 8px var(--theme-shadow)' : 'none',
        }"
      >{{ t.label }}</button>
    </div>

    <!-- Caricamento -->
    <AppLoading v-if="loading" />

    <!-- ===== TOP 50 ===== -->
    <div v-else-if="subTab === 'top5'">
      <!-- Classifica non disponibile -->
      <div v-if="!ranking" :style="{
        textAlign: 'center', padding: '40px 20px',
        background: 'var(--theme-shimmer)', borderRadius: '16px',
        border: '1px dashed var(--theme-border)',
      }">
        <div :style="{ fontSize: '48px', marginBottom: '12px', opacity: 0.4 }">🏆</div>
        <div :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 700, color: 'var(--theme-text-2)' }">
          Classifica non ancora disponibile
        </div>
        <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-3)', marginTop: '6px' }">
          I voti si azzerano il 1° di ogni mese
        </div>
      </div>

      <div v-else :style="{ display: 'flex', flexDirection: 'column', gap: '10px' }">
        <!-- Header sezione -->
        <div :style="{
          padding: '12px 16px', borderRadius: '14px',
          background: 'var(--grad-primary-soft), var(--theme-surface)',
          border: '1px solid var(--theme-border)',
          textAlign: 'center', marginBottom: '4px',
        }">
          <div :style="{
            fontFamily: FF.label, fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.2em', color: C.sakura,
            textTransform: 'uppercase', marginBottom: '4px',
          }">
            ✦ Classifica Waifu del Mese ✦
          </div>
          <!-- LIVE + tempo rimanente alle votazioni (fine mese) -->
          <div v-if="isLive || monthCountdown" :style="{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginBottom: '4px', flexWrap:'wrap' }">
            <span v-if="isLive" :style="{
              display: 'inline-flex', alignItems:'center', gap:'5px',
              background: 'rgba(6,214,160,0.15)', border: '1px solid rgba(6,214,160,0.5)',
              borderRadius: '999px', padding: '2px 10px',
              fontFamily: FF.label, fontSize: '12px', color: '#06d6a0', letterSpacing: '0.15em',
            }"><span :style="{ width:'6px', height:'6px', borderRadius:'50%', background:'#06d6a0', display:'inline-block' }"/>{{ $t("leaderboard.live") }}</span>
            <span v-if="monthCountdown" :style="{
              display: 'inline-flex', alignItems:'center', gap:'5px',
              background: 'var(--theme-surface-2)', border: '1px solid var(--theme-border-2)',
              borderRadius: '999px', padding: '2px 10px',
              fontFamily: FF.mono, fontSize: '12px', color: 'var(--theme-text-2)', letterSpacing: '0.04em',
            }">⏳ {{ monthCountdown }}</span>
          </div>
          <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)' }">
            Top 50 del mese · le prime 10 ricevono Kisses bonus a fine mese
          </div>
        </div>

        <!-- Paginazione -->
        <div v-if="topList.length > PAGE_SIZE" :style="{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px',
        }">
          <button :disabled="!canPrev" @click="page = Math.max(0, page - 1)" :style="{
            background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
            borderRadius: '8px', padding: '7px 16px',
            color: !canPrev ? 'var(--theme-text-3)' : 'var(--theme-text)',
            cursor: !canPrev ? 'default' : 'pointer',
            fontFamily: FF.label, fontSize: '13px', fontWeight: 700,
          }">{{ $t("leaderboard.prev") }}</button>
          <span :style="{ fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text-2)' }">
            {{ page * PAGE_SIZE + 1 }}–{{ Math.min((page + 1) * PAGE_SIZE, topList.length) }} di {{ topList.length }}
          </span>
          <button :disabled="!canNext" @click="page = page + 1" :style="{
            background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
            borderRadius: '8px', padding: '7px 16px',
            color: !canNext ? 'var(--theme-text-3)' : 'var(--theme-text)',
            cursor: !canNext ? 'default' : 'pointer',
            fontFamily: FF.label, fontSize: '13px', fontWeight: 700,
          }">{{ $t("leaderboard.next") }}</button>
        </div>

        <!-- Righe waifu -->
        <div v-for="(item, j) in currentPageItems" :key="item.waifuId" :style="{
          position: 'relative', borderRadius: '16px', overflow: 'visible',
          background: (page * PAGE_SIZE + j) < 3
            ? `linear-gradient(135deg, ${PRIZE_COLORS[page * PAGE_SIZE + j] ?? PRIZE_COLORS[9]}18, var(--theme-surface))`
            : 'var(--theme-shimmer)',
          border: `1.5px solid ${PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)]}${(page * PAGE_SIZE + j) < 3 ? '55' : (page * PAGE_SIZE + j) < 10 ? '30' : '18'}`,
          boxShadow: (page * PAGE_SIZE + j) < 3 ? `0 4px 20px ${PRIZE_COLORS[page * PAGE_SIZE + j]}20` : 'none',
          padding: '14px 16px',
          opacity: (page * PAGE_SIZE + j) < 10 ? 1 : 0.75,
        }">
          <!-- Shine top 3 -->
          <div v-if="(page * PAGE_SIZE + j) < 3" :style="{
            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: `linear-gradient(90deg, transparent, ${PRIZE_COLORS[page * PAGE_SIZE + j]}70, transparent)`,
            pointerEvents: 'none',
          }" />

          <!-- Separatore senza premio -->
          <div v-if="page * PAGE_SIZE + j === 10" :style="{
            position: 'absolute', top: '-8px', left: '16px', right: '16px', textAlign: 'center',
          }">
            <span :style="{
              fontFamily: FF.label, fontSize: '11px', fontWeight: 700,
              color: 'var(--theme-text-3)', letterSpacing: '0.18em',
              background: 'var(--grad-primary-soft), var(--theme-surface)', padding: '0 8px',
            }">{{ $t("leaderboard.no_prize") }}</span>
          </div>

          <div :style="{ display: 'flex', alignItems: 'center', gap: '14px' }">
            <!-- Medaglia / numero posizione -->
            <div :style="{ minWidth: '40px', textAlign: 'center', flexShrink: 0 }">
              <div v-if="(page * PAGE_SIZE + j) < 3" :style="{ fontSize: '28px', lineHeight: 1 }">
                {{ MEDAL[page * PAGE_SIZE + j] }}
              </div>
              <div v-else :style="{
                width: '32px', height: '32px', borderRadius: '50%',
                background: `${PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)]}18`,
                border: `1px solid ${PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)]}40`,
                display: 'grid', placeItems: 'center',
                fontFamily: FF.label, fontSize: '14px', fontWeight: 800,
                color: PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)],
              }">{{ page * PAGE_SIZE + j + 1 }}</div>
            </div>

            <!-- Immagine waifu -->
            <div v-if="!(item.hot && !hasHardPass) && item.image" :style="{
              width: '44px', height: '60px', borderRadius: '8px',
              overflow: 'hidden', flexShrink: 0,
              border: `1px solid ${PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)]}40`,
            }">
              <img :src="ikUrl(item.image, 'thumbnail') ?? item.image" :alt="item.nome"
                @error="ikImgFallback"
                :style="{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }" />
            </div>

            <!-- Info waifu -->
            <div :style="{
              flex: 1, minWidth: 0,
              filter: (item.hot && !hasHardPass) ? 'blur(4px)' : 'none',
              userSelect: (item.hot && !hasHardPass) ? 'none' : 'auto',
            }">
              <div :style="{
                fontFamily: FF.label, fontSize: '16px', fontWeight: 800,
                color: 'var(--theme-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px',
              }">
                {{ (item.hot && !hasHardPass) ? '🔞 Solo Hard Pass' : item.nome }}
              </div>

              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }">
                <span :style="{ fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text-2)' }">
                  ♥ {{ item.likeCount.toLocaleString() }}
                </span>
                <span v-if="owns(item.waifuId)" :style="{
                  fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.12em',
                  color: C.ok, background: 'rgba(88,224,163,0.12)',
                  border: '1px solid rgba(88,224,163,0.3)',
                  borderRadius: '5px', padding: '2px 8px', textTransform: 'uppercase',
                }">{{ $t("leaderboard.yours") }}</span>
              </div>

              <!-- Rarità -->
              <div v-if="item.rarita" :style="{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }">
                <span :style="{
                  fontFamily: FF.label, fontSize: '12px',
                  color: RARITY_COLORS[item.rarita] ?? '#888',
                  background: `${RARITY_COLORS[item.rarita] ?? '#888'}18`,
                  border: `1px solid ${RARITY_COLORS[item.rarita] ?? '#888'}40`,
                  borderRadius: '4px', padding: '2px 8px',
                }">{{ $t("rarity." + item.rarita) }}</span>

                <template v-if="RARITY_CHAIN[RARITY_CHAIN.indexOf(item.rarita) + 1] && (page * PAGE_SIZE + j) < 10">
                  <span :style="{ color: 'var(--theme-text-3)', fontSize: '12px' }">→</span>
                  <span :style="{
                    fontFamily: FF.label, fontSize: '12px',
                    color: RARITY_COLORS[RARITY_CHAIN[RARITY_CHAIN.indexOf(item.rarita) + 1]],
                    background: `${RARITY_COLORS[RARITY_CHAIN[RARITY_CHAIN.indexOf(item.rarita) + 1]]}18`,
                    border: `1px solid ${RARITY_COLORS[RARITY_CHAIN[RARITY_CHAIN.indexOf(item.rarita) + 1]]}40`,
                    borderRadius: '4px', padding: '2px 8px',
                  }">{{ $t("rarity." + RARITY_CHAIN[RARITY_CHAIN.indexOf(item.rarita) + 1]) }}</span>
                  <span :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-text-3)' }">{{ $t("leaderboard.if_wins") }}</span>
                </template>
              </div>
            </div>

          </div>

          <!-- Chip PREMIO — semi-esterno in alto a destra (top 10), cuore outline come l'header -->
          <div v-if="(page * PAGE_SIZE + j) < 10" :style="{
            position: 'absolute', top: '-11px', right: '-6px', zIndex: 5,
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'var(--grad-primary-soft), var(--theme-surface)',
            border: `1.5px solid ${PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)]}aa`,
            borderRadius: '999px', padding: '4px 12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }">
            <Heart :size="13" stroke-width="1.5" style="color:#D946A8;flex-shrink:0;" />
            <span :style="{
              fontFamily: FF.label, fontSize: '14px', fontWeight: 800,
              color: PRIZE_COLORS[Math.min(page * PAGE_SIZE + j, 9)],
            }">{{ item.prize }}</span>
            <span :style="{
              fontFamily: FF.label, fontSize: '11px', fontWeight: 700,
              color: 'var(--theme-text-3)', letterSpacing: '0.12em', textTransform: 'uppercase',
            }">{{ $t("leaderboard.prize_lc") }}</span>
          </div>
        </div>

        <!-- CTA Swap -->
        <div :style="{
          marginTop: '8px', padding: '14px 16px', borderRadius: '14px', textAlign: 'center',
          background: 'var(--grad-primary-soft), var(--theme-surface)', border: '1px dashed var(--theme-border)',
        }">
          <i18n-t keypath="leaderboard.vote_in_swap" tag="div" scope="global"
            :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', lineHeight: 1.5 }">
            <template #section><strong :style="{ color: C.sakura }">Swap</strong></template>
          </i18n-t>
        </div>
      </div>
    </div>

    <!-- ===== IN PAUSA ===== -->
    <div v-else-if="subTab === 'pausa'" :style="{ display: 'flex', flexDirection: 'column', gap: '10px' }">
      <div v-if="paused.length === 0" :style="{
        textAlign: 'center', padding: '40px',
        color: 'var(--theme-text-3)', fontFamily: FF.label, fontSize: '14px',
      }">
        Nessuna waifu attualmente in pausa.
      </div>

      <div v-for="p in paused" :key="p.waifuId" :style="{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
        borderRadius: '14px', padding: '14px 16px',
      }">
        <div>
          <div :style="{
            fontFamily: FF.label, fontSize: '12px', fontWeight: 700,
            color: C.violet, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: '4px',
          }">{{ $t("leaderboard.anti_monopoly") }}</div>
          <div :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 700, color: 'var(--theme-text)' }">
            {{ p.waifuId }}
          </div>
        </div>
        <div :style="{ textAlign: 'right' }">
          <div :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 800, color: C.sakura }">
            ↩ {{ countdown(p.pausedUntilMs - now) }}
          </div>
          <div :style="{
            fontFamily: FF.label, fontSize: '11px', fontWeight: 600,
            color: 'var(--theme-text-3)', textTransform: 'uppercase',
            letterSpacing: '0.12em', marginTop: '2px',
          }">{{ $t("leaderboard.on_return") }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
