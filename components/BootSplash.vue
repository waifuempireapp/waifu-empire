<!-- Splash di AVVIO (solo boot, usato in app.vue via useSplash): logo Waifu Empire
     + CARTE dell'ULTIMA espansione — carte vere (cornice rarità + nome, come in
     collezione/sbusto), non illustrazioni nude. Elenco e cornice sono generati da
     scripts/build-splash-cards.mjs (utils/splashCards.ts). Grafica identica allo spa-loading-template.html
     (fase pre-JS) → handoff invisibile: stessi keyframe e stessa fase, riagganciata
     via __iwSplashStart. I loading INTERNI all'app usano invece AppLoading (solo spinner su
     sfondo blurrato), NON questo. -->
<template>
  <div ref="root" class="iw-splash">
    <div class="iw-rays" />
    <div class="iw-haze" />
    <div class="iw-cards">
      <div
        v-for="(carta, i) in cards" :key="carta.file"
        class="iw-c" :class="[`iw-c${i + 1}`, `iw-${carta.profondita}`, `iw-r-${carta.rarita}`]"
      >
        <img :src="carta.file" alt="" @error="onImgErr">
        <span class="iw-c__nome">{{ carta.nome }}</span>
        <span class="iw-c__dati">
          <span class="iw-v">&#9889;<b>{{ carta.vel }}</b></span>
          <span class="iw-hp">&#128154;<b>{{ carta.hp }}</b></span>
          <span class="iw-cr">&#128165;<b>{{ carta.crit }}%</b></span>
        </span>
        <span class="iw-c__circ">
          <i v-for="(v, k) in carta.stat" :key="k" :style="{ '--v': v, '--sc': coloriStat[k] }"><b>{{ v }}</b></i>
        </span>
      </div>
    </div>
    <div class="iw-vig" />
    <img class="iw-logo" src="/splash/logo.png" alt="Waifu Empire">
    <div class="iw-spin" />
  </div>
</template>

<script setup lang="ts">
// Le carte "respirano" (zoom in/out) già nel template pre-JS. Qui riallineiamo le
// nostre animazioni alla fase di quelle: stesso startTime sulla timeline del documento
// (ogni carta conserva il proprio --cd) → al passaggio HTML statico → app le carte non
// saltano di dimensione. Stimare il tempo trascorso con performance.now() non basta:
// fra onMounted e il primo calcolo di stile dell'elemento passano centinaia di ms.
const root = ref<HTMLElement | null>(null)
onMounted(() => {
  // Sia __iwSplashStart sia getAnimations() possono non essere ancora pronti al primo
  // giro (animazione pending / stili non risolti): si ritenta per qualche frame.
  const sync = (retry: number) => {
    const start = (window as unknown as { __iwSplashStart?: number }).__iwSplashStart
    const elementi = root.value?.querySelectorAll<HTMLElement>('.iw-c')
    if (start != null && elementi?.length) {
      let found = 0
      for (const el of elementi) {
        for (const anim of el.getAnimations()) { anim.startTime = start; found++ }
      }
      if (found) return
    }
    if (retry > 0) requestAnimationFrame(() => sync(retry - 1))
  }
  sync(6)
})

// Carte dell'ultima espansione: stesso elenco (file, nome, rarità) da cui lo
// script genera il blocco dentro spa-loading-template.html, così la fase pre-JS
// e questa disegnano esattamente le stesse carte.
const cards = SPLASH_CARDS
const coloriStat = SPLASH_STAT_COLORI

// Se una carta manca (prima di rilanciare build-splash-cards.mjs dopo una nuova
// espansione), nascondi l'intera carta: mostrarne la sola cornice vuota sarebbe
// peggio dell'icona rotta.
function onImgErr(ev: Event) {
  const card = (ev.target as HTMLElement | null)?.closest('.iw-c') as HTMLElement | null
  if (card) card.style.display = 'none'
}
</script>

