<!-- Icona del TIPO elementale — solo glifo Lucide, colore coerente.
     Sostituisce i chip testuali ("Fuoco", "Abisso"…) dove basta l'icona. -->
<script setup lang="ts">
import { Flame, Leaf, Shield, Sparkles, Waves } from 'lucide-vue-next'
import { TYPE_COLORS } from '~/utils/battleEngine'

const props = withDefaults(defineProps<{
  type?: string | null
  size?: number
  /** true → cerchietto con sfondo colorato dietro l'icona */
  chip?: boolean
}>(), { size: 14, chip: false })

const ICONS: Record<string, unknown> = {
  Fuoco: Flame, Natura: Leaf, Ferro: Shield, Arcana: Sparkles, Abisso: Waves,
}
const icon  = computed(() => ICONS[props.type ?? ''] ?? Sparkles)
const color = computed(() => TYPE_COLORS[props.type ?? '']?.border ?? '#888')
</script>

<template>
  <span
    v-if="chip"
    :style="{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size * 1.7 + 'px', height: size * 1.7 + 'px', borderRadius: '50%',
      background: color + '26', border: `1.5px solid ${color}`,
      color, flexShrink: 0, lineHeight: 1,
    }"
  >
    <component :is="icon" :size="size" stroke-width="2.2" />
  </span>
  <component v-else :is="icon" :size="size" stroke-width="2.2" :style="{ color, flexShrink: 0 }" />
</template>
