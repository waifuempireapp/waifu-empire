<!-- Placeholder schermata pubblicitaria — da collegare a AdMob/AdSense in produzione -->
<script setup lang="ts">
defineEmits<{ close: [] }>()
</script>

<template>
  <div style="position:fixed;inset:0;z-index:350;background:rgba(3,2,12,0.97);backdrop-filter:blur(16px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px">
    <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:9px;letter-spacing:0.2em;color:rgba(174,156,255,0.4);text-transform:uppercase;margin-bottom:20px">
      Pubblicità
    </div>
    <div style="width:100%;max-width:320px;aspect-ratio:4/3;background:rgba(255,255,255,0.04);border:1px dashed rgba(174,156,255,0.15);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-bottom:24px">
      <div style="font-size:40px;opacity:0.3">📢</div>
      <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;color:rgba(241,235,255,0.2);letter-spacing:0.15em;text-transform:uppercase">
        Spazio pubblicitario
      </div>
    </div>
    <button @click="$emit('close')" style="padding:12px 32px;background:rgba(255,255,255,0.06);border:1px solid rgba(174,156,255,0.2);border-radius:12px;color:rgba(241,235,255,0.7);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer">
      Continua →
    </button>
  </div>
</template>
