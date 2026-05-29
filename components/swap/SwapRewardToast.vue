<!-- Toast di notifica che appare dopo aver guadagnato Kisses tramite il sistema Swap -->
<script setup lang="ts">
defineProps<{
  amount?: number
  streakDays?: number
  multiplier?: number
  type?: string
  message?: string
}>()
const emit = defineEmits<{ done: [] }>()

const visible = ref(true)
onMounted(() => {
  const t = setTimeout(() => {
    visible.value = false
    setTimeout(() => emit('done'), 350)
  }, 2500)
  onUnmounted(() => clearTimeout(t))
})
</script>

<template>
  <div :style="{
    position:'fixed', top:'80px', left:'50%',
    transform:`translateX(-50%) ${visible ? 'translateY(0)' : 'translateY(-24px)'}`,
    opacity: visible ? 1 : 0, transition:'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    background:'rgba(6,3,15,0.96)', backdropFilter:'blur(16px)',
    border:`1px solid ${type === 'limit' ? 'rgba(255,91,108,0.4)' : 'rgba(245,197,96,0.4)'}`,
    borderRadius:'16px', padding:'12px 20px',
    display:'flex', alignItems:'center', gap:'10px',
    boxShadow:'0 8px 32px rgba(3,2,12,0.6)',
    zIndex:500, whiteSpace:'nowrap', maxWidth:'90vw',
  }">
    <template v-if="type === 'limit'">
      <span style="font-family:var(--ff-body,'DM Sans',sans-serif);font-size:13px;color:rgba(255,91,108,0.9)">{{ message }}</span>
    </template>
    <template v-else>
      <KissesIcon :size="18" />
      <span style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:20px;color:#f5c560;font-weight:800">+{{ amount }}</span>
      <span v-if="multiplier && multiplier > 1" style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.15em;color:#6cf0e0;text-transform:uppercase">
        ×{{ multiplier.toFixed(1) }} streak {{ streakDays }}d
      </span>
    </template>
  </div>
</template>
