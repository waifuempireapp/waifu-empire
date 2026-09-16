<!-- Splash di AVVIO (solo boot, usato in app.vue via useSplash): logo Waifu Empire
     + carte dell'ULTIMA espansione (public/splash/, rigenerate da
     scripts/build-splash-cards.mjs). Grafica identica allo spa-loading-template.html
     (fase pre-JS) → handoff invisibile: stessi keyframe e stessa fase, riagganciata
     via __iwSplashStart. I loading INTERNI all'app usano invece AppLoading (solo spinner su
     sfondo blurrato), NON questo. -->
<template>
  <div ref="root" class="iw-splash">
    <div class="iw-rays" />
    <div class="iw-cards">
      <img v-for="n in 14" :key="n" class="iw-c" :class="`iw-c${n}`" :src="`/splash/card${n}.webp`" alt="" @error="onImgErr">
    </div>
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
    const cards = root.value?.querySelectorAll<HTMLElement>('.iw-c')
    if (start != null && cards?.length) {
      let found = 0
      for (const card of cards) {
        for (const anim of card.getAnimations()) { anim.startTime = start; found++ }
      }
      if (found) return
    }
    if (retry > 0) requestAnimationFrame(() => sync(retry - 1))
  }
  sync(6)
})

// Se una carta manca (prima di rilanciare build-splash-cards.mjs dopo una nuova
// espansione), nascondila invece di mostrare l'icona rotta.
function onImgErr(ev: Event) {
  const img = ev.target as HTMLImageElement | null
  if (img) img.style.display = 'none'
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
.iw-cards { position: absolute; inset: 0; }
/* --r = rotazione fissa della carta, --cd = sfasamento del respiro (niente pulsare
   all'unisono). La fase condivisa col template pre-JS la riallinea lo script sopra. */
.iw-c {
  position: absolute; width: min(15vw, 74px); border-radius: 7px;
  box-shadow: 0 5px 14px rgba(0,0,0,0.5); will-change: transform;
  transform: rotate(var(--r)) scale(1);
  animation: iw-breathe 3.4s ease-in-out infinite;
  animation-delay: var(--cd);
}
/* Zoom in/out: le carte si avvicinano e si allontanano. L'escursione deve restare
   ben percepibile (0.88 → 1.16): sotto il ~10% su card da 74px il movimento non si
   legge a occhio. translateY accompagna la scala e vende la profondità (la carta
   "viene avanti" invece di gonfiarsi sul posto). */
@keyframes iw-breathe {
  0%, 100% { transform: rotate(var(--r)) scale(0.88) translateY(3px) }
  50%      { transform: rotate(var(--r)) scale(1.16) translateY(-4px) }
}
/* anello esterno (bordi) */
.iw-c1 { left:3%;  top:6%;    --r:-13deg; --cd:0s}
.iw-c2 { left:27%; top:2%;    --r:-5deg;  --cd:-1.1s}
.iw-c3 { right:27%;top:3%;    --r:6deg;   --cd:-2s}
.iw-c4 { right:3%; top:7%;    --r:13deg;  --cd:-0.6s}
.iw-c5 { left:1%;  top:44%;   --r:-9deg;  --cd:-1.6s}
.iw-c6 { right:1%; top:42%;   --r:9deg;   --cd:-2.6s}
.iw-c7 { left:4%;  bottom:5%; --r:10deg;  --cd:-0.8s}
.iw-c8 { right:4%; bottom:6%; --r:-12deg; --cd:-2.3s}
/* anello interno (verso il centro, dietro il logo) */
.iw-c9 { left:19%; top:23%;   --r:-8deg;  --cd:-0.3s}
.iw-c10{ right:19%;top:21%;   --r:7deg;   --cd:-1.9s}
.iw-c11{ left:21%; bottom:21%;--r:9deg;   --cd:-2.9s}
.iw-c12{ right:21%;bottom:19%;--r:-7deg;  --cd:-1.3s}
.iw-c13{ left:12%; top:64%;   --r:6deg;   --cd:-2.2s}
.iw-c14{ right:12%;top:62%;   --r:-6deg;  --cd:-0.45s}
.iw-logo {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(76vw, 420px); filter: drop-shadow(0 6px 26px rgba(167,139,250,0.5));
}
.iw-spin {
  position: absolute; left: 50%; bottom: 9%; transform: translateX(-50%);
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid rgba(167,139,250,0.22); border-top-color: #a78bfa;
  animation: iw-rot 0.9s linear infinite;
}
@keyframes iw-rot { to { transform: translateX(-50%) rotate(360deg) } }
@media (prefers-reduced-motion: reduce) {
  .iw-spin { animation-duration: 1.6s }
  .iw-c { animation: none; transform: rotate(var(--r)) scale(1) }
}
</style>
