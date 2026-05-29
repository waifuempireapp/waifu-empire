<!-- Modal di congratulazioni al raggiungimento di un traguardo voti Swap -->
<script setup lang="ts">
defineProps<{ milestone: number; amount: number }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div style="position:fixed;inset:0;z-index:400;background:rgba(3,2,12,0.94);backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px">
    <div style="font-size:72px;margin-bottom:20px">🎉</div>
    <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.25em;color:#f5c560;text-transform:uppercase;margin-bottom:8px">
      Traguardo raggiunto!
    </div>
    <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:28px;color:#fff;font-weight:800;margin-bottom:8px">
      {{ milestone }} voti
    </div>
    <div style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:14px;color:rgba(241,235,255,0.6);margin-bottom:28px;text-align:center">
      Hai raggiunto {{ milestone }} voti totali nel sistema Swap. Ecco il tuo premio!
    </div>
    <div style="display:flex;align-items:center;gap:12px;padding:16px 28px;background:rgba(245,197,96,0.1);border:1px solid rgba(245,197,96,0.3);border-radius:16px;margin-bottom:32px">
      <KissesIcon :size="24" />
      <span style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:32px;color:#f5c560;font-weight:800">+{{ amount }}</span>
      <span style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;color:rgba(241,235,255,0.5);text-transform:uppercase">Kisses</span>
    </div>
    <button @click="$emit('close')" style="padding:14px 40px;background:linear-gradient(135deg,#c08a1f,#f5c560);border:none;border-radius:14px;color:#1a0024;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;cursor:pointer">
      ✓ Ritira premio
    </button>
  </div>
</template>
