<!-- ============================================================
  AdminDropsTab: gestione dei drop stagionali.
  Mostra la lista dei drop esistenti con possibilità di creare,
  modificare ed eliminare ciascun drop. Ogni drop può contenere
  waifu, outfit e pose selezionabili tramite l'editor inline
  DropEditor, che offre filtri per rarità/presenza/nome e
  alternanza vista lista/card. Include upload PDF manga (via
  sign + ImageKit diretto) e upload immagine bustina (/api/upload),
  prompt AI autogenerato e suggerimenti anti-ripetizione.
  ============================================================ -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { upsertDrop, deleteCatalogo } from '~/utils/firestoreService'
import { buildPromptBustina, suggerisciDiversificazione } from '~/utils/promptGenerator'
import { RARITA } from '~/utils/constants'
import { ikUrl } from '~/utils/imagekitUrl'

// ── Props / Emits ─────────────────────────────────────────────
const props = defineProps<{
  drops: unknown[]
  waifu: unknown[]
}>()

const emit = defineEmits<{
  flash: [t: string, c: string]
  reload: []
}>()

// ── Stato editor ──────────────────────────────────────────────
const ed = ref<Record<string, any> | null>(null)

// ── Stato DropEditor ──────────────────────────────────────────
const tabSel = ref<'waifu' | 'outfit' | 'pose'>('waifu')
const filtroRarita = ref('tutte')
const filtroPresenza = ref('tutte')
const filtroNome = ref('')
const vistaCard = ref(false)
const uploadMangaProgress = ref<number | null>(null)

// ── Helpers ───────────────────────────────────────────────────
function resetEditorState() {
  tabSel.value = 'waifu'
  filtroRarita.value = 'tutte'
  filtroPresenza.value = 'tutte'
  filtroNome.value = ''
  vistaCard.value = false
  uploadMangaProgress.value = null
}

// ── Azioni lista drop ─────────────────────────────────────────
function nuovo() {
  const paletteColori = [
    { c1: '#9b59ff', c2: '#ff2d78' },
    { c1: '#f59e0b', c2: '#06d6a0' },
    { c1: '#3b82f6', c2: '#ec4899' },
    { c1: '#dc2626', c2: '#eab308' },
    { c1: '#14b8a6', c2: '#a855f7' },
    { c1: '#f97316', c2: '#8b5cf6' },
  ]
  const usateC1 = new Set((props.drops as any[]).map((d: any) => d.colore).filter(Boolean))
  const palette = paletteColori.find(p => !usateC1.has(p.c1)) || paletteColori[props.drops.length % paletteColori.length]

  const stagioniBase = ['Primavera', 'Estate', 'Autunno', 'Inverno', 'Sakura', 'Notte', 'Aurora', 'Solstizio']
  const nomiUsati = new Set((props.drops as any[]).map((d: any) => (d.nome || '').split(' ')[0]))
  const stagione = stagioniBase.find(s => !nomiUsati.has(s)) || `Stagione ${props.drops.length + 1}`

  const oggi = new Date()
  const fine = new Date(oggi)
  fine.setDate(fine.getDate() + 30)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  resetEditorState()
  ed.value = {
    nome: `Drop ${stagione}`,
    descrizione: `Collezione tematica ${stagione.toLowerCase()} con waifu esclusive.`,
    inizio: fmt(oggi),
    fine: fmt(fine),
    attivo: false,
    colore: palette.c1,
    colore2: palette.c2,
    waifuIds: [],
    outfitIds: [],
    poseIds: [],
  }
}

function apriEditor(d: any) {
  resetEditorState()
  ed.value = { ...d }
}

async function salva(d: Record<string, any>) {
  await upsertDrop(d.id || null, { ...d, creato: d.creato || new Date() })
  emit('flash', 'Drop salvato', '#06d6a0')
  ed.value = null
  emit('reload')
}

async function elimina(id: string) {
  if (!confirm("Eliminare il drop? L'azione è irreversibile.")) return
  await deleteCatalogo('drops', id)
  emit('flash', 'Drop eliminato', '#ef4444')
  emit('reload')
}

