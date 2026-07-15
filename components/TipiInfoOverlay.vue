<!-- ============================================================
  Popup informativo sui TIPI: il cerchio delle efficacie.
  Diagramma SVG a pentagono (freccia piena = ×2 Super efficace,
  tratteggiata = ×1.5 Efficace) + moltiplicatori e schede per tipo.
  Aperto dal bottone "i" nell'header (evento impero:apri-tipi).
  ============================================================ -->
<script setup lang="ts">
import { TYPE_NAMES, TYPE_COLORS } from '~/utils/battleEngine'

const emit = defineEmits<{ close: [] }>()

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

const TYPES = [...TYPE_NAMES]
const colOf = (t: string) => TYPE_COLORS[t]?.border ?? '#888'

// Geometria pentagono (SVG viewBox 240x240)
const CX = 120, CY = 122, R = 88
function nodePos(i: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
  return { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R }
}
/** Punto lungo la corda i→j, accorciata per non entrare nei nodi. */
function arrow(i: number, j: number) {
  const a = nodePos(i), b = nodePos(j)
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const PAD = 28
  return {
    x1: a.x + (dx / len) * PAD, y1: a.y + (dy / len) * PAD,
    x2: b.x - (dx / len) * PAD, y2: b.y - (dy / len) * PAD,
  }
}

// Relazioni per tipo (attaccante): delta1 ×2, delta2 ×1.5, delta4 ×0.5, delta3 ×0
const relazioni = TYPES.map((t, i) => ({
  tipo: t,
  super_: TYPES[(i + 1) % 5],
  eff:    TYPES[(i + 2) % 5],
  poco:   TYPES[(i + 4) % 5],
  nulla:  TYPES[(i + 3) % 5],
}))
</script>