<style scoped>
.iw-splash {
  position: fixed; inset: 0; overflow: hidden; z-index: 9999;
  background: radial-gradient(circle at 50% 42%, #241548 0%, #140d2b 45%, #0b0818 100%);
}
.iw-rays {
  position: absolute; top: 50%; left: 50%; width: 200vmax; height: 200vmax;
  transform: translate(-50%, -50%);
  background: repeating-conic-gradient(from 0deg,
    rgba(167,139,250,0.09) 0deg 6deg, rgba(167,139,250,0) 6deg 12deg);
  -webkit-mask-image: radial-gradient(circle,#000 0%,#000 30%,transparent 62%);
          mask-image: radial-gradient(circle,#000 0%,#000 30%,transparent 62%);
}
/* SFONDO in profondita': foschia chiara al centro (prospettiva aerea) e
   vignettatura scura ai bordi. Insieme allo sfocato delle carte lontane danno
   l'impressione di uno spazio che si allontana invece di un collage piatto. */
.iw-haze{position:absolute;inset:0;pointer-events:none;z-index:1;
  background:radial-gradient(ellipse 70% 45% at 50% 46%,
    rgba(167,139,250,0.20) 0%,rgba(120,90,210,0.10) 38%,rgba(11,8,24,0) 70%);}
.iw-vig{position:absolute;inset:0;pointer-events:none;z-index:5;
  background:radial-gradient(ellipse 78% 62% at 50% 48%,
    rgba(0,0,0,0) 45%,rgba(7,5,20,0.45) 78%,rgba(5,3,14,0.78) 100%);}
.iw-cards { position: absolute; inset: 0; }
/* --r = rotazione fissa della carta, --cd = sfasamento del respiro (niente pulsare
   all'unisono). La fase condivisa col template pre-JS la riallinea lo script sopra. */
/* PROFONDITA'. Le carte non sono tutte uguali: --k e' il fattore di scala della
   singola carta (primo piano .92, intermedia .72, sfondo .55) e da li' scendono
   larghezza, corpo del testo e cerchi, cosi' basta un numero per "avvicinare" o
   "allontanare" una carta. Le piu' lontane sono anche piu' sfocate, piu' scure e
   respirano di meno: e' la stessa lettura di una profondita' di campo. */
.iw-d1{--k:.92; --s0:.86; --s1:1.16; --ty:4px; z-index:4;
  filter:none; opacity:1}
.iw-d2{--k:.72; --s0:.88; --s1:1.16; --ty:3px; z-index:3;
  filter:saturate(.92) brightness(.86) blur(.4px); opacity:.94}
.iw-d3{--k:.55; --s0:.90; --s1:1.16; --ty:3px; z-index:2;
  filter:saturate(.78) brightness(.66) blur(1.2px); opacity:.8}
/* Sullo sfondo i dati sarebbero poltiglia: restano solo arte e bordo rarita',
   esattamente come quando una cosa e' fuori fuoco. */
.iw-d3 .iw-c__nome,.iw-d3 .iw-c__dati,.iw-d3 .iw-c__circ{display:none}

/* Cornice CARTA — replica compatta di CartaWaifu (collezione/sbusto): bordo rarita',
   nome in alto, riga velocita'/HP/crit e i cinque cerchi statistica. I numeri sono
   PRECALCOLATI da scripts/build-splash-cards.mjs con le formule di battleEngine:
   qui non gira JavaScript. Colori identici a RARITY_BORDER in CartaWaifu.vue: se
   cambiano la', vanno riportati qui E in BootSplash.vue. */
.iw-c{position:absolute;width:min(calc(var(--k) * 86px),calc(var(--k) * 24vw));
  aspect-ratio:2/3;border-radius:calc(var(--k) * 10px);overflow:hidden;background:var(--rbg);
  outline:max(1px,calc(var(--k) * 2.4px)) solid var(--ro);
  box-shadow:0 calc(var(--k) * 6px) calc(var(--k) * 16px) rgba(0,0,0,0.55),0 0 calc(var(--k) * 13px) var(--rg);
  will-change:transform;
  transform:rotate(var(--r)) scale(var(--s0)) translateY(var(--ty));
  animation:iw-breathe 3.4s ease-in-out infinite;
  animation-delay:var(--cd);}
/* ZOOM IN / ZOOM OUT: l'ampiezza la portano --s0/--s1 del piano di profondità.
   NB: questi keyframe sono indispensabili — senza, l'elemento resta fermo sulla
   transform statica (cioè a scale(--s0)) e le carte sembrano immobili. */
@keyframes iw-breathe {
  0%, 100% { transform: rotate(var(--r)) scale(var(--s0)) translateY(var(--ty)) }
  50%      { transform: rotate(var(--r)) scale(var(--s1)) translateY(calc(var(--ty) * -1)) }
}
.iw-c::before{content:'';position:absolute;left:0;right:0;bottom:0;height:52%;
  background:linear-gradient(0deg,rgba(0,0,0,0.93) 0%,rgba(0,0,0,0.55) 45%,transparent 100%);
  pointer-events:none;z-index:1;}
.iw-c::after{content:'';position:absolute;inset:2px;border-radius:calc(var(--k) * 8px);
  border:1px solid var(--ri);pointer-events:none;z-index:3;}
.iw-c img{width:100%;height:100%;object-fit:cover;display:block;}
.iw-c__nome{position:absolute;left:0;right:0;top:0;z-index:2;
  padding:calc(var(--k) * 4px) calc(var(--k) * 6px) calc(var(--k) * 12px);
  font-family:'Fredoka','DM Sans',system-ui,sans-serif;
  font-size:calc(var(--k) * 10px);font-weight:700;color:#fff;line-height:1;text-align:left;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  background:linear-gradient(180deg,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.25) 60%,transparent 100%);
  text-shadow:0 0 8px var(--rg),0 1px 3px rgba(0,0,0,0.9);}
.iw-c__dati{position:absolute;left:0;right:0;bottom:calc(var(--k) * 25px);z-index:2;
  display:flex;justify-content:space-around;align-items:center;
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:calc(var(--k) * 8.5px);line-height:1;}
.iw-c__dati b{font-weight:800;margin-left:1px;}
.iw-c__dati .iw-v {color:#6cf0e0}
.iw-c__dati .iw-hp{color:#06d6a0}
.iw-c__dati .iw-cr{color:#fbbf24}
.iw-c__circ{position:absolute;left:0;right:0;bottom:calc(var(--k) * 4px);z-index:2;
  display:flex;justify-content:space-around;align-items:center;padding:0 calc(var(--k) * 3px);}
.iw-c__circ i{position:relative;width:calc(var(--k) * 17px);height:calc(var(--k) * 17px);
  border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;
  background:conic-gradient(var(--sc) calc(var(--v) * 36deg),rgba(255,255,255,0.10) 0);}
.iw-c__circ i::before{content:'';position:absolute;inset:calc(var(--k) * 2.6px);border-radius:50%;
  background:rgba(7,5,26,0.88);}
.iw-c__circ b{position:relative;z-index:1;font-size:calc(var(--k) * 6.8px);font-weight:700;color:#fff;
  font-family:'JetBrains Mono',ui-monospace,monospace;line-height:1;}
/* Palette rarita' — identica a RARITY_BORDER */
.iw-r-comune     {--ro:#b4bcc8;--ri:rgba(223,229,239,.23);--rg:rgba(180,188,200,.45);--rbg:linear-gradient(160deg,#293142,#0c0e1a)}
.iw-r-raro       {--ro:#5aa9ff;--ri:rgba(159,202,255,.23);--rg:rgba(90,169,255,.55);--rbg:linear-gradient(160deg,#142a55,#06112c)}
.iw-r-epico      {--ro:#b573ff;--ri:rgba(218,186,255,.23);--rg:rgba(181,115,255,.55);--rbg:linear-gradient(160deg,#2a1255,#10052a)}
.iw-r-leggendario{--ro:#ffc861;--ri:rgba(255,233,168,.23);--rg:rgba(255,200,97,.65);--rbg:linear-gradient(160deg,#4a3105,#1d1102)}
.iw-r-immersivo  {--ro:#ff7eb6;--ri:rgba(255,195,218,.23);--rg:rgba(255,126,182,.7);--rbg:linear-gradient(160deg,#4f1245,#1e0420)}
/* Posizioni SPARSE: generate cercando una disposizione senza collisioni con le
   carte al MASSIMO dello zoom, tenendo libere la fascia del logo e quella dello
   spinner. Vicine, intermedie e lontane sono mescolate di proposito: una piccola
   accanto a una grande e' cio' che fa leggere la profondita'. */
.iw-c1 {left:61.6%; top:62.7%; --r:-8deg; --cd:-2.43s}
.iw-c2 {left:80.4%; top:36.3%; --r:-7deg; --cd:-1.46s}
.iw-c3 {left:13.6%; top:19.6%; --r:-6deg; --cd:-0.49s}
.iw-c4 {left:7.2%; top:33.9%; --r:-5deg; --cd:-2.92s}
.iw-c5 {left:33.4%; top:23.0%; --r:-4deg; --cd:-1.95s}
.iw-c6 {left:63.2%; top:80.4%; --r:-3deg; --cd:-0.98s}
.iw-c7 {left:7.4%; top:72.3%; --r:-2deg; --cd:-0.01s}
.iw-c8 {left:41.4%; top:5.3%; --r:-1deg; --cd:-2.44s}
.iw-c9 {left:24.2%; top:62.5%; --r:0deg; --cd:-1.47s}
.iw-c10{left:69.2%; top:5.1%; --r:1deg; --cd:-0.5s}
.iw-c11{left:11.9%; top:84.6%; --r:2deg; --cd:-2.93s}
.iw-c12{left:4.9%; top:47.9%; --r:3deg; --cd:-1.96s}
.iw-c13{left:69.4%; top:17.2%; --r:4deg; --cd:-0.99s}
.iw-c14{left:16.4%; top:2.4%; --r:5deg; --cd:-0.02s}
.iw-c15{left:82.6%; top:78.9%; --r:6deg; --cd:-2.45s}
.iw-logo {
  z-index: 6; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(76vw, 420px); filter: drop-shadow(0 6px 26px rgba(167,139,250,0.5));
}
.iw-spin {
  z-index: 6; position: absolute; left: 50%; bottom: 9%; transform: translateX(-50%);
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid rgba(167,139,250,0.22); border-top-color: #a78bfa;
  animation: iw-rot 0.9s linear infinite;
}
@keyframes iw-rot { to { transform: translateX(-50%) rotate(360deg) } }
@media (prefers-reduced-motion: reduce) {
  .iw-spin { animation-duration: 1.6s }
  .iw-c { animation: none; transform: rotate(var(--r)) scale(var(--s1)) }
}
</style>