function annulla() {
  ed.value = null
}

// ── DropEditor: toggle id in array campo ──────────────────────
function toggleId(campo: string, id: string) {
  if (!ed.value) return
  const arr: string[] = ed.value[campo] || []
  ed.value[campo] = arr.includes(id) ? arr.filter((x: string) => x !== id) : [...arr, id]
}

// ── DropEditor: waifu filtrate ────────────────────────────────
const waifuDelDrop = computed(() => {
  if (!ed.value) return []
  return (props.waifu as any[]).filter((w: any) => ed.value!.waifuIds?.includes(w.id))
})

const sugg = computed(() => suggerisciDiversificazione(waifuDelDrop.value))

const waifuInQualsiasidrop = computed(() => {
  return new Set((props.drops as any[]).flatMap((d: any) => d.waifuIds || []))
})

const waifuFiltrate = computed(() => {
  if (!ed.value) return []
  return (props.waifu as any[]).filter((w: any) => {
    if (filtroRarita.value !== 'tutte' && w.rarita !== filtroRarita.value) return false
    if (filtroPresenza.value === 'presenti' && !ed.value!.waifuIds?.includes(w.id)) return false
    if (filtroPresenza.value === 'assenti' && waifuInQualsiasidrop.value.has(w.id)) return false
    if (filtroNome.value && !w.nome?.toLowerCase().includes(filtroNome.value.toLowerCase())) return false
    return true
  })
})

// ── Upload manga PDF (sign + ImageKit diretto) ────────────────
async function onMangaFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !ed.value) return
  try {
    uploadMangaProgress.value = 0
    // Step 1: ottieni token di autenticazione
    const auth = await $fetch<{
      token: string
      expire: number
      signature: string
      publicKey: string
      folder: string
      publicId: string | null
    }>('/api/upload-sign', {
      method: 'POST',
      body: {
        folder: 'manga',
        publicId: `drop_${ed.value.id || Date.now()}_manga`,
      },
    })
    // Step 2: upload diretto a ImageKit via XMLHttpRequest per progress
    const url = await new Promise<string>((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', `drop_${ed.value!.id || Date.now()}_manga.pdf`)
      formData.append('token', auth.token)
      formData.append('expire', String(auth.expire))
      formData.append('signature', auth.signature)
      formData.append('publicKey', auth.publicKey)
      formData.append('folder', auth.folder)
      if (auth.publicId) formData.append('customMetadata', JSON.stringify({ publicId: auth.publicId }))

      const xhr = new XMLHttpRequest()
      xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload')
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          uploadMangaProgress.value = Math.round((ev.loaded / ev.total) * 100)
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve(data.url)
          } catch {
            reject(new Error('Risposta ImageKit non valida'))
          }
        } else {
          reject(new Error(`Upload fallito: ${xhr.status}`))
        }
      }
      xhr.onerror = () => reject(new Error('Errore di rete'))
      xhr.send(formData)
    })
    ed.value.asset_manga = url
    emit('flash', 'PDF manga caricato!', '#06d6a0')
  } catch (err: any) {
    emit('flash', 'Errore upload PDF: ' + err.message, '#ef4444')
  } finally {
    uploadMangaProgress.value = null
    input.value = ''
  }
}

// ── Upload immagine bustina (/api/upload) ─────────────────────
async function onBustinaFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !ed.value) return
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'bustine')
    const data = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
    })
    ed.value.asset_bustina = data.url
    emit('flash', 'Immagine bustina caricata!', '#06d6a0')
  } catch (err: any) {
    emit('flash', 'Errore upload: ' + err.message, '#ef4444')
  }
}
</script>

