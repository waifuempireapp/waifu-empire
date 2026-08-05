<!-- ============================================================
  DropdownSelect — select custom stile iOS (bottom sheet).
  Sostituisce le <select> native illeggibili: trigger col valore
  corrente, sheet dal basso con sezioni, checkmark e font di gioco.
  options: [{ header: 'Rarità' } | { value: 'x', label: 'X' }, …]
  ============================================================ -->
<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'

type Opt = { value: string; label: string; info?: string } | { header: string }

const props = withDefaults(defineProps<{
  modelValue: string | string[]
  options:    Opt[]
  label?:     string        // titolo dello sheet
  placeholder?: string      // label mostrata quando modelValue === ''
  /** selezione multipla: checkbox accanto alle voci, lo sheet resta aperto,
      il click su una voce attiva la toglie. modelValue è string[] */
  multi?:     boolean
}>(), { label: '', placeholder: '—', multi: false })

const emit = defineEmits<{ 'update:modelValue': [v: string | string[]] }>()

const open = ref(false)
// Voce con la spiegazione ⓘ espansa (solo una alla volta)
const infoOpen = ref<string | null>(null)

const selectedArr = computed<string[]>(() =>
  props.multi ? (Array.isArray(props.modelValue) ? props.modelValue : []) : [],
)

function isActive(v: string): boolean {
  return props.multi ? selectedArr.value.includes(v) : props.modelValue === v
}

const currentLabel = computed(() => {
  if (props.multi) {
    const sel = selectedArr.value
    if (sel.length === 0) return props.placeholder
    const labels = sel
      .map(v => (props.options.find(o => 'value' in o && o.value === v) as { label?: string } | undefined)?.label)
      .filter(Boolean) as string[]
    if (labels.length <= 2) return labels.join(' · ')
    return `${labels[0]} +${labels.length - 1}`
  }
  const found = props.options.find(o => 'value' in o && o.value === props.modelValue) as { label?: string } | undefined
  return found?.label ?? props.placeholder
})

function pick(v: string) {
  if (props.multi) {
    // '' = "Tutte": azzera la selezione. Le altre voci si TOGGLANO
    if (v === '') { emit('update:modelValue', []); return }
    const cur = [...selectedArr.value]
    const idx = cur.indexOf(v)
    if (idx >= 0) cur.splice(idx, 1)
    else cur.push(v)
    emit('update:modelValue', cur)
    return // multi: lo sheet resta aperto
  }
  emit('update:modelValue', v)
  open.value = false
}

// Blocca lo scroll del body quando lo sheet è aperto, tramite il composable
// condiviso token-based: coordinato con eventuali modali sottostanti (lo sheet
// può aprirsi dentro Impostazioni/Editor difesa) e sempre rilasciato all'unmount.
useScrollLock(open)
</script>

<template>
  <!-- Trigger -->
  <button
    type="button"
    @click="open = true"
    :style="{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
      background: 'var(--theme-input-bg)',
      border: `1.5px solid ${(multi ? selectedArr.length > 0 : !!modelValue) ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
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
        overflow: 'hidden',
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

        <!-- Opzioni scrollabili: flex:1 + min-height:0 sono OBBLIGATORI dentro
             un flex column con maxHeight, altrimenti il figlio non si comprime
             e lo scroll non parte mai -->
        <div style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;padding:4px 12px 14px;">
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
              background: isActive(o.value) ? 'var(--theme-tab-active)' : 'var(--theme-surface-2)',
              border: `1px solid ${isActive(o.value) ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
              borderRadius: '12px', padding: '13px 14px', cursor: 'pointer', textAlign: 'left',
              marginBottom: '8px',
              fontFamily: `var(--ff-body,'DM Sans',sans-serif)`, fontSize: '15px',
              fontWeight: isActive(o.value) ? 700 : 500,
              color: isActive(o.value) ? 'var(--theme-accent)' : 'var(--theme-text)',
            }">
              <span :style="{ flex: 1, minWidth: 0 }">
                {{ o.label }}
                <!-- Spiegazione espansa dal tap sulla ⓘ -->
                <span v-if="'info' in o && o.info && infoOpen === o.value" :style="{
                  display: 'block', marginTop: '5px',
                  fontSize: '12px', fontWeight: 500, lineHeight: 1.45,
                  color: 'var(--theme-text-2)',
                }">{{ o.info }}</span>
              </span>
              <!-- ⓘ: spiega cos'è questa voce (non seleziona) -->
              <span
                v-if="'info' in o && o.info"
                @click.stop="infoOpen = infoOpen === o.value ? null : o.value"
                :style="{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${infoOpen === o.value ? 'var(--theme-accent)' : 'var(--theme-border-2)'}`,
                  color: infoOpen === o.value ? 'var(--theme-accent)' : 'var(--theme-text-3)',
                  display: 'grid', placeItems: 'center',
                  fontSize: '11px', fontWeight: 800, fontStyle: 'italic',
                  fontFamily: 'Georgia, serif', cursor: 'pointer',
                }"
              >i</span>
              <!-- Multi: checkbox laterale (si toggla ricliccando) -->
              <span v-if="multi && o.value !== ''" :style="{
                width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                border: `2px solid ${isActive(o.value) ? 'var(--theme-accent)' : 'var(--theme-border-2)'}`,
                background: isActive(o.value) ? 'var(--theme-accent)' : 'transparent',
                display: 'grid', placeItems: 'center',
              }">
                <Check v-if="isActive(o.value)" :size="13" stroke-width="3.5" style="color:#fff;" />
              </span>
              <Check v-else-if="isActive(o.value)" :size="16" stroke-width="2.5" style="flex-shrink:0;" />
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
