<template>
  <div class="section-title">
    <div class="section-title__row">
      <h2 class="section-title__text"><slot /></h2>
      <button v-if="help" class="section-title__help" @click="$emit('help')">?</button>
    </div>
    <div v-if="rainbow" class="section-title__rainbow" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  rainbow?: boolean
  help?:    boolean
}>(), { rainbow: true, help: false })

defineEmits<{ help: [] }>()
</script>

<style scoped>
.section-title { display: flex; flex-direction: column; gap: 8px; }
.section-title__row {
  display: flex; align-items: center; justify-content: space-between;
}
.section-title__text {
  font-family: var(--ff-body);
  font-size: 28px;
  font-weight: 900;
  color: var(--theme-text);
  letter-spacing: -0.01em;
  line-height: 1.1;
}
.section-title__rainbow {
  height: 3px;
  width: 100%;
  background: var(--rainbow-line);
  border-radius: 999px;
  opacity: 0.8;
}
.section-title__help {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--surface-p, #fff);
  border: 1px solid var(--theme-border);
  box-shadow: var(--shadow-float);
  color: var(--theme-text-3);
  font-family: var(--ff-body);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
</style>
