<!-- Placeholder schermata pubblicitaria — da collegare a AdMob/AdSense in produzione -->
<script setup lang="ts">
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="adslot-overlay">
    <div class="adslot-label">Pubblicità</div>
    <div class="adslot-box">
      <div style="font-size:40px;opacity:0.35">📢</div>
      <div class="adslot-box-text">Spazio pubblicitario</div>
    </div>
    <button class="adslot-btn" @click="$emit('close')">Continua →</button>
  </div>
</template>

<style scoped>
.adslot-overlay {
  position: fixed; inset: 0; z-index: 350;
  background: var(--theme-overlay);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 32px;
}

.adslot-label {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 20px;
}

.adslot-box {
  width: 100%; max-width: 320px;
  aspect-ratio: 4 / 3;
  background: var(--surface);
  border: 1px dashed var(--border-medium);
  border-radius: 20px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  margin-bottom: 28px;
  box-shadow: var(--shadow-float);
}

.adslot-box-text {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 11px; font-weight: 700;
  color: var(--text-tertiary);
  letter-spacing: 0.15em; text-transform: uppercase;
}

.adslot-btn {
  padding: 13px 36px;
  background: var(--surface);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-pill);
  color: var(--text-primary);
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 13px; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
  box-shadow: var(--shadow-float);
  transition: transform 0.1s, background 0.15s;
}
.adslot-btn:active { transform: scale(0.97); }
.adslot-btn:hover  { background: var(--surface-raised); }
</style>