<template>
  <div class="tipi-overlay" @click.self="emit('close')">
    <div class="tipi-panel">
      <div class="tipi-head">
        <span class="tipi-title" :style="{ fontFamily: FF.display }">Tipi & Debolezze</span>
        <button class="tipi-close" @click="emit('close')">✕</button>
      </div>

      <div class="tipi-body">
        <!-- ── Diagramma: il cerchio dei tipi ── -->
        <div class="tipi-diagram">
          <svg viewBox="0 0 240 240" style="width:100%;max-width:300px;display:block;margin:0 auto;">
            <defs>
              <marker v-for="t in TYPES" :key="'m'+t" :id="'arr-' + t" viewBox="0 0 8 8"
                refX="7" refY="4" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" :fill="colOf(t)" />
              </marker>
            </defs>
            <!-- Frecce ×2 (piene) e ×1.5 (tratteggiate) -->
            <template v-for="(t, i) in TYPES" :key="'l'+t">
              <line v-bind="arrow(i, (i + 1) % 5)"
                :stroke="colOf(t)" stroke-width="2.6" :marker-end="'url(#arr-' + t + ')'" opacity="0.95" />
              <line v-bind="arrow(i, (i + 2) % 5)"
                :stroke="colOf(t)" stroke-width="1.7" stroke-dasharray="4 4"
                :marker-end="'url(#arr-' + t + ')'" opacity="0.55" />
            </template>
            <!-- Nodi -->
            <template v-for="(t, i) in TYPES" :key="'n'+t">
              <circle :cx="nodePos(i).x" :cy="nodePos(i).y" r="24"
                :fill="'var(--theme-surface)'" :stroke="colOf(t)" stroke-width="2.5" />
              <text :x="nodePos(i).x" :y="nodePos(i).y + 3" text-anchor="middle"
                :fill="colOf(t)" :style="{ fontFamily: FF.label, fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' }">
                {{ t }}
              </text>
            </template>
          </svg>
          <div class="tipi-legend" :style="{ fontFamily: FF.body }">
            <span><i class="tl-line" /> ×2 Super efficace</span>
            <span><i class="tl-line tl-line--dash" /> ×1.5 Efficace</span>
          </div>
        </div>

        <!-- ── Moltiplicatori di danno ── -->
        <div class="tipi-section-title" :style="{ fontFamily: FF.label }">Moltiplicatori di danno</div>
        <div class="tipi-mults" :style="{ fontFamily: FF.body }">
          <div class="tipi-mult"><b style="color:#58e0a3">×2</b><em>Super efficace</em><span>+100%</span></div>
          <div class="tipi-mult"><b style="color:#8bd17c">×1.5</b><em>Efficace</em><span>+50%</span></div>
          <div class="tipi-mult"><b style="color:var(--theme-text-2)">×1</b><em>Normale</em><span>pieno</span></div>
          <div class="tipi-mult"><b style="color:#f5a623">×0.5</b><em>Poco efficace</em><span>−50%</span></div>
          <div class="tipi-mult"><b style="color:#ff5b6c">×0</b><em>Non efficace</em><span>nessuno</span></div>
          <div class="tipi-mult"><b style="color:#f5c560">×1.75</b><em>Critico</em><span>sul totale</span></div>
        </div>

        <!-- ── Schede per tipo ── -->
        <div class="tipi-section-title" :style="{ fontFamily: FF.label }">Chi batte chi</div>
        <div class="tipi-cards">
          <div v-for="r in relazioni" :key="r.tipo" class="tipi-card" :style="{ borderColor: colOf(r.tipo) + '66' }">
            <div class="tipi-card-name" :style="{ fontFamily: FF.label, color: colOf(r.tipo) }">{{ r.tipo }}</div>
            <div class="tipi-rows" :style="{ fontFamily: FF.body }">
              <div class="tipi-row"><span class="tr-k" style="color:#58e0a3">×2</span><span class="tr-chip" :style="{ borderColor: colOf(r.super_), color: colOf(r.super_) }">{{ r.super_ }}</span></div>
              <div class="tipi-row"><span class="tr-k" style="color:#8bd17c">×1.5</span><span class="tr-chip" :style="{ borderColor: colOf(r.eff), color: colOf(r.eff) }">{{ r.eff }}</span></div>
              <div class="tipi-row"><span class="tr-k" style="color:#f5a623">×0.5</span><span class="tr-chip" :style="{ borderColor: colOf(r.poco), color: colOf(r.poco) }">{{ r.poco }}</span></div>
              <div class="tipi-row"><span class="tr-k" style="color:#ff5b6c">×0</span><span class="tr-chip" :style="{ borderColor: colOf(r.nulla), color: colOf(r.nulla) }">{{ r.nulla }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tipi-overlay {
  position: fixed; inset: 0; z-index: 110;
  background: var(--theme-overlay); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 640px) { .tipi-overlay { align-items: center; } }
.tipi-panel {
  width: 100%; max-width: 440px; max-height: 92dvh;
  display: flex; flex-direction: column;
  background: var(--theme-surface); border: 1px solid var(--theme-border);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -8px 40px var(--theme-shadow); overflow: hidden;
}
@media (min-width: 640px) { .tipi-panel { border-radius: 22px; max-width: min(440px, calc(100vw - 32px)); } }
.tipi-head {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--theme-border);
}
.tipi-title { font-size: 15px; font-weight: 900; color: var(--theme-text); }
.tipi-close {
  width: 34px; height: 34px; border-radius: 10px;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  color: var(--theme-text-2); font-size: 14px; cursor: pointer;
}
.tipi-body { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 16px; }

.tipi-diagram { margin-bottom: 6px; }
.tipi-legend {
  display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;
  font-size: 11px; color: var(--theme-text-2); margin-top: 8px;
}
.tipi-legend span { display: inline-flex; align-items: center; gap: 6px; }
.tl-line { display: inline-block; width: 20px; height: 0; border-top: 2.5px solid var(--theme-text-2); }
.tl-line--dash { border-top-style: dashed; opacity: 0.7; }

.tipi-section-title {
  font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--theme-text-2); margin: 18px 0 10px;
}
/* Moltiplicatori: 3 colonne compatte (valore, nome, percentuale) */
.tipi-mults { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tipi-mult {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--theme-surface-2); border: 1px solid var(--theme-border);
  border-radius: 12px; padding: 9px 4px; text-align: center;
  color: var(--theme-text);
}
.tipi-mult b { font-size: 15px; line-height: 1.1; }
.tipi-mult em { font-style: normal; font-size: 10px; font-weight: 700; line-height: 1.2; }
.tipi-mult span { color: var(--theme-text-3); font-size: 9.5px; font-weight: 500; }

.tipi-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tipi-card {
  background: var(--theme-surface-2); border: 1.5px solid var(--theme-border);
  border-radius: 14px; padding: 10px 12px;
}
.tipi-card-name { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
.tipi-rows { display: flex; flex-direction: column; gap: 5px; }
.tipi-row { display: flex; align-items: center; gap: 8px; }
.tr-k { font-size: 11px; font-weight: 800; min-width: 30px; }
.tr-chip {
  font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  border: 1.5px solid; border-radius: 8px; padding: 2px 8px;
}
</style>
