<!-- Dialog piccolo e centrato per Kisses insufficienti.
     Sostituisce l'overlay a piena pagina (KissesShortageModal) in questo caso d'uso:
     mostra quanti Kisses mancano e offre "Ricarica" (apre lo shop) o "Annulla". -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  missingKisses?: number
}>(), {
  missingKisses: 0,
})

const emit = defineEmits<{
  cancel: []
}>()

// Apre lo shop esistente (NegozioOverlay) tramite l'evento globale, poi chiude il dialog
function ricarica() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('impero:apri-negozio'))
  emit('cancel')
}
</script>

<template>
  <div
    style="position:fixed;inset:0;z-index:450;background:var(--theme-overlay);backdrop-filter:blur(8px);
           display:flex;align-items:center;justify-content:center;padding:24px"
    @click.self="emit('cancel')"
  >
    <div
      class="fade-up"
      style="width:100%;max-width:320px;background:var(--theme-surface);
             border:1px solid var(--theme-border);border-radius:18px;
             box-shadow:0 12px 40px var(--theme-shadow);
             padding:24px 22px;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center"
    >
      <div style="font-size:40px;line-height:1">💋</div>

      <div style="font-family:'Unbounded',sans-serif;font-size:13px;letter-spacing:2px;color:#ff4d9e">
        {{ $t('modal.insufficient_kisses_title') }}
      </div>

      <div style="font-family:'DM Sans',sans-serif;font-size:13px;line-height:1.5;color:var(--theme-text-2)">
        {{ $t('modal.insufficient_kisses_msg', { n: missingKisses }) }}
      </div>

      <div style="display:flex;gap:10px;width:100%;margin-top:4px">
        <button
          @click="emit('cancel')"
          style="flex:1;background:none;border:1px solid var(--theme-border);border-radius:12px;
                 color:var(--theme-text-3);font-family:'Unbounded',sans-serif;font-size:10px;
                 padding:12px 0;cursor:pointer;letter-spacing:1px"
        >{{ $t('modal.cancel') }}</button>
        <button
          @click="ricarica"
          style="flex:1.4;background:#ff4d9e;border:none;border-radius:12px;color:#fff;
                 font-family:'Unbounded',sans-serif;font-size:10px;font-weight:700;
                 padding:12px 0;cursor:pointer;letter-spacing:1px;
                 box-shadow:0 6px 18px rgba(255,77,158,0.4)"
        >{{ $t('modal.recharge_kisses') }}</button>
      </div>
    </div>
  </div>
</template>