<template>
  <!-- ══ EDITOR DROP ══ -->
  <div v-if="ed">
    <!-- Header editor -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <h2 style="font-family:'Cinzel',serif;font-size:18px;color:#f59e0b;letter-spacing:2px;text-transform:uppercase;">
        📦 {{ ed.id ? 'MODIFICA' : 'NUOVO' }} DROP
      </h2>
      <div style="display:flex;gap:6px;">
        <button
          @click="annulla"
          style="padding:8px 16px;background:rgba(0,0,0,0.4);color:#f5e6d3;border:1px solid rgba(245,158,11,0.4);border-radius:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;"
        >ANNULLA</button>
        <button
          @click="salva(ed)"
          style="padding:8px 16px;background:linear-gradient(135deg,#f59e0b,#ec4899);color:#000;border:none;border-radius:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;font-weight:700;"
        >💾 SALVA</button>
      </div>
    </div>

    <!-- Campi metadati -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:16px;">
      <!-- Nome -->
      <div>
        <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">NOME</label>
        <input
          :value="ed.nome || ''"
          @input="ed.nome = ($event.target as HTMLInputElement).value"
          style="width:100%;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;box-sizing:border-box;"
        />
      </div>
      <!-- Inizio -->
      <div>
        <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">INIZIO</label>
        <input
          type="date"
          :value="ed.inizio || ''"
          @input="ed.inizio = ($event.target as HTMLInputElement).value"
          style="width:100%;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;box-sizing:border-box;"
        />
      </div>
      <!-- Fine -->
      <div>
        <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">FINE (OPZIONALE)</label>
        <input
          type="date"
          :value="ed.fine || ''"
          @input="ed.fine = ($event.target as HTMLInputElement).value"
          style="width:100%;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;box-sizing:border-box;"
        />
      </div>
      <!-- Stato attivo -->
      <div>
        <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">STATO</label>
        <label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,0,0,0.3);border-radius:6px;cursor:pointer;border:1px solid rgba(245,158,11,0.3);">
          <input
            type="checkbox"
            :checked="ed.attivo || false"
            @change="ed.attivo = ($event.target as HTMLInputElement).checked"
          />
          <span style="font-size:12px;">Drop ATTIVO (pescabile dai pacchetti)</span>
        </label>
      </div>
      <!-- Colore primario -->
      <div>
        <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">COLORE PRIMARIO (HEX)</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input
            type="color"
            :value="ed.colore || '#9b59ff'"
            @input="ed.colore = ($event.target as HTMLInputElement).value"
            style="padding:4px;height:42px;width:56px;cursor:pointer;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;box-sizing:border-box;"
          />
          <input
            :value="ed.colore || '#9b59ff'"
            @input="ed.colore = ($event.target as HTMLInputElement).value"
            placeholder="#9b59ff"
            style="flex:1;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;box-sizing:border-box;"
          />
        </div>
      </div>
      <!-- Colore secondario -->
      <div>
        <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">COLORE SECONDARIO (HEX)</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input
            type="color"
            :value="ed.colore2 || '#ff2d78'"
            @input="ed.colore2 = ($event.target as HTMLInputElement).value"
            style="padding:4px;height:42px;width:56px;cursor:pointer;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;box-sizing:border-box;"
          />
          <input
            :value="ed.colore2 || '#ff2d78'"
            @input="ed.colore2 = ($event.target as HTMLInputElement).value"
            placeholder="#ff2d78"
            style="flex:1;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;box-sizing:border-box;"
          />
        </div>
      </div>
    </div>

    <!-- Descrizione -->
    <div style="margin-bottom:12px;">
      <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">DESCRIZIONE</label>
      <textarea
        :value="ed.descrizione || ''"
        @input="ed.descrizione = ($event.target as HTMLTextAreaElement).value"
        style="width:100%;padding:10px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;min-height:60px;resize:vertical;box-sizing:border-box;"
      />
    </div>

    <!-- Upload PDF Manga -->
    <div style="margin-bottom:12px;">
      <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">📖 CAPITOLO MANGA (PDF) — SBLOCCATO COMPLETANDO IL DROP</label>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <input
          type="file"
          accept="application/pdf"
          :disabled="uploadMangaProgress !== null"
          @change="onMangaFileChange"
          :style="{ padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f5e6d3', fontSize: '13px', opacity: uploadMangaProgress !== null ? 0.4 : 1 }"
        />
        <template v-if="ed.asset_manga && uploadMangaProgress === null">
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="padding:6px 12px;background:rgba(6,214,160,0.12);border:1px solid rgba(6,214,160,0.4);border-radius:6px;font-size:11px;color:#06d6a0;">
              📄 PDF caricato
            </div>
            <a
              :href="ed.asset_manga"
              target="_blank"
              rel="noreferrer"
              style="padding:4px 8px;background:rgba(0,0,0,0.4);color:#f5e6d3;border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:10px;cursor:pointer;font-family:'Cinzel',serif;letter-spacing:1px;text-decoration:none;"
            >👁 Anteprima</a>
            <button
              @click="ed.asset_manga = ''"
              style="padding:4px 8px;background:rgba(0,0,0,0.4);color:#ef4444;border:1px solid rgba(239,68,68,0.5);border-radius:6px;font-size:11px;cursor:pointer;"
            >✕ Rimuovi</button>
          </div>
        </template>
      </div>
      <!-- Barra progresso upload -->
      <div v-if="uploadMangaProgress !== null" style="margin-top:8px;">
        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;">
          <div :style="{
            height: '100%',
            borderRadius: '3px',
            width: `${uploadMangaProgress}%`,
            background: 'linear-gradient(90deg,#06d6a0,#3b82f6)',
            transition: 'width 0.2s ease',
          }" />
        </div>
        <div style="font-size:10px;color:#06d6a0;margin-top:4px;">
          {{ uploadMangaProgress < 100 ? `⏳ Upload in corso... ${uploadMangaProgress}%` : '✓ Elaborazione...' }}
        </div>
      </div>
      <div v-if="ed.asset_manga && uploadMangaProgress === null" style="margin-top:6px;font-size:10px;color:rgba(245,230,211,0.45);line-height:1.5;">
        Gli utenti che collezionano <strong style="color:rgba(245,230,211,0.7);">tutte le waifu, outfit e pose</strong> di questo drop sbloccano automaticamente il download del PDF.
      </div>
    </div>

    <!-- Upload immagine bustina -->
    <div style="margin-bottom:12px;">
      <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">IMMAGINE BUSTINA (OPZIONALE)</label>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <input
          type="file"
          accept="image/*"
          @change="onBustinaFileChange"
          style="padding:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;font-size:13px;"
        />
        <div v-if="ed.asset_bustina" style="display:flex;gap:8px;align-items:center;">
          <img
            :src="ed.asset_bustina"
            alt="Bustina"
            style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #f59e0b;"
          />
          <button
            @click="ed.asset_bustina = ''"
            style="padding:4px 8px;background:rgba(0,0,0,0.4);color:#f5e6d3;border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:11px;cursor:pointer;"
          >✕ Rimuovi</button>
        </div>
      </div>
    </div>

    <!-- Prompt bustina autogenerato -->
    <div v-if="(ed.waifuIds?.length || 0) > 0" style="margin-bottom:12px;">
      <label style="display:block;font-size:10px;color:rgba(245,230,211,0.6);letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel',serif;">PROMPT BUSTINA SUGGERITO (PER AI)</label>
      <div style="padding:12px;background:rgba(6,214,160,0.08);border:1px solid rgba(6,214,160,0.3);border-radius:8px;">
        <div style="font-family:'Cinzel',serif;color:#06d6a0;letter-spacing:2px;font-size:11px;margin-bottom:8px;">🎨 PROMPT AUTOGENERATO</div>
        <div style="font-size:11px;line-height:1.6;color:#d4c5b9;font-family:monospace;white-space:pre-wrap;">{{ buildPromptBustina(ed, waifu) }}</div>
      </div>
    </div>

    <!-- Suggerimenti anti-ripetizione -->
    <div v-if="(ed.waifuIds?.length || 0) > 0" style="margin-top:14px;margin-bottom:16px;padding:12px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:8px;">
      <div style="font-family:'Cinzel',serif;color:#a855f7;letter-spacing:2px;font-size:12px;margin-bottom:8px;">📊 ANTI-RIPETIZIONE</div>
      <div style="font-size:11px;line-height:1.6;">
        <div style="margin-bottom:6px;">
          <strong>Archetipi meno usati nel drop (suggeriti):</strong>
          {{ sugg.archetipiSuggeriti.slice(0, 3).map((a: any) => `${a.nome} (${a.conta})`).join(', ') }}
        </div>
        <div>
          <strong>Palette meno usate nel drop (suggerite):</strong>
          {{ sugg.paletteSuggerite.slice(0, 3).map((p: any) => `${p.nome} (${p.conta})`).join(', ') }}
        </div>
      </div>
    </div>

    <!-- Tabs selezione contenuti -->
    <div style="display:flex;gap:6px;margin-top:16px;margin-bottom:12px;flex-wrap:wrap;">
      <button
        v-for="t in [
          { k: 'waifu',  l: `👑 Waifu (${ed.waifuIds?.length || 0})` },
          { k: 'outfit', l: `✦ Outfit (${ed.outfitIds?.length || 0})` },
          { k: 'pose',   l: `⚜ Pose (${ed.poseIds?.length || 0})` },
        ]"
        :key="t.k"
        @click="tabSel = t.k as 'waifu' | 'outfit' | 'pose'"
        :style="{
          padding: '6px 14px',
          background: tabSel === t.k ? 'linear-gradient(135deg,#f59e0b,#ec4899)' : 'rgba(0,0,0,0.4)',
          color: tabSel === t.k ? '#000' : '#f5e6d3',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '16px',
          cursor: 'pointer',
          fontFamily: '\'Cinzel\',serif',
          fontSize: '11px',
          letterSpacing: '1px',
          fontWeight: '600',
        }"
      >{{ t.l }}</button>
    </div>

    <!-- Barra filtri (solo tab waifu) -->
    <div v-if="tabSel === 'waifu'" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding:10px 12px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(245,158,11,0.15);">
      <!-- Ricerca nome -->
      <input
        :value="filtroNome"
        @input="filtroNome = ($event.target as HTMLInputElement).value"
        placeholder="🔍 Cerca per nome..."
        style="flex:1 1 160px;min-width:140px;padding:6px 10px;font-size:12px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;"
      />
      <!-- Filtro rarità -->
      <select
        :value="filtroRarita"
        @change="filtroRarita = ($event.target as HTMLSelectElement).value"
        style="flex:0 0 auto;width:auto;padding:6px 10px;font-size:12px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;"
      >
        <option value="tutte">⭐ Tutte le rarità</option>
        <option v-for="[k, v] in Object.entries(RARITA)" :key="k" :value="k">{{ '★'.repeat((v as any).stelle) }} {{ (v as any).nome }}</option>
      </select>
      <!-- Filtro presenza nel drop -->
      <select
        :value="filtroPresenza"
        @change="filtroPresenza = ($event.target as HTMLSelectElement).value"
        style="flex:0 0 auto;width:auto;padding:6px 10px;font-size:12px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f5e6d3;"
      >
        <option value="tutte">📦 Tutte</option>
        <option value="presenti">✅ Nel drop</option>
        <option value="assenti">🆓 In nessun drop</option>
      </select>
      <!-- Toggle vista -->
      <button
        @click="vistaCard = !vistaCard"
        :style="{
          padding: '6px 12px',
          fontSize: '11px',
          background: vistaCard ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.4)',
          color: '#f5e6d3',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '6px',
          cursor: 'pointer',
        }"
        title="Alterna tra vista card e lista"
      >{{ vistaCard ? '☰ Lista' : '🃏 Card' }}</button>
      <!-- Contatore risultati -->
      <div style="font-size:11px;opacity:0.6;display:flex;align-items:center;padding-left:4px;">
        {{ waifuFiltrate.length }}/{{ waifu.length }} waifu
      </div>
    </div>

    <!-- Lista waifu -->
    <div
      v-if="tabSel === 'waifu'"
      :style="{
        display: 'grid',
        gridTemplateColumns: vistaCard ? 'repeat(auto-fill,minmax(200px,1fr))' : 'repeat(auto-fill,minmax(220px,1fr))',
        gap: vistaCard ? '12px' : '6px',
        maxHeight: vistaCard ? '640px' : '420px',
        overflowY: 'auto',
        padding: '6px',
      }"
    >
      <div
        v-if="waifuFiltrate.length === 0"
        style="grid-column:1/-1;padding:20px;text-align:center;opacity:0.6;"
      >
        Nessuna waifu corrisponde ai filtri selezionati.
      </div>

      <!-- Vista CARD -->
      <template v-if="vistaCard">
        <div
          v-for="item in waifuFiltrate"
          :key="(item as any).id"
          @click="toggleId('waifuIds', (item as any).id)"
          :style="{
            cursor: 'pointer',
            position: 'relative',
            borderRadius: '10px',
            border: (ed.waifuIds?.includes((item as any).id))
              ? `2px solid ${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore}`
              : '2px solid transparent',
            boxShadow: (ed.waifuIds?.includes((item as any).id))
              ? `0 0 12px ${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).glow}`
              : 'none',
            transition: 'box-shadow 0.2s,border-color 0.2s',
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.4)',
          }"
        >
          <!-- Badge selezione -->
          <div :style="{
            position: 'absolute',
            top: '6px',
            right: '6px',
            zIndex: 10,
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: (ed.waifuIds?.includes((item as any).id))
              ? (RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore
              : 'rgba(0,0,0,0.6)',
            border: `2px solid ${(ed.waifuIds?.includes((item as any).id)) ? '#fff' : 'rgba(255,255,255,0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: '700',
          }">
            {{ ed.waifuIds?.includes((item as any).id) ? '✓' : '+' }}
          </div>
          <!-- Immagine anteprima card -->
          <img
            v-if="(item as any).asset_statica || (item as any).asset_paperdoll"
            :src="ikUrl((item as any).asset_statica || (item as any).asset_paperdoll, 'thumbnail') || ''"
            :alt="(item as any).nome"
            style="width:100%;height:160px;object-fit:cover;display:block;"
          />
          <div v-else style="width:100%;height:160px;display:flex;align-items:center;justify-content:center;font-size:32px;background:rgba(0,0,0,0.3);">
            👑
          </div>
          <div style="padding:8px;">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ (item as any).nome }}</div>
            <div :style="{ fontSize: '10px', color: (RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore, marginTop: '2px' }">
              {{ '★'.repeat((RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).stelle) }}
              {{ (RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).nome }}
            </div>
          </div>
        </div>
      </template>

      <!-- Vista LISTA -->
      <template v-else>
        <div
          v-for="item in waifuFiltrate"
          :key="(item as any).id"
          @click="toggleId('waifuIds', (item as any).id)"
          :style="{
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: (ed.waifuIds?.includes((item as any).id))
              ? `linear-gradient(135deg,${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore}22,transparent)`
              : 'rgba(0,0,0,0.3)',
            border: (ed.waifuIds?.includes((item as any).id))
              ? `2px solid ${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore}`
              : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
          }"
        >
          <!-- Miniatura -->
          <img
            v-if="(item as any).asset_statica || (item as any).asset_paperdoll"
            :src="ikUrl((item as any).asset_statica || (item as any).asset_paperdoll, 'thumbnail') || ''"
            :alt="(item as any).nome"
            :style="{
              width: '40px',
              height: '56px',
              objectFit: 'cover',
              borderRadius: '4px',
              border: `1px solid ${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore}60`,
              flexShrink: '0',
            }"
          />
          <div
            v-else
            :style="{
              width: '40px',
              height: '56px',
              borderRadius: '4px',
              background: `${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore}20`,
              border: `1px solid ${(RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: '0',
            }"
          >👑</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
              <input
                type="checkbox"
                :checked="ed.waifuIds?.includes((item as any).id) || false"
                :style="{ accentColor: (RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore, flexShrink: '0' }"
                readonly
                @click.stop
              />
              <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ (item as any).nome }}</span>
            </div>
            <div :style="{ fontSize: '10px', color: (RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).colore, marginTop: '2px' }">
              {{ '★'.repeat((RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).stelle) }}
              {{ (RARITA[(item as any).rarita as keyof typeof RARITA] || RARITA.comune).nome }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Tab outfit / pose (vuote ma presenti per completezza) -->
    <div
      v-if="tabSel !== 'waifu'"
      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;max-height:400px;overflow-y:auto;padding:6px;"
    >
      <div style="grid-column:1/-1;padding:20px;text-align:center;opacity:0.6;">
        Nessun {{ tabSel === 'outfit' ? 'outfit' : 'pose' }} creato. Crea {{ tabSel === 'outfit' ? 'outfit' : 'pose' }} dalle altre tab.
      </div>
    </div>
  </div>

  <!-- ══ LISTA DROP ══ -->
  <div v-else>
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <h2 style="font-family:'Cinzel',serif;font-size:18px;color:#f59e0b;letter-spacing:2px;text-transform:uppercase;">📦 GESTIONE DROP STAGIONALI</h2>
      <button
        @click="nuovo"
        style="padding:8px 16px;background:linear-gradient(135deg,#f59e0b,#ec4899);color:#000;border:none;border-radius:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;font-weight:700;"
      >+ NUOVO DROP</button>
    </div>

    <!-- Box informativo -->
    <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="font-family:'Cinzel',serif;color:#a855f7;letter-spacing:2px;font-size:12px;margin-bottom:6px;">ℹ COME FUNZIONANO I DROP</div>
      <div style="font-size:12px;line-height:1.6;opacity:0.85;">
        Ogni drop è un set tematico di waifu, outfit e pose. <strong>Possono essere attivi più drop contemporaneamente</strong>.
        Quando un drop è attivo, appare nella schermata di sbustamento e il giocatore può scegliere quale drop sbustare.
        I pacchetti pescano <strong>esclusivamente</strong> dai contenuti del drop selezionato.
        I giocatori conservano per sempre i contenuti già ottenuti dai drop precedenti.
      </div>
    </div>

    <!-- Griglia drop -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">
      <div
        v-if="(drops as any[]).length === 0"
        style="grid-column:1/-1;text-align:center;padding:30px;opacity:0.6;"
      >
        Nessun drop creato. Crea il tuo primo drop stagionale.
      </div>

      <div
        v-for="d in (drops as any[])"
        :key="d.id"
        :style="{
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(0,0,0,0.4)',
          border: d.attivo ? '2px solid #06d6a0' : '1px solid rgba(245,158,11,0.2)',
          position: 'relative',
        }"
      >
        <!-- Badge ATTIVO -->
        <div
          v-if="d.attivo"
          style="position:absolute;top:8px;right:8px;background:#06d6a0;color:#000;padding:2px 8px;border-radius:12px;font-size:9px;letter-spacing:1px;font-weight:700;"
        >● ATTIVO</div>

        <div style="font-family:'Cinzel',serif;font-size:16px;color:#f59e0b;letter-spacing:1px;">{{ d.nome }}</div>
        <div style="font-size:11px;opacity:0.7;margin-top:4px;">{{ d.descrizione || 'Nessuna descrizione' }}</div>
        <div style="font-size:11px;margin-top:8px;color:#a855f7;">
          👑 {{ d.waifuIds?.length || 0 }} waifu · ✦ {{ d.outfitIds?.length || 0 }} outfit · ⚜ {{ d.poseIds?.length || 0 }} pose
        </div>
        <div v-if="d.inizio" style="font-size:10px;opacity:0.6;margin-top:4px;">
          📅 {{ d.inizio }} {{ d.fine ? `→ ${d.fine}` : '(senza scadenza)' }}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button
            @click="apriEditor(d)"
            style="padding:8px 16px;background:rgba(0,0,0,0.4);color:#f5e6d3;border:1px solid rgba(245,158,11,0.4);border-radius:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;"
          >MODIFICA</button>
          <button
            @click="elimina(d.id)"
            style="padding:8px 16px;background:rgba(0,0,0,0.4);color:#ef4444;border:1px solid rgba(239,68,68,0.5);border-radius:6px;cursor:pointer;font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;"
          >ELIMINA</button>
        </div>
      </div>
    </div>
  </div>
</template>
