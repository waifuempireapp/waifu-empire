<template>
  <!-- Modale informativa sulla mappa: pagine multiple con regole e legenda del gioco -->
  <div>
    <!-- Backdrop cliccabile -->
    <div :style="backdropStyle" @click="$emit('close')" />

    <!-- Contenuto modale -->
    <div :style="modalStyle">

      <!-- Pulsante chiudi -->
      <button :style="closeBtnStyle" @click="$emit('close')"><X :size="18" stroke-width="1.5" /></button>

      <!-- Paginazione top -->
      <div :style="paginationStyle">
        <div
          v-for="(_, i) in PAGES"
          :key="i"
          :style="pageDotStyle(i === page)"
          @click="page = i"
        />
      </div>

      <!-- Contenuto pagina -->
      <div :style="{ flex: 1, overflowY: 'auto' }">
        <div :style="{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }">{{ p.emoji }}</div>
        <div :style="pageTitleStyle">{{ p.title }}</div>
        <div :style="pageBodyStyle">{{ p.body }}</div>
      </div>

      <!-- Navigazione pagine -->
      <div :style="{ display: 'flex', gap: '10px', marginTop: '20px' }">
        <button :disabled="page === 0" :style="navBtnStyle(page === 0, false)" @click="page = Math.max(0, page - 1)">← Prec</button>
        <button v-if="page < PAGES.length - 1" :style="navBtnStyle(false, true)" @click="page++">Succ →</button>
        <button v-else :style="navBtnStyle(false, true)" @click="$emit('close')">✓ Capito!</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// X (Lucide) sostituisce il carattere ✕ nel pulsante chiudi
import { X } from 'lucide-vue-next'
import type { CSSProperties } from 'vue'
// Modale informativa con regole e legenda della mappa mondo
const FF = {
  display: "'Cinzel', serif",
  label:   "'Saira Condensed', sans-serif",
  body:    "'Inter', sans-serif",
}
const C = {
  sakura: '#ff85b6',
}

const emit = defineEmits<{
  close: []
}>()

useScrollLock()

const TOTAL_TERRITORIES = 1312

const PAGES = [
  {
    title: 'Benvenuto nella Mappa Mondo',
    emoji: '🗺️',
    body: `La mappa è divisa in ${TOTAL_TERRITORIES} territori conquistabili distribuiti su tutti i continenti. Ogni territorio ha un nome geografico univoco.\n\nI territori grigi appartengono alla CPU — sono disponibili per essere conquistati. I territori colorati appartengono ai giocatori.\n\n🔵 Il tuo impero è evidenziato con un bordo dorato interno. I territori che puoi conquistare pulsano con un bagliore dorato.`,
  },
  {
    title: 'Come conquistare un territorio',
    emoji: '⚔️',
    body: `Premi su qualsiasi territorio adiacente al tuo (incluse le diagonali e attraverso il mare).\n\nNel popup che appare scegli cosa fare:\n⚔ Attacca → seleziona 5 waifu, scegli le 3 migliori e combatti al meglio di 3 round.\n💋 Compra → paga in Kisses per averlo subito senza combattere.\n\n🏆 Se vinci, conquisti il territorio e ottieni 1 pacchetto sfida.\n💔 Se perdi, perdi 1 energia.`,
  },
  {
    title: 'Team difensore',
    emoji: '🛡️',
    body: `Ogni territorio che conquisti può avere un team difensore di 5 waifu.\n\nPremi su un tuo territorio → "Modifica Difesa" per impostare il team.\n\nPuoi impostare team diversi per territori diversi, oppure usare "Imposta per tutti" per applicare lo stesso team a tutto il tuo impero.\n\nSe non imposti un team, verrà usato il tuo Preset 1 di default.`,
  },
  {
    title: 'Kisses Passivi & Economia',
    emoji: '💋',
    body: `Ogni territorio che possiedi genera Kisses passivi ogni ora.\n\nNella sezione "Classifica Territori" sotto la mappa vedi quanti Kisses hai accumulato e quando arriverà il prossimo.\n\nPremi "Claim" per riscuotere i Kisses accumulati.\n\nPuoi anche fare offerte in Kisses ai giocatori avversari per comprare i loro territori senza combattere — usa il bottone 💌 Offerte in alto.`,
  },
  {
    title: 'Legenda & Interfaccia',
    emoji: '📋',
    body: `🗺️ Canvas mappa → trascina per fare pan, pizzica con 2 dita per zoomare.\n◎ Il mio impero → centra la mappa sul tuo territorio.\n💌 Offerte → vedi le offerte in entrata e in uscita per i tuoi territori.\n\n📊 Classifica Territori → mostra tutti i giocatori ordinati per numero di territori, con i Kisses passivi in cima.\n\n? nei quadratini del team → il team della CPU è nascosto: sfidala per scoprirlo!\n\n🔥 Badge HOT → waifu visibile solo con il Pass Hard.\n\n🎯 Difficoltà territorio → Easy (60%), Medium (30%), Hard (7%), Extreme (3%). Visibile nel popup del territorio.`,
  },
  {
    title: '🗺 Missioni Mappa',
    emoji: '🎯',
    body: `Ogni 2 ore appaiono le Missioni Mappa: 4 territori adiacenti vengono selezionati come obiettivo.\n\nSe possiedi uno o più di quei territori al termine dei 30 minuti, ricevi 100 Kisses per ogni territorio posseduto.\n\nEsempio: possiedi 2 dei 4 territori → +200 Kisses.\n\nPer riscuotere vai su: Home → Missioni → tab "🗺 Mappa" → premi "Riscuoti" quando la missione è scaduta.\n\nQuando non c'è una missione attiva vedrai il countdown alla prossima.`,
  },
  {
    title: '⚔ Raid Island',
    emoji: '⚔',
    body: `La Raid Island è un'isola speciale nell'oceano, sempre accessibile da tutti i giocatori.\n\nOgni ora parte un Evento Raid: una Waifu Raid con 5000 HP difende l'isola con un mazzo di 5 waifu.\n\n📋 Come funziona:\n• Tocca "⚔ Raid Island" sopra la mappa\n• Premi "Combatti" e seleziona le tue 5 waifu\n• In Pick Phase vedi il mazzo della Waifu Raid\n• Combatti: vittoria -100 HP, sconfitta +150 HP\n\n🏆 Classifica e Premi:\n• Tutti i partecipanti: 100 Kisses\n• 3° posto: 250 Kisses\n• 2° posto: 400 Kisses\n• 1° posto: 1000 Kisses + carta waifu raid\n\nI HP sono condivisi in real-time: tutti i giocatori vedono lo stesso contatore!`,
  },
]

