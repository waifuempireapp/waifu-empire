<!-- ============================================================
  DropdownSelect — select custom stile iOS (bottom sheet).
  Sostituisce le <select> native illeggibili: trigger col valore
  corrente, sheet dal basso con sezioni, checkmark e font di gioco.
  options: [{ header: 'Rarità' } | { value: 'x', label: 'X' }, …]
  ============================================================ -->
<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'

type Opt = { value: string; label: string } | { header: string }

const props = withDefaults(defineProps<{
  modelValue: string
  options:    Opt[]
  label?:     string        // titolo dello sheet
  placeholder?: string      // label mostrata quando modelValue === ''
}>(), { label: '', placeholder: '—' })

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const open = ref(false)

const currentLabel = computed(() => {
  const found = props.options.find(o => 'value' in o && o.value === props.modelValue) as { label?: string } | undefined
  return found?.label ?? props.placeholder
})

function pick(v: string) {
  emit('update:modelValue', v)
  open.value = false
}

// Blocca lo scroll del body quando lo sheet è aperto
watch(open, (v) => {
  if (typeof document !== 'undefined') document.body.style.overflow = v ? 'hidden' : ''
})
onUnmounted(() => { if (typeof document !== 'undefined') document.body.style.overflow = '' })
</script>

<template>
  <!-- Trigger -->
  <button
    type="button"
    @click="open = true"
    :style="{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
      background: 'var(--theme-input-bg)',
      border: `1.5px solid ${modelValue ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
      color: 'var(--theme-text)', borderRadius: '10px', padding: '12px 14px',
      fontSize: '15px', fontFamily: `var(--ff-body,'DM Sans',sans-serif)`, fontWeight: 600,
      cursor: 'pointer', textAlign: 'left',
    }"
  >
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ currentLabel }}</span>
    <ChevronDown :size="16" stroke-width="2" style="flex-shrink:0;color:var(--theme-text-3);" />
  </button>

  <!-- Sheet iOS-style -->
  <Teleport to="body">
    <div v-if="open"
      style="position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;justify-content:flex-end;"
      @click.self="open = false"
    >
      <!-- Backdrop -->
      <div style="position:absolute;inset:0;background:rgba(4,2,14,0.6);backdrop-filter:blur(6px);" @click="open = false" />

      <!-- Pannello -->
      <div class="dds-sheet" :style="{
        position: 'relative', zIndex: 1,
        background: 'var(--theme-surface)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid var(--theme-border)', borderBottom: 'none',
        maxHeight: '70dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
      }">
        <!-- Maniglia + titolo -->
        <div style="padding:10px 18px 8px;text-align:center;flex-shrink:0;">
          <div style="width:38px;height:4px;border-radius:99px;background:var(--theme-border);margin:0 auto 10px;" />
          <div v-if="label" :style="{
            fontFamily: `var(--ff-label,'Saira Condensed',sans-serif)`, fontSize: '13px', fontWeight: 800,
            letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--theme-text-2)',
          }">{{ label }}</div>
        </div>

        <!-- Opzioni scrollabili -->
        <div style="overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 12px 14px;">
          <template v-for="(o, i) in options" :key="i">
            <!-- Header di sezione -->
            <div v-if="'header' in o" :style="{
              fontFamily: `var(--ff-label,'Saira Condensed',sans-serif)`, fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--theme-text-3)',
              padding: '14px 10px 6px',
            }">{{ o.header }}</div>

            <!-- Opzione -->
            <button v-else type="button" @click="pick(o.value)" :style="{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              background: modelValue === o.value ? 'var(--theme-tab-active)' : 'transparent',
              border: `1px solid ${modelValue === o.value ? 'var(--theme-accent)' : 'transparent'}`,
              borderRadius: '12px', padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
              fontFamily: `var(--ff-body,'DM Sans',sans-serif)`, fontSize: '15px',
              fontWeight: modelValue === o.value ? 700 : 500,
              color: modelValue === o.value ? 'var(--theme-accent)' : 'var(--theme-text)',
            }">
              <span>{{ o.label }}</span>
              <Check v-if="modelValue === o.value" :size="16" stroke-width="2.5" style="flex-shrink:0;" />
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dds-sheet { animation: ddsUp 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
@keyframes ddsUp {
  from { transform: translateY(40px); opacity: 0.6; }
  to   { transform: translateY(0); opacity: 1; }
}
</style>
