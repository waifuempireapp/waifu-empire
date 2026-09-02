<!-- Splash di AVVIO (solo boot, usato in app.vue via useSplash): logo Waifu Empire
     + carte dell'ultima espansione. STATICO e identico allo spa-loading-template.html
     (fase pre-JS) → handoff invisibile. I loading INTERNI all'app usano invece
     AppLoading (solo spinner su sfondo blurrato), NON questo. -->
<template>
  <div class="iw-splash">
    <div class="iw-rays" />
    <div class="iw-cards">
      <img v-for="n in 14" :key="n" class="iw-c" :class="`iw-c${n}`" :src="`/splash/card${n}.webp`" alt="" @error="onImgErr">
    </div>
    <img class="iw-logo" src="/splash/logo.png" alt="Waifu Empire">
    <div class="iw-spin" />
  </div>
</template>

<script setup lang="ts">
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
.iw-c {
  position: absolute; width: min(15vw, 74px); border-radius: 7px;
  box-shadow: 0 5px 14px rgba(0,0,0,0.5);
}
/* anello esterno (bordi) */
.iw-c1 { left:3%;  top:6%;    transform:rotate(-13deg) }
.iw-c2 { left:27%; top:2%;    transform:rotate(-5deg) }
.iw-c3 { right:27%;top:3%;    transform:rotate(6deg) }
.iw-c4 { right:3%; top:7%;    transform:rotate(13deg) }
.iw-c5 { left:1%;  top:44%;   transform:rotate(-9deg) }
.iw-c6 { right:1%; top:42%;   transform:rotate(9deg) }
.iw-c7 { left:4%;  bottom:5%; transform:rotate(10deg) }
.iw-c8 { right:4%; bottom:6%; transform:rotate(-12deg) }
/* anello interno (verso il centro, dietro il logo) */
.iw-c9 { left:19%; top:23%;   transform:rotate(-8deg) }
.iw-c10{ right:19%;top:21%;   transform:rotate(7deg) }
.iw-c11{ left:21%; bottom:21%;transform:rotate(9deg) }
.iw-c12{ right:21%;bottom:19%;transform:rotate(-7deg) }
.iw-c13{ left:12%; top:64%;   transform:rotate(6deg) }
.iw-c14{ right:12%;top:62%;   transform:rotate(-6deg) }
.iw-logo {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(58vw, 300px); filter: drop-shadow(0 6px 22px rgba(167,139,250,0.5));
}
.iw-spin {
  position: absolute; left: 50%; bottom: 9%; transform: translateX(-50%);
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid rgba(167,139,250,0.22); border-top-color: #a78bfa;
  animation: iw-rot 0.9s linear infinite;
}
@keyframes iw-rot { to { transform: translateX(-50%) rotate(360deg) } }
@media (prefers-reduced-motion: reduce) { .iw-spin { animation-duration: 1.6s } }
</style>
