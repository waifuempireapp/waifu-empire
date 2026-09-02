<!-- Loading dell'app.
     - fullscreen → SPLASH a tutta pagina (logo Waifu Empire + carte dell'ultima
       espansione, come lo spa-loading-template pre-JS → transizione continua).
     - inline → spinner circolare piccolo dentro pannelli/liste. -->
<template>
  <!-- FULLSCREEN: splash con carte (stessa grafica del template pre-JS) -->
  <div v-if="fullscreen" class="iw-splash">
    <div class="iw-rays" />
    <div class="iw-cards">
      <img v-for="n in 10" :key="n" class="iw-c" :class="`iw-c${n}`" :src="`/splash/card${n}.webp`" alt="" @error="onImgErr">
    </div>
    <img class="iw-logo" src="/splash/logo.png" alt="Waifu Empire">
    <div class="iw-dots"><span /><span /><span /></div>
  </div>

  <!-- INLINE: spinner classico -->
  <div v-else class="app-loading app-loading--inline">
    <div class="app-loading__content">
      <div class="app-loading__spinner" />
      <span class="app-loading__text">{{ $t("loading.text") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  fullscreen?: boolean
}>(), {
  fullscreen: false,
})

// Se una carta dello splash manca (es. prima di rilanciare build-splash-cards.mjs
// dopo una nuova espansione), nascondila invece di mostrare l'icona rotta.
function onImgErr(ev: Event) {
  const img = ev.target as HTMLImageElement | null
  if (img) img.style.display = 'none'
}
</script>

<style scoped>
/* ---- INLINE spinner ---- */
.app-loading { display: flex; align-items: center; justify-content: center; }
.app-loading--inline { width: 100%; padding: 40px 0; }
.app-loading__content { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.app-loading__spinner {
  width: 36px; height: 36px; border-radius: 50%;
  border: 3px solid var(--accent-soft, #E5DCF7);
  border-top-color: var(--accent, #8B6FD8);
  animation: app-spin 0.8s linear infinite;
}
@keyframes app-spin { to { transform: rotate(360deg); } }
.app-loading__text {
  font-family: 'Nunito', sans-serif; font-size: 0.85rem; font-weight: 600;
  letter-spacing: 0.5px; color: var(--text-secondary, #8B86A3);
}
@media (prefers-reduced-motion: reduce) { .app-loading__spinner { animation-duration: 1.5s; } }

/* ---- FULLSCREEN splash (identico allo spa-loading-template.html) ---- */
.iw-splash {
  position: fixed; inset: 0; overflow: hidden; z-index: 9999;
  background: radial-gradient(circle at 50% 42%, #241548 0%, #140d2b 45%, #0b0818 100%);
}
.iw-rays {
  position: absolute; top: 50%; left: 50%; width: 200vmax; height: 200vmax;
  transform: translate(-50%, -50%);
  background: repeating-conic-gradient(from 0deg,
    rgba(167,139,250,0.10) 0deg 6deg, rgba(167,139,250,0) 6deg 12deg);
  -webkit-mask-image: radial-gradient(circle,#000 0%,#000 30%,transparent 62%);
          mask-image: radial-gradient(circle,#000 0%,#000 30%,transparent 62%);
  animation: iw-rot 60s linear infinite;
}
.iw-cards { position: absolute; inset: 0; }
.iw-c {
  position: absolute; width: min(26vw, 148px); border-radius: 9px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.55); opacity: 0;
  animation: iw-in .6s ease forwards, iw-float 6s ease-in-out infinite;
}
.iw-c1 { left:5%;  top:9%;     transform:rotate(-12deg); animation-delay:0s,.2s }
.iw-c2 { left:31%; top:3%;     transform:rotate(-5deg);  animation-delay:.05s,.9s }
.iw-c3 { right:31%;top:4%;     transform:rotate(6deg);   animation-delay:.1s,1.5s }
.iw-c4 { right:4%; top:10%;    transform:rotate(13deg);  animation-delay:.15s,.6s }
.iw-c5 { left:2%;  top:40%;    transform:rotate(-9deg);  animation-delay:.2s,1.2s }
.iw-c6 { right:2%; top:38%;    transform:rotate(9deg);   animation-delay:.25s,.4s }
.iw-c7 { left:7%;  bottom:7%;  transform:rotate(10deg);  animation-delay:.3s,1.7s }
.iw-c8 { left:33%; bottom:2%;  transform:rotate(-6deg);  animation-delay:.35s,.8s }
.iw-c9 { right:33%;bottom:3%;  transform:rotate(7deg);   animation-delay:.4s,1.1s }
.iw-c10{ right:6%; bottom:8%;  transform:rotate(-12deg); animation-delay:.45s,.3s }
.iw-logo {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(64vw, 340px); filter: drop-shadow(0 6px 26px rgba(167,139,250,0.55));
  animation: iw-pulse 2.4s ease-in-out infinite;
}
.iw-dots { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); display: flex; gap: 9px; }
.iw-dots span {
  width: 9px; height: 9px; border-radius: 50%; background: #a78bfa; opacity: .35;
  animation: iw-blink 1.2s ease-in-out infinite;
}
.iw-dots span:nth-child(2) { animation-delay: .2s }
.iw-dots span:nth-child(3) { animation-delay: .4s }
@keyframes iw-rot { to { transform: translate(-50%,-50%) rotate(360deg) } }
@keyframes iw-in { to { opacity: 1 } }
@keyframes iw-pulse { 0%,100% { transform: translate(-50%,-50%) scale(1) } 50% { transform: translate(-50%,-50%) scale(1.05) } }
@keyframes iw-blink { 0%,100% { opacity: .3; transform: scale(1) } 50% { opacity: 1; transform: scale(1.35) } }
@keyframes iw-float { 0%,100% { margin-top: 0 } 50% { margin-top: -10px } }
@media (prefers-reduced-motion: reduce) {
  .iw-rays, .iw-c, .iw-logo, .iw-dots span { animation-duration: .01ms; animation-iteration-count: 1 }
  .iw-c { opacity: 1 }
}
</style>
