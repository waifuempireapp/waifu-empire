<template>
  <!-- Overlay tutorial a step multipli per guidare il giocatore nella mappa -->
  <div :style="overlayStyle">
    <!-- Indicatore step -->
    <div :style="{ display: 'flex', gap: '6px', marginBottom: '32px' }">
      <div
        v-for="(_, i) in STEPS"
        :key="i"
        :style="dotStyle(i === step)"
      />
    </div>

    <!-- Contenuto step corrente -->
    <div :style="contentStyle">
      <div :style="{ fontSize: '56px', marginBottom: '20px' }">{{ current.icon }}</div>
      <div :style="titleStyle">{{ current.title }}</div>
      <div :style="bodyStyle">{{ current.body }}</div>
    </div>

    <!-- Navigazione -->
    <div :style="{ display: 'flex', gap: '12px', width: '100%', maxWidth: '320px' }">
      <button v-if="step > 0" :style="ghostBtn" @click="step--">{{ $t("common.back") }}</button>
      <button v-if="!isLast" :style="primaryBtn" @click="step++">{{ $t("tutorial.next") }}</button>
      <button
        v-else
        :style="{ ...primaryBtn, background: 'linear-gradient(135deg, #c54a86, #ff85b6)' }"
        @click="$emit('close')"
      >
        🗺️ Scegli pixel
      </button>
    </div>

    <button :style="skipStyle" @click="$emit('close')">{{ $t("tutorial.skip") }}</button>
  </div>
</template>

<script setup lang="ts">
// Overlay tutorial interattivo: mostra i passi principali del gameplay sulla mappa
import type { CSSProperties } from 'vue'
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

const { t } = useI18n()
const STEPS = computed(() => [
  { icon: '🗺️', title: t('tutorial.step1_title'), body: t('tutorial.step1_body') },
  { icon: '⚔️', title: t('tutorial.step2_title'), body: t('tutorial.step2_body') },
  { icon: '💋', title: t('tutorial.step3_title'), body: t('tutorial.step3_body') },
  { icon: '🏰', title: t('tutorial.step4_title'), body: t('tutorial.step4_body') },
])

const step    = ref(0)
const isLast  = computed(() => step.value === STEPS.value.length - 1)
const current = computed(() => STEPS.value[step.value])

const dotStyle = (active: boolean): CSSProperties => ({
  width: active ? '20px' : '6px', height: '6px', borderRadius: '3px',
  background: active ? C.sakura : 'rgba(174,156,255,0.2)',
  transition: 'all 0.3s',
})

// Stili
const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(16px)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '32px',
}
const contentStyle: CSSProperties = {
  textAlign: 'center', maxWidth: '320px', marginBottom: '48px',
}
const titleStyle: CSSProperties = {
  fontFamily: FF.display, fontSize: '22px', color: '#fff', fontWeight: 800, marginBottom: '14px',
}
const bodyStyle: CSSProperties = {
  fontFamily: FF.body, fontSize: '14px', color: 'rgba(241,235,255,0.65)', lineHeight: 1.6,
}
const ghostBtn: CSSProperties = {
  flex: 1, padding: '13px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(174,156,255,0.2)', borderRadius: '14px',
  color: 'rgba(241,235,255,0.6)',
  fontFamily: "'Saira Condensed', sans-serif", fontSize: '12px',
  letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
}
const primaryBtn: CSSProperties = {
  flex: 2, padding: '13px',
  background: 'linear-gradient(135deg, #1aa899, #6cf0e0)',
  border: 'none', borderRadius: '14px', color: '#07051a',
  fontFamily: "'Saira Condensed', sans-serif", fontSize: '13px',
  letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 700, cursor: 'pointer',
}
const skipStyle: CSSProperties = {
  marginTop: '20px', background: 'none', border: 'none',
  color: 'rgba(241,235,255,0.3)', fontFamily: FF.label,
  fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer',
}
</script>