const page = ref(0)
const p    = computed(() => PAGES[page.value])

// Stili
const backdropStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 250,
  background: 'rgba(3,2,12,0.7)', backdropFilter: 'blur(6px)',
}
const modalStyle: CSSProperties = {
  position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
  zIndex: 260, width: 'min(92vw, 380px)',
  background: 'rgba(10,7,38,0.99)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(174,156,255,0.25)', borderRadius: '20px',
  padding: '24px 22px', boxShadow: '0 24px 60px rgba(3,2,12,0.9)',
  animation: 'fadeUp 0.22s ease-out',
  maxHeight: '80vh', display: 'flex', flexDirection: 'column',
}
const closeBtnStyle: CSSProperties = {
  position: 'absolute', top: '14px', right: '16px',
  background: 'none', border: 'none', color: 'rgba(241,235,255,0.35)',
  fontSize: '20px', cursor: 'pointer', padding: 0,
}
const paginationStyle: CSSProperties = {
  display: 'flex', gap: '5px', marginBottom: '18px', justifyContent: 'center',
}
const pageDotStyle = (active: boolean): CSSProperties => ({
  width: active ? '20px' : '6px', height: '6px', borderRadius: '3px',
  background: active ? C.sakura : 'rgba(174,156,255,0.2)',
  transition: 'all 0.3s', cursor: 'pointer',
})
const pageTitleStyle: CSSProperties = {
  fontFamily: FF.display, fontSize: '17px', color: '#fff', fontWeight: 800,
  marginBottom: '14px', textAlign: 'center',
}
const pageBodyStyle: CSSProperties = {
  fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.65)',
  lineHeight: 1.7, whiteSpace: 'pre-line',
}
const navBtnStyle = (disabled: boolean, primary: boolean): CSSProperties => ({
  flex: 1, padding: '11px',
  background: primary ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.05)',
  border: primary ? 'none' : '1px solid rgba(174,156,255,0.2)',
  borderRadius: '12px', cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? 'rgba(241,235,255,0.2)' : primary ? '#fff' : 'rgba(241,235,255,0.6)',
  fontFamily: "'Saira Condensed', sans-serif", fontSize: '12px',
  letterSpacing: '0.18em', textTransform: 'uppercase',
  opacity: disabled ? 0.5 : 1,
})
</script>

<style>
/* Animazione apertura modale (non può essere definita con template expression) */
@keyframes fadeUp {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}
</style>
