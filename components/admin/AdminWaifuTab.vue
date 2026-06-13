<!-- ============================================================
  ADMIN WAIFU TAB
  Gestione completa del catalogo waifu con tre sotto-tab:
  - 'catalogo' : lista/modifica waifu (WaifuTab + WaifuEditor + PromptPanel)
  - 'bulk'     : caricamento massivo con analisi AI (BulkUploadTab)
  - 'associa'  : associa immagini a waifu esistenti (AssociaImmaginiTab)
  ============================================================ -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { upsertWaifu, deleteCatalogo, clearCatalogCache } from '~/utils/firestoreService'
import {
  buildPromptPaperDoll, buildPromptCartaStatica, buildPromptCartaImmersiva,
  ARCHETIPI, PALETTE,
} from '~/utils/promptGenerator'
import { RARITA, COLORI_CAPELLI, STAT_RANGES_DEFAULT } from '~/utils/constants'
import { ikUrl } from '~/utils/imagekitUrl'
import { getDb } from '~/utils/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

// ── PROPS & EMITS ─────────────────────────────────────────────
const props = defineProps<{
  waifu: unknown[]
  drops: unknown[]
}>()

const emit = defineEmits<{
  flash: [t: string, c: string]
  reload: []
}>()

const authStore = useAuthStore()

// ── SUB-TAB ───────────────────────────────────────────────────
const subTab = ref<'catalogo' | 'bulk' | 'associa'>('catalogo')

// ── FLASH HELPER ─────────────────────────────────────────────
function flash(msg: string, col = '#06d6a0') {
  emit('flash', msg, col)
}

// ── WAIFU TYPE ───────────────────────────────────────────────
interface WaifuDoc {
  id?: string
  nome: string
  rarita: string
  tette: number
  taglia_piedi: number
  eta: number
  colore_capelli: number
  esperienza: number
  archetipo: string
  palette: string
  fillers: { outfit: string; fanservice: string; posa: string }
  asset_paperdoll: string
  asset_statica: string
  asset_immersiva: string
  asset_video: string
  asset_video_hard: string
  hot: boolean
  [k: string]: unknown
}

// ============================================================
// ─── NOME GENERATION HELPERS ─────────────────────────────────
// ============================================================

const _NOMI_GIAPPONESI = [
  'Akira','Yuki','Sakura','Hana','Rei','Miku','Sora','Luna','Aria','Kaede','Aoi','Rin','Kira','Mei','Yui','Nana','Hime','Runa','Mio',
  'Tsubaki','Ayame','Shiori','Akane','Hotaru','Hinata','Asuka','Misaki','Nagisa','Chihiro','Izumi','Kohaku','Tamaki','Madoka','Sumire','Tsumugi','Kurumi','Shion','Amane','Hibiki',
  'Kazuha','Fubuki','Tsukiko','Hikari','Miyu','Nanami','Haruka','Kotone','Ayaka','Setsuna','Mitsuki','Suzume','Kaguya','Yuzuki','Chiaki','Minori','Tohka','Shinobu','Kokona','Kanon',
  'Miyako','Chiyo','Tomoe','Katsumi','Ryoko','Momiji','Utaha','Futaba','Ichika','Natsuki','Sayuri','Wakana','Suzuha','Mashiro','Tomoyo','Yuzuha','Kirari','Himari','Riko','Saki',
  'Raijin','Tsukuyomi','Amaterasu','Benzaiten','Kushinada','Tamamo','Inari','Komachi','Otohime','Murasaki','Kagero','Shizuka','Tokiwa','Yugiri','Koruri','Yaegashi',
  'Kohana','Asahi','Mizuki','Tsuki','Hoshi','Naomi','Fumika','Suzu','Akemi','Tomoka','Haruna','Kazane','Yukino','Kotoha','Satsuki','Futami','Honoka','Kasumi','Akiha',
  'Yuna','Lulu','Tifa','Aerith','Rinoa','Garnet','Quistis','Fang','Vanille','Rem','Ram','Emilia','Beatrice','Shiro','Zero','Echidna','Petra','Felt','Crusch','Priscilla',
]

const _NOMI_FANTASY_OCCIDENTALI = [
  'Elysia','Vesper','Seraphina','Astrid','Freya','Morgana','Isolde','Celeste','Lilith','Vivienne','Cordelia','Evangeline','Artemis','Calypso','Ophelia','Rowena','Elara','Aurelia','Sylene','Nephira',
  'Valentina','Rosaria','Cassandra','Theodora','Lucretia','Anastasia','Gabriella','Isadora','Penelope','Seraphine','Lysandra','Demetria','Calliope','Andromeda','Persephone','Alcyone','Iphigenia','Xanthe','Melisande',
  'Lyra','Cleo','Thalia','Zoe','Selene','Athena','Hera','Aphrodite','Demeter','Hestia','Nike','Rhea','Gaia','Eos','Nyx','Tyche','Aura','Metis','Bia','Iris',
  'Titania','Gloriana','Bramble','Clover','Wren','Lark','Ivy','Fern','Dahlia','Jasmine','Violet','Orchid','Marigold','Heather','Laurel','Willow','Azalea','Camellia','Petunia','Wisteria',
  'Elira','Vespera','Soleil','Lunara','Stellara','Aurore','Celestine','Serenelle','Mirabelle','Vivara','Thalindra','Elyndra','Veloris','Sylvara','Arandel','Lirien','Faelith','Caldwen','Mirveth','Aerindel',
  'Beatrix','Gwendolyn','Imogen','Cecily','Rosalind','Guinevere','Elspeth','Matilda','Constance','Philippa','Meredith','Sybil','Aveline','Odette','Genevieve','Arabella','Claudine','Adeline',
]

const _NOMI_FANTASY_ORIENTALI = [
  'Zara','Kali','Indira','Priya','Lakshmi','Savitri','Radha','Durga','Parvati','Sita','Kamala','Ananya','Tara','Maya','Devi','Nisha','Asha','Chandra','Ganga','Saraswati',
  'Crimson','Velvet','Zephyra','Tempest','Eclipse','Solana','Nebula','Vortex','Blaze','Frost','Shadow','Ember','Dawn','Dusk','Storm','Crystal','Phantom','Raven','Phoenix',
  'Cipher','Neon','Pixel','Glitch','Chrome','Surge','Pulse','Flux','Hexa','Volt','Quartz','Nexus','Onyx','Prism','Zenith','Nova','Astra','Binary','Blade','Data',
  'Byakko','Suzaku','Genbu','Seiryu','Kirin','Raiju','Tengu','Yatagarasu','Baku','Kitsune','Tanuki','Yamabiko','Itachi','Karura','Mizuchi','Orochi','Ryujin','Fujin','Raiden','Izanami',
]

const NOMI_POOL = [...new Set([..._NOMI_GIAPPONESI, ..._NOMI_FANTASY_OCCIDENTALI, ..._NOMI_FANTASY_ORIENTALI])]

const _RADICI = [
  'Aka','Ao','Haku','Kuro','Shiro','Kin','Gin','Hi','Tsuki','Hoshi','Yoru','Asa','Kaze','Umi','Yama',
  'Mizu','Tori','Hana','Sora','Kumo','Kage','Hono','Kori','Ishi','Kawa','Mori','Seki','Kusa','Yuki','Fune',
]
const _SUFFISSI = [
  'hime','ko','mi','ka','na','ra','ha','no','ki','ri','ya','sa','wa','ne','to',
  'yo','ru','me','chi','su','fu','ma','ho','re','ni','ta','se','ka','shi','zu',
]
const _TITOLI = [
  'Dark','Iron','Silver','Golden','Crimson','Shadow','Void','Star','Moon','Sun',
  'Storm','Frost','Flame','Night','Dawn','Dusk','Azure','Scarlet','Obsidian','Ivory',
  'Phantom','Crystal','Arcane','Divine','Fallen','Sacred','Ancient','Eternal','Celestial','Infernal',
]
const _EPITETI = [
  'the Unyielding','the Radiant','the Silent','the Fierce','the Wanderer','the Forgotten',
  'the Eternal','the Cursed','the Blessed','the Unbroken','the Vanished','the Reborn',
  'of the Abyss','of the Stars','of the Void','of the Dawn','of the Dusk','of the Storm',
  'the Undying','the Exiled','the Chosen','the Lost','the Awakened','the Sealed',
]

function generaNomeUnico(usati: Set<string>): string {
  const disponibili = NOMI_POOL.filter(n => !usati.has(n))
  if (disponibili.length > 0) return disponibili[Math.floor(Math.random() * disponibili.length)]

  const radiciShuf = [..._RADICI].sort(() => Math.random() - 0.5)
  const sufShuf = [..._SUFFISSI].sort(() => Math.random() - 0.5)
  for (const r of radiciShuf) {
    for (const s of sufShuf) {
      const c = r.charAt(0).toUpperCase() + r.slice(1) + s
      if (!usati.has(c)) return c
    }
  }

  const titoliShuf = [..._TITOLI].sort(() => Math.random() - 0.5)
  const nomiShuf = [...NOMI_POOL].sort(() => Math.random() - 0.5)
  for (const t of titoliShuf) {
    for (const n of nomiShuf) {
      const c = `${t} ${n}`
      if (!usati.has(c)) return c
    }
  }

  for (const n of nomiShuf) {
    for (const e of _EPITETI) {
      const c = `${n} ${e}`
      if (!usati.has(c)) return c
    }
  }

  let i = 1
  while (usati.has(`Waifu ${i}`)) i++
  return `Waifu ${i}`
}

function assegnaRaritaDistribuita(): string {
  return 'comune'
}

function generaStatsRandom(indice: number, totale: number, ranges: Record<string, { min: number; max: number }> = STAT_RANGES_DEFAULT) {
  const seed = indice * 7919 + 1013
  const rnd = (r: { min: number; max: number }, shift: number) => {
    const span = r.max - r.min + 1
    return r.min + Math.abs((seed >> shift) % span)
  }
  return {
    tette:          Math.max(ranges.tette.min,          Math.min(ranges.tette.max,          rnd(ranges.tette, 0))),
    taglia_piedi:   Math.max(ranges.taglia_piedi.min,   Math.min(ranges.taglia_piedi.max,   rnd(ranges.taglia_piedi, 3))),
    eta:            Math.max(ranges.eta.min,             Math.min(ranges.eta.max,             rnd(ranges.eta, 5))),
    colore_capelli: Math.max(ranges.colore_capelli.min,  Math.min(ranges.colore_capelli.max,  rnd(ranges.colore_capelli, 8))),
    esperienza:     Math.max(ranges.esperienza.min,      Math.min(ranges.esperienza.max,      rnd(ranges.esperienza, 10))),
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const ANALYSIS_SYSTEM_PROMPT = `Sei un analizzatore di immagini anime. Data un'immagine di un personaggio anime, devi stimare queste statistiche. Rispondi SOLO con un JSON valido, niente altro testo.

Il JSON deve avere questi campi:
- "tette": intero da 1 a 7 (1=piatte/petite, 3=medie, 5=grandi, 7=enormi fantasy)
- "eta": intero tra 1 e 5000 (età apparente, la maggior parte 14-30; valori > 100 per creature antiche/non umane)
- "colore_capelli": intero da 1 a 10 (1=castano, 2=nero, 3=biondo, 4=rosso, 5=argento, 6=blu, 7=viola, 8=rosa, 9=bicolore, 10=fantasy/arcobaleno)
- "hot": boolean — true se l'immagine/contesto suggerisce contenuto erotico, seduttivo o adulto (posa provocante, abbigliamento molto succinto, contesto sessuale esplicito o implicito); false altrimenti

Esempio di risposta: {"tette":4,"eta":22,"colore_capelli":3,"hot":false}`

// ============================================================
// ─── CATALOGO TAB STATE ───────────────────────────────────────
// ============================================================
const WAIFU_PER_PAGE = 24

const ed = ref<WaifuDoc | null>(null)
const filtroRarita = ref('tutte')
const filtroAsset = ref('tutti')
const filtroNome = ref('')
const filtroDropId = ref('tutti')
const vistaCard = ref(true)
const visibiliWaifu = ref(WAIFU_PER_PAGE)

watch([filtroRarita, filtroAsset, filtroNome, filtroDropId, vistaCard], () => {
  visibiliWaifu.value = WAIFU_PER_PAGE
})

const waifuList = computed(() => props.waifu as WaifuDoc[])
const dropList = computed(() => props.drops as any[])

const waifuFiltrate = computed(() => {
  let f = waifuList.value
  if (filtroRarita.value !== 'tutte') f = f.filter(w => w.rarita === filtroRarita.value)
  if (filtroAsset.value === 'presenti') f = f.filter(w => w.asset_statica || w.asset_immersiva)
  if (filtroAsset.value === 'mancanti') f = f.filter(w => !w.asset_statica && !w.asset_immersiva)
  if (filtroNome.value) f = f.filter(w => w.nome.toLowerCase().includes(filtroNome.value.toLowerCase()))
  if (filtroDropId.value === '__nessuno__') {
    const all = new Set((dropList.value || []).flatMap((d: any) => d.waifuIds || []))
    f = f.filter(w => !all.has(w.id))
  } else if (filtroDropId.value !== 'tutti') {
    const dropSel = (dropList.value || []).find((d: any) => d.id === filtroDropId.value)
    f = f.filter(w => dropSel?.waifuIds?.includes(w.id))
  }
  return f
})

function nuovaWaifu() {
  ed.value = {
    nome: '', rarita: 'comune', tette: 3, taglia_piedi: 38, eta: 22,
    colore_capelli: 1, esperienza: 0,
    archetipo: ARCHETIPI[0].id, palette: PALETTE[0].id,
    fillers: { outfit: '', fanservice: '', posa: '' },
    asset_paperdoll: '', asset_statica: '', asset_immersiva: '',
    asset_video: '', asset_video_hard: '', hot: false,
  }
}

async function rebuildPools(token: string) {
  try {
    const data = await $fetch('/api/admin/rebuild-pack-pools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('[admin] pack_pools rebuilt:', (data as any)?.stats)
  } catch (e: any) {
    console.warn('[admin] rebuild-pack-pools failed:', e.message)
  }
}

async function salvaWaifu(w: WaifuDoc) {
  await upsertWaifu(w.id || null, w)
  clearCatalogCache()
  flash('Waifu salvata')
  ed.value = null
  emit('reload')
  const token = await authStore.user?.getIdToken()
  if (token) rebuildPools(token).catch(() => {})
}

async function eliminaWaifu(id: string) {
  if (!confirm('Eliminare la waifu?')) return
  await deleteCatalogo('catalogo_waifu', id)
  flash('Waifu eliminata')
  emit('reload')
}

// ── EDITOR STATE ─────────────────────────────────────────────
const edTab = ref('dati')
const uploading = ref<string | null>(null)

async function handleUpload(variante: string, file: File) {
  if (!file) return
  if (!ed.value) return
  if (!ed.value.id && !ed.value.nome) {
    flash('Inserisci almeno il nome prima di caricare', '#ef4444'); return
  }
  const tempId = ed.value.id || `tmp_${ed.value.nome.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
  uploading.value = variante
  try {
    const isVideo = file.type.startsWith('video/')
    let url: string
    if (isVideo) {
      const auth = await $fetch('/api/upload-sign', {
        method: 'POST',
        body: { folder: 'waifu', publicId: `${tempId}_${variante}` },
      }) as any
      const ext = file.name.split('.').pop() || 'mp4'
      const fd = new FormData()
      fd.append('file', file)
      fd.append('fileName', `${tempId}_${variante}.${ext}`)
      fd.append('publicKey', auth.publicKey)
      fd.append('signature', auth.signature)
      fd.append('expire', String(auth.expire))
      fd.append('token', auth.token)
      fd.append('folder', auth.folder)
      fd.append('useUniqueFileName', 'false')
      fd.append('overwriteFile', 'true')
      const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: fd })
      const data = await res.json()
      url = data.url
    } else {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'waifu')
      formData.append('publicId', `${tempId}_${variante}_${Date.now()}`)
      const res = await $fetch('/api/upload', { method: 'POST', body: formData }) as any
      url = res.url
    }
    const campo = `asset_${variante}` as keyof WaifuDoc
    ed.value = { ...ed.value!, [campo]: url }
    flash(`Asset ${variante} caricato`)
  } catch (e: any) {
    flash('Errore upload: ' + e.message, '#ef4444')
  } finally {
    uploading.value = null
  }
}

const promptDoll = computed(() => ed.value ? buildPromptPaperDoll(ed.value, ed.value.fillers || {}) : null)
const promptStat = computed(() => ed.value ? buildPromptCartaStatica(ed.value, ed.value.fillers || {}) : null)
const promptImm  = computed(() => ed.value ? buildPromptCartaImmersiva(ed.value, ed.value.fillers || {}) : null)

function copiaPrompt(text: string) {
  navigator.clipboard.writeText(text)
  alert('Copiato negli appunti!')
}

// ============================================================
// ─── BULK UPLOAD STATE ────────────────────────────────────────
// ============================================================
interface BulkPreview {
  file: File
  url: string
  nome: string
  stats: { tette: number; taglia_piedi: number; eta: number; colore_capelli: number; esperienza: number }
  rarita: string
  archetipo: string
  palette: string
  status: 'pending' | 'analyzing' | 'ready' | 'uploading' | 'done' | 'error'
  aiStats: any
  hot?: boolean
}

const bulkFiles = ref<File[]>([])
const bulkPreviews = ref<BulkPreview[]>([])
const bulkFase = ref<'select' | 'preview' | 'uploading' | 'done'>('select')
const bulkProgresso = ref({ fatto: 0, totale: 0, errori: 0 })
const bulkAiAnalisi = ref(false)
const bulkRisultati = ref<any[]>([])
const statRanges = ref<Record<string, { min: number; max: number }>>({ ...STAT_RANGES_DEFAULT })

onMounted(async () => {
  try {
    const db = getDb()
    const s = await getDoc(doc(db, 'config', 'stat_ranges'))
    if (s.exists()) statRanges.value = { ...STAT_RANGES_DEFAULT, ...s.data() }
  } catch { /* usa default */ }
})

const nomiUsatiBulk = computed(() => new Set(waifuList.value.map(w => w.nome)))

const nomiDuplicatiBulk = computed(() => {
  const contatore: Record<string, number> = {}
  bulkPreviews.value.forEach(p => { contatore[p.nome] = (contatore[p.nome] || 0) + 1 })
  const dalBatch = new Set(Object.keys(contatore).filter(n => contatore[n] > 1))
  const daFirestore = new Set(bulkPreviews.value.map(p => p.nome).filter(n => nomiUsatiBulk.value.has(n)))
  return new Set([...dalBatch, ...daFirestore])
})

function handleBulkFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = Array.from(input.files || [])
  if (selected.length === 0) return
  if (selected.length > 500) { flash('Massimo 500 immagini alla volta!', '#ef4444'); return }
  bulkFiles.value = selected
  const nomiLocali = new Set([...nomiUsatiBulk.value])
  const shuffled = [...Array(selected.length).keys()].sort(() => Math.random() - 0.5)
  const prev: BulkPreview[] = selected.map((file, i) => {
    const nome = generaNomeUnico(nomiLocali)
    nomiLocali.add(nome)
    const stats = generaStatsRandom(shuffled[i], selected.length, statRanges.value)
    return {
      file, url: URL.createObjectURL(file), nome, stats,
      rarita: assegnaRaritaDistribuita(),
      archetipo: ARCHETIPI[i % ARCHETIPI.length].id,
      palette: PALETTE[i % PALETTE.length].id,
      status: 'pending', aiStats: null,
    }
  })
  bulkPreviews.value = prev
  bulkFase.value = 'preview'
}

function onBulkDrop(e: DragEvent) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.4)'
  ;(e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.03)'
  if (!e.dataTransfer) return
  handleBulkFileSelect({ target: { files: e.dataTransfer.files } } as any)
}

async function analizzaConAI() {
  bulkAiAnalisi.value = true
  const aggiornati = [...bulkPreviews.value]
  let analizzati = 0
  for (let i = 0; i < aggiornati.length; i++) {
    aggiornati[i].status = 'analyzing'
    bulkPreviews.value = [...aggiornati]
    try {
      const base64 = await fileToBase64(aggiornati[i].file)
      const mediaType = aggiornati[i].file.type || 'image/jpeg'
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: ANALYSIS_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'Analizza questa immagine anime e stima le statistiche. Rispondi SOLO con il JSON.' },
            ],
          }],
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const text = (data.content || []).map((c: any) => c.text || '').join('')
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        aggiornati[i].stats = {
          ...aggiornati[i].stats,
          tette: Math.max(1, Math.min(7, parsed.tette || aggiornati[i].stats.tette)),
          eta: Math.max(1, Math.min(5000, parsed.eta || aggiornati[i].stats.eta)),
          colore_capelli: Math.max(1, Math.min(10, parsed.colore_capelli || aggiornati[i].stats.colore_capelli)),
        }
        if (parsed.hot !== undefined) aggiornati[i].hot = !!parsed.hot
        aggiornati[i].aiStats = parsed
        aggiornati[i].status = 'ready'
        analizzati++
      } else {
        aggiornati[i].status = 'ready'
      }
    } catch (err: any) {
      console.warn(`Analisi AI fallita per ${aggiornati[i].nome}:`, err.message)
      aggiornati[i].status = 'ready'
    }
    bulkPreviews.value = [...aggiornati]
    if (i < aggiornati.length - 1) await sleep(300)
  }
  bulkAiAnalisi.value = false
  flash(`Analisi completata: ${analizzati}/${aggiornati.length} con AI`)
}

async function avviaUpload() {
  const nomiNelBatch = bulkPreviews.value.map(p => p.nome)
  const dupBatch = nomiNelBatch.filter((n, i) => nomiNelBatch.indexOf(n) !== i)
  const dupFS = nomiNelBatch.filter(n => nomiUsatiBulk.value.has(n))
  const tutti = [...new Set([...dupBatch, ...dupFS])]
  if (tutti.length > 0) {
    flash(`Nomi duplicati: ${tutti.slice(0, 3).join(', ')}${tutti.length > 3 ? ` +${tutti.length - 3} altri` : ''}. Correggi prima.`, '#ef4444')
    return
  }
  bulkFase.value = 'uploading'
  bulkProgresso.value = { fatto: 0, totale: bulkPreviews.value.length, errori: 0 }
  const riusciti: any[] = []
  let errori = 0
  for (let i = 0; i < bulkPreviews.value.length; i++) {
    const p = bulkPreviews.value[i]
    try {
      const formData = new FormData()
      formData.append('file', p.file)
      formData.append('folder', 'waifu')
      formData.append('publicId', `bulk_${p.nome.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`)
      const uploadRes = await $fetch('/api/upload', { method: 'POST', body: formData }) as any
      const url = uploadRes.url
      const waifuData = {
        nome: p.nome, rarita: 'comune',
        tette: p.stats.tette, taglia_piedi: p.stats.taglia_piedi,
        eta: p.stats.eta, colore_capelli: p.stats.colore_capelli,
        esperienza: p.stats.esperienza,
        archetipo: p.archetipo, palette: p.palette,
        asset_statica: url, asset_paperdoll: '', asset_immersiva: '',
        fillers: { outfit: '', fanservice: '', posa: '' },
        hot: p.hot === true,
      }
      const newId = await upsertWaifu(null, waifuData)
      riusciti.push({ ...waifuData, id: newId, imageUrl: url })
      bulkPreviews.value[i].status = 'done'
      bulkPreviews.value = [...bulkPreviews.value]
    } catch (err: any) {
      console.error(`Errore waifu ${p.nome}:`, err)
      bulkPreviews.value[i].status = 'error'
      bulkPreviews.value = [...bulkPreviews.value]
      errori++
    }
    bulkProgresso.value = { fatto: i + 1, totale: bulkPreviews.value.length, errori }
    if (i < bulkPreviews.value.length - 1) await sleep(200)
  }
  bulkRisultati.value = riusciti
  bulkFase.value = 'done'
  emit('reload')
  flash(`${riusciti.length} waifu create! (${errori} errori)`, errori > 0 ? '#f59e0b' : '#06d6a0')
}

function aggiornaPreview(index: number, campo: string, valore: string) {
  const nuovo = [...bulkPreviews.value]
  if (campo.startsWith('stats.')) {
    const statKey = campo.split('.')[1] as keyof typeof nuovo[0]['stats']
    ;(nuovo[index].stats as any)[statKey] = parseInt(valore) || 0
  } else {
    ;(nuovo[index] as any)[campo] = valore
  }
  bulkPreviews.value = nuovo
}

function rimuoviPreview(index: number) {
  bulkPreviews.value = bulkPreviews.value.filter((_, i) => i !== index)
}

function rigeneraStats() {
  const shuffled = [...Array(bulkPreviews.value.length).keys()].sort(() => Math.random() - 0.5)
  bulkPreviews.value = bulkPreviews.value.map((p, i) => ({
    ...p,
    stats: generaStatsRandom(shuffled[i] + Date.now(), bulkPreviews.value.length, statRanges.value),
    rarita: assegnaRaritaDistribuita(),
  }))
  flash('Stats rigenerate!')
}

function resetBulk() {
  bulkFiles.value = []
  bulkPreviews.value = []
  bulkFase.value = 'select'
  bulkProgresso.value = { fatto: 0, totale: 0, errori: 0 }
  bulkRisultati.value = []
}

function bulkCountByRarity() {
  const c: Record<string, number> = {}
  bulkPreviews.value.forEach(p => { c[p.rarita] = (c[p.rarita] || 0) + 1 })
  return c
}

// ============================================================
// ─── ASSOCIA IMMAGINI STATE ───────────────────────────────────
// ============================================================
const TIPI = ['asset_statica', 'asset_immersiva', 'asset_video', 'asset_video_hard'] as const
const TIPI_LABEL: Record<string, string> = {
  asset_statica: '📷 Statica', asset_immersiva: '🖼 Immersiva',
  asset_video: '🎬 Video Soft', asset_video_hard: '🔞 Video Hard',
}

const assocFiltro = ref('mancanti')
const assocRicerca = ref('')
const assocTipoSel = ref('asset_statica')
const assocPending = ref<Record<string, { file: File; previewUrl: string }>>({})
const assocUploading = ref(false)
const assocProgresso = ref({ fatto: 0, totale: 0, errori: 0 })

const assocLista = computed(() =>
  waifuList.value
    .filter((w: any) => assocFiltro.value === 'tutte' || !w[assocTipoSel.value])
    .filter((w: any) => !assocRicerca.value || w.nome.toLowerCase().includes(assocRicerca.value.toLowerCase()))
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome))
)

const assocMancanti = computed(() => waifuList.value.filter((w: any) => !w[assocTipoSel.value]).length)

function assocHandleFileSelect(waifuId: string, file: File) {
  if (!file) return
  assocPending.value = { ...assocPending.value, [waifuId]: { file, previewUrl: URL.createObjectURL(file) } }
}

function assocRimuoviPending(waifuId: string) {
  const next = { ...assocPending.value }
  delete next[waifuId]
  assocPending.value = next
}

async function assocCaricaTutto() {
  const entries = Object.entries(assocPending.value)
  if (entries.length === 0) { flash('Nessuna immagine selezionata', '#f59e0b'); return }
  assocUploading.value = true
  assocProgresso.value = { fatto: 0, totale: entries.length, errori: 0 }
  let errori = 0
  for (let i = 0; i < entries.length; i++) {
    const [waifuId, { file }] = entries[i]
    try {
      const isVideo = file.type.startsWith('video/')
      let url: string
      if (isVideo) {
        const auth = await $fetch('/api/upload-sign', {
          method: 'POST',
          body: { folder: 'waifu', publicId: `${waifuId}_${assocTipoSel.value}` },
        }) as any
        const ext = file.name.split('.').pop() || 'mp4'
        const fd = new FormData()
        fd.append('file', file)
        fd.append('fileName', `${waifuId}_${assocTipoSel.value}.${ext}`)
        fd.append('publicKey', auth.publicKey)
        fd.append('signature', auth.signature)
        fd.append('expire', String(auth.expire))
        fd.append('token', auth.token)
        fd.append('folder', auth.folder)
        fd.append('useUniqueFileName', 'false')
        fd.append('overwriteFile', 'true')
        const upRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: fd })
        const data = await upRes.json()
        url = data.url
      } else {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'waifu')
        formData.append('publicId', `${waifuId}_${assocTipoSel.value}`)
        const res = await $fetch('/api/upload', { method: 'POST', body: formData }) as any
        url = res.url
      }
      const db = getDb()
      await setDoc(doc(db, 'catalogo_waifu', waifuId), { [assocTipoSel.value]: url }, { merge: true })
      assocRimuoviPending(waifuId)
    } catch (err: any) {
      console.error(err)
      errori++
    }
    assocProgresso.value = { fatto: i + 1, totale: entries.length, errori }
  }
  assocUploading.value = false
  emit('reload')
  flash(
    `${entries.length - errori} immagini caricate${errori ? `, ${errori} errori` : ''}`,
    errori ? '#f59e0b' : '#06d6a0',
  )
}

const assocPendingCount = computed(() => Object.keys(assocPending.value).length)
</script>

<template>
  <div style="color: #f5e6d3; font-family: 'Cinzel', serif;">

    <!-- SUB-TAB NAV -->
    <div style="display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap;">
      <button
        v-for="t in [{ k: 'catalogo', l: '👑 Catalogo' }, { k: 'bulk', l: '🚀 Caricamento Massivo' }, { k: 'associa', l: '🖼 Associa Immagini' }]"
        :key="t.k"
        @click="subTab = t.k as any; ed = null; edTab = 'dati'"
        :style="{
          padding: '8px 18px',
          background: subTab === t.k ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
          color: subTab === t.k ? '#000' : '#f5e6d3',
          border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, cursor: 'pointer',
          fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 1, fontWeight: 600,
        }"
      >{{ t.l }}</button>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         CATALOGO TAB
         ══════════════════════════════════════════════════════════ -->
    <div v-if="subTab === 'catalogo'">

      <!-- EDITOR VIEW -->
      <template v-if="ed">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <h2 style="font-family: Cinzel, serif; color: #f59e0b; letter-spacing: 3px; margin: 0;">
            👑 {{ ed.id ? 'MODIFICA' : 'NUOVA' }} WAIFU
          </h2>
          <div style="display: flex; gap: 6px;">
            <button @click="ed = null" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; letter-spacing: 1px; border-radius: 4px; cursor: pointer;">ANNULLA</button>
            <button @click="salvaWaifu(ed!)" :disabled="!ed.nome" :style="{ padding: '8px 18px', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', border: 'none', color: '#000', fontWeight: 600, fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 2, borderRadius: 6, cursor: 'pointer', opacity: !ed.nome ? 0.4 : 1 }">💾 SALVA</button>
          </div>
        </div>

        <!-- Editor sub-tabs -->
        <div style="display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;">
          <button
            v-for="t in [
              { k: 'dati', l: '📋 Dati' },
              { k: 'fillers', l: '✏ Filler' },
              { k: 'paperdoll', l: '🎭 Prompt Paper-Doll' },
              { k: 'statica', l: '🖼 Prompt Statica' },
              { k: 'immersiva', l: '✨ Prompt Immersiva' },
            ]"
            :key="t.k"
            @click="edTab = t.k"
            :style="{
              padding: '6px 14px',
              background: edTab === t.k ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
              color: edTab === t.k ? '#000' : '#f5e6d3',
              border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, cursor: 'pointer',
              fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1, fontWeight: 600,
            }"
          >{{ t.l }}</button>
        </div>

        <!-- DATI TAB -->
        <div v-if="edTab === 'dati'" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Nome</div>
            <input v-model="ed.nome" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;" />
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">🔥 Contenuto Hot (solo con Pass Hard)</div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="ed.hot" style="width: 18px; height: 18px; accent-color: #ff4500; cursor: pointer;" />
              <span :style="{ fontFamily: 'Orbitron', fontSize: '11px', color: ed.hot ? '#ff4500' : 'rgba(238,232,220,0.5)' }">
                {{ ed.hot ? '🔥 HOT — visibile solo con Pass Hard' : 'Standard (visibile a tutti)' }}
              </span>
            </label>
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Rarità</div>
            <select v-model="ed.rarita" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;">
              <option v-for="(v, k) in RARITA" :key="k" :value="k">{{ v.nome }}</option>
            </select>
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Archetipo</div>
            <select v-model="ed.archetipo" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;">
              <option v-for="a in ARCHETIPI" :key="a.id" :value="a.id">{{ a.nome }}</option>
            </select>
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Palette</div>
            <select v-model="ed.palette" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;">
              <option v-for="p in PALETTE" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Tette (1-7)</div>
            <input type="number" min="1" max="7" v-model.number="ed.tette" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;" />
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Taglia piedi (34-45)</div>
            <input type="number" min="34" max="45" v-model.number="ed.taglia_piedi" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;" />
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Età (18-2000)</div>
            <input type="number" min="18" max="2000" v-model.number="ed.eta" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;" />
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Colore capelli</div>
            <select v-model.number="ed.colore_capelli" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;">
              <option v-for="(v, k) in COLORI_CAPELLI" :key="k" :value="Number(k)">{{ k }} - {{ v.nome }}</option>
            </select>
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">Esperienza (0-5000)</div>
            <input type="number" min="0" max="5000" v-model.number="ed.esperienza" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: inherit; font-size: 13px; box-sizing: border-box;" />
          </label>
        </div>

        <!-- FILLERS TAB -->
        <div v-else-if="edTab === 'fillers'">
          <p style="font-size: 12px; opacity: 0.8; margin-bottom: 12px; line-height: 1.6;">
            Compila qui i tre placeholder che andranno inseriti nei prompt.
          </p>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">OUTFIT_DESCRIPTION</div>
            <textarea v-model="ed.fillers.outfit" :style="{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f5e6d3', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box', minHeight: '60px' }" placeholder="describe the full outfit in english SD tags" />
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">FANSERVICE_LEVEL</div>
            <textarea v-model="ed.fillers.fanservice" :style="{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f5e6d3', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box', minHeight: '60px' }" placeholder="describe coverage/exposure level coherent with rarity" />
          </label>
          <label style="display: block; margin-bottom: 10px;">
            <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">POSE_TYPE</div>
            <textarea v-model="ed.fillers.posa" :style="{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f5e6d3', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box', minHeight: '60px' }" placeholder="es. 'hand on hip, looking back over shoulder'" />
          </label>
          <div style="background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; padding: 12px; margin-top: 12px;">
            <div style="font-size: 11px; line-height: 1.6;">
              <strong style="color: #a855f7;">💡 Suggerimento:</strong> Compila i filler in inglese (sintassi tag SD) per risultati ottimali.
            </div>
          </div>
        </div>

        <!-- PROMPT PANEL (paperdoll / statica / immersiva) -->
        <template v-else-if="['paperdoll','statica','immersiva'].includes(edTab)">
          <!-- Seleziona dati prompt corretto -->
          <template v-for="(pd, key) in { paperdoll: promptDoll, statica: promptStat, immersiva: promptImm }" :key="key">
            <div v-if="edTab === key && pd">
              <!-- Info box -->
              <div style="background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                <div style="font-family: Cinzel, serif; color: #f59e0b; letter-spacing: 2px; font-size: 13px; margin-bottom: 4px;">{{ pd.titolo }}</div>
                <div style="font-size: 11px; opacity: 0.8; margin-bottom: 8px;">{{ pd.note }}</div>
                <div style="font-size: 11px; opacity: 0.85;">
                  <strong>Motore AI consigliato:</strong>
                  {{ key === 'paperdoll' ? 'ComfyUI o Automatic1111 con Animagine XL 4.0 o Pony Diffusion XL' : key === 'statica' ? 'ComfyUI o NovelAI v4 (per gacha card style)' : 'ComfyUI con hires_fix per qualità cinematografica' }}
                  · vedi tab "Motori AI" per i link.
                </div>
              </div>

              <!-- Prompt positivo -->
              <label style="display: block; margin-bottom: 10px;">
                <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">📝 PROMPT POSITIVO</div>
                <textarea :value="pd.prompt" readonly style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: monospace; font-size: 11px; box-sizing: border-box; min-height: 120px;" />
                <button @click="copiaPrompt(pd.prompt)" style="margin-top: 4px; padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; letter-spacing: 1px; border-radius: 4px; cursor: pointer;">📋 COPIA PROMPT</button>
              </label>

              <!-- Negative prompt -->
              <label style="display: block; margin-bottom: 10px;">
                <div style="font-size: 10px; color: #a855f7; letter-spacing: 1.5px; margin-bottom: 4px; font-family: Cinzel, serif;">❌ NEGATIVE PROMPT</div>
                <textarea :value="pd.negative" readonly style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-family: monospace; font-size: 11px; box-sizing: border-box; min-height: 60px;" />
                <button @click="copiaPrompt(pd.negative)" style="margin-top: 4px; padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; letter-spacing: 1px; border-radius: 4px; cursor: pointer;">📋 COPIA NEGATIVE</button>
              </label>

              <!-- Parametri consigliati -->
              <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 12px; margin-top: 12px;">
                <div style="font-size: 11px; font-family: Cinzel, serif; color: #a855f7; letter-spacing: 1px; margin-bottom: 6px;">⚙ PARAMETRI CONSIGLIATI</div>
                <div style="font-size: 11px; opacity: 0.85; font-family: monospace; line-height: 1.6;">
                  <div v-for="(v, k) in pd.parametri_consigliati" :key="String(k)">· <strong>{{ k }}:</strong> {{ String(v) }}</div>
                </div>
              </div>

              <!-- Upload asset -->
              <div style="margin-top: 14px; padding: 14px; background: rgba(6,214,160,0.05); border: 1px solid rgba(6,214,160,0.3); border-radius: 8px;">
                <div style="font-size: 12px; font-family: Cinzel, serif; color: #06d6a0; letter-spacing: 2px; margin-bottom: 8px;">📤 UPLOAD ASSET GENERATO</div>
                <div style="font-size: 11px; opacity: 0.8; margin-bottom: 8px;">
                  Una volta generata l'immagine con il prompt sopra, caricala qui.
                </div>
                <input
                  type="file" accept="image/*"
                  :disabled="!!uploading"
                  @change="(e: any) => handleUpload(key, e.target.files[0])"
                  style="width: 100%; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(6,214,160,0.4); border-radius: 6px; color: #f5e6d3;"
                />
                <div v-if="uploading === key" style="margin-top: 8px; color: #f59e0b; font-size: 11px;">⏳ Upload in corso...</div>
                <div v-if="ed[`asset_${key}` as keyof WaifuDoc]" style="margin-top: 10px;">
                  <div style="font-size: 10px; opacity: 0.7; margin-bottom: 6px;">Asset corrente:</div>
                  <img :src="ikUrl(ed[`asset_${key}` as keyof WaifuDoc] as string, 'normal') || ''" alt="asset" style="max-width: 200px; max-height: 200px; border-radius: 6px; border: 1px solid rgba(245,158,11,0.4);" />
                  <div style="margin-top: 6px; display: flex; gap: 6px;">
                    <a :href="ed[`asset_${key}` as keyof WaifuDoc] as string" target="_blank" rel="noopener" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; border-radius: 4px; text-decoration: none;">⬇ DOWNLOAD</a>
                    <button @click="(ed as any)[`asset_${key}`] = ''" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(239,68,68,0.5); color: #ef4444; font-family: Cinzel, serif; font-size: 10px; border-radius: 4px; cursor: pointer;">✕ RIMUOVI</button>
                  </div>
                </div>
              </div>

              <!-- Video section (solo per immersiva) -->
              <template v-if="key === 'immersiva'">
                <!-- Video soft -->
                <div style="margin-top: 16px; background: rgba(236,72,153,0.06); border: 1px solid rgba(236,72,153,0.3); border-radius: 8px; padding: 14px;">
                  <div style="font-family: Cinzel, serif; color: #ec4899; letter-spacing: 2px; font-size: 13px; margin-bottom: 8px;">🎬 VIDEO CARTA IMMERSIVA</div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 10px; line-height: 1.5;">
                    Video animato (MP4/WebM) per l'effetto Pokémon Pocket.<br/>
                    <strong style="color: rgba(236,72,153,0.8);">Consigliato:</strong> 3–8 secondi, 9:16 o 1:1, senza audio.
                  </div>
                  <div v-if="ed.asset_video" style="margin-bottom: 10px;">
                    <video :src="ed.asset_video" style="max-width: 120px; max-height: 180px; border-radius: 6px; border: 1px solid rgba(236,72,153,0.4);" controls muted />
                    <div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 4px;">{{ ed.asset_video.substring(0, 60) }}…</div>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <label style="background: rgba(236,72,153,0.15); border: 1px solid rgba(236,72,153,0.5); color: #ec4899; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: Orbitron, sans-serif;">
                      {{ uploading === 'video' ? '⏳ CARICAMENTO...' : '▶ CARICA VIDEO' }}
                      <input type="file" accept="video/mp4,video/webm" style="display: none;" :disabled="uploading === 'video'" @change="(e: any) => e.target.files[0] && handleUpload('video', e.target.files[0])" />
                    </label>
                    <button v-if="ed.asset_video" @click="ed.asset_video = ''" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 10px;">✕ Rimuovi video</button>
                  </div>
                </div>
                <!-- Video hard -->
                <div style="margin-top: 16px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 14px;">
                  <div style="font-family: Cinzel, serif; color: #ef4444; letter-spacing: 2px; font-size: 13px; margin-bottom: 8px;">🔞 VIDEO CARTA HARD (pass richiesto)</div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 10px; line-height: 1.5;">
                    Video hard immersivo (MP4/WebM). Visibile solo agli utenti con pass.<br/>
                    <strong style="color: rgba(239,68,68,0.8);">Consigliato:</strong> 3–8 secondi, 9:16 o 1:1, senza audio.
                  </div>
                  <div v-if="ed.asset_video_hard" style="margin-bottom: 10px;">
                    <video :src="ed.asset_video_hard" style="max-width: 120px; max-height: 180px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.4);" controls muted />
                    <div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 4px;">{{ ed.asset_video_hard.substring(0, 60) }}…</div>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <label style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.5); color: #ef4444; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: Orbitron, sans-serif;">
                      {{ uploading === 'video_hard' ? '⏳ CARICAMENTO...' : '🔞 CARICA VIDEO HARD' }}
                      <input type="file" accept="video/mp4,video/webm" style="display: none;" :disabled="uploading === 'video_hard'" @change="(e: any) => e.target.files[0] && handleUpload('video_hard', e.target.files[0])" />
                    </label>
                    <button v-if="ed.asset_video_hard" @click="ed.asset_video_hard = ''" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 10px;">✕ Rimuovi video hard</button>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </template>
      </template>

      <!-- LIST VIEW -->
      <template v-else>
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <h2 style="font-family: Cinzel, serif; color: #f59e0b; letter-spacing: 3px; margin: 0;">
            👑 CATALOGO WAIFU ({{ waifuFiltrate.length }}/{{ waifuList.length }})
          </h2>
          <div style="display: flex; gap: 6px;">
            <button @click="vistaCard = !vistaCard" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; border-radius: 4px; cursor: pointer;">{{ vistaCard ? '📋 Lista' : '🃏 Carte' }}</button>
            <button @click="nuovaWaifu" style="padding: 8px 18px; background: linear-gradient(135deg, #f59e0b, #ec4899); border: none; color: #000; font-weight: 600; font-family: Cinzel, serif; font-size: 11px; letter-spacing: 2px; border-radius: 6px; cursor: pointer;">+ NUOVA WAIFU</button>
          </div>
        </div>

        <!-- Filters -->
        <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; align-items: center;">
          <input v-model="filtroNome" placeholder="🔍 Cerca nome..." style="width: 180px; padding: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-size: 11px;" />
          <select v-model="filtroRarita" style="width: 130px; padding: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-size: 11px;">
            <option value="tutte">Tutte le rarità</option>
            <option v-for="(v, k) in RARITA" :key="k" :value="k">{{ v.nome }} {{ '★'.repeat(v.stelle) }}</option>
          </select>
          <select v-model="filtroAsset" style="width: 140px; padding: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-size: 11px;">
            <option value="tutti">Tutti gli asset</option>
            <option value="presenti">✓ Con immagine</option>
            <option value="mancanti">✗ Senza immagine</option>
          </select>
          <select v-model="filtroDropId" style="width: 160px; padding: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-size: 11px;">
            <option value="tutti">📦 Tutti i drop</option>
            <option value="__nessuno__">🚫 Senza drop</option>
            <option v-for="d in dropList" :key="(d as any).id" :value="(d as any).id">
              {{ (d as any).attivo ? '● ' : '' }}{{ (d as any).nome || (d as any).id }}
            </option>
          </select>
        </div>

        <!-- Card view -->
        <div v-if="vistaCard" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
          <div
            v-for="w in waifuFiltrate.slice(0, visibiliWaifu)"
            :key="w.id"
            style="position: relative; cursor: pointer;"
            @click="ed = { ...w }; edTab = 'dati'"
          >
            <div :style="{
              width: '143px', height: '215px', borderRadius: '8px', overflow: 'hidden',
              border: `2px solid ${(RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).colore}80`,
              boxShadow: `0 0 12px ${(RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).glow}`,
              background: 'var(--surface)', position: 'relative',
            }">
              <img v-if="w.asset_statica || w.asset_immersiva" :src="ikUrl(w.asset_statica || w.asset_immersiva, 'thumbnail') || ''" :alt="w.nome" style="width: 100%; height: 100%; object-fit: cover; object-position: center 15%;" />
              <div v-else style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"><img src="~/assets/images/New_Logo.png" alt="" style="width:60%;height:60%;object-fit:contain;opacity:0.80;" /></div>
              <div style="position: absolute; top: 0; left: 0; right: 0; padding: 4px 6px; background: linear-gradient(180deg, rgba(0,0,0,0.8), transparent);">
                <div style="font-size: 9px; color: #fff; font-weight: 700; font-family: Orbitron; text-shadow: 0 1px 3px #000;">{{ w.nome }}</div>
                <div :style="{ fontSize: '7px', color: (RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).colore }">{{ '★'.repeat((RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).stelle) }}</div>
              </div>
              <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 4px 4px; background: linear-gradient(0deg, rgba(0,0,0,0.85), transparent); display: flex; justify-content: space-around; font-size: 8px;">
                <div v-for="s in [{ icon: '💗', val: w.tette, col: '#ff6b9d' }, { icon: '🦶', val: w.taglia_piedi, col: '#64b5f6' }, { icon: '⏳', val: w.eta, col: '#ffd54f' }, { icon: '💇', val: w.colore_capelli, col: '#81c784' }, { icon: '⭐', val: w.esperienza, col: '#ce93d8' }]" :key="s.icon" style="text-align: center; line-height: 1;">
                  <div :style="{ fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: `0 0 4px ${s.col}`, fontFamily: 'Orbitron' }">{{ s.val }}</div>
                  <div style="font-size: 7px;">{{ s.icon }}</div>
                </div>
              </div>
              <div v-if="!w.asset_statica && !w.asset_immersiva" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(255,61,61,0.8); color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 8px; font-weight: 700;">NO IMG</div>
            </div>
            <div style="text-align: center; margin-top: 4px; font-size: 8px; opacity: 0.4; font-family: Orbitron;">click per editare</div>
          </div>
          <div v-if="waifuFiltrate.length === 0" style="padding: 30px; opacity: 0.6; font-size: 12px;">Nessuna waifu corrisponde ai filtri.</div>
        </div>

        <!-- List view -->
        <div v-else style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
          <div
            v-for="w in waifuFiltrate.slice(0, visibiliWaifu)"
            :key="w.id"
            :style="{ padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${(RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).colore}60` }"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div :style="{ fontFamily: 'Cinzel, serif', color: (RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).colore, fontSize: '12px', fontWeight: 600 }">{{ w.nome }}</div>
              <div :style="{ fontSize: '10px', color: (RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).colore }">{{ '★'.repeat((RARITA[w.rarita as keyof typeof RARITA] || RARITA.comune).stelle) }}</div>
            </div>
            <div style="font-size: 9px; opacity: 0.5; margin-bottom: 6px;">
              💗{{ w.tette }} 🦶{{ w.taglia_piedi }} ⏳{{ w.eta }} 💇{{ w.colore_capelli }} ⭐{{ w.esperienza }}
              · Asset: {{ w.asset_statica ? '✓' : '✗' }}
            </div>
            <div style="display: flex; gap: 4px;">
              <button @click="ed = { ...w }; edTab = 'dati'" style="padding: 3px 8px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 9px; border-radius: 4px; cursor: pointer;">MODIFICA</button>
              <button @click="eliminaWaifu(w.id!)" style="padding: 3px 8px; background: rgba(0,0,0,0.4); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; font-family: Cinzel, serif; font-size: 9px; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
          </div>
          <div v-if="waifuFiltrate.length === 0" style="grid-column: 1/-1; text-align: center; padding: 30px; opacity: 0.6;">Nessuna waifu.</div>
        </div>

        <!-- Load more -->
        <div v-if="waifuFiltrate.length - visibiliWaifu > 0" style="text-align: center; margin-top: 18px;">
          <button @click="visibiliWaifu += WAIFU_PER_PAGE" style="padding: 8px 20px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 11px; border-radius: 4px; cursor: pointer;">
            Carica altre ({{ Math.min(waifuFiltrate.length - visibiliWaifu, WAIFU_PER_PAGE) }} di {{ waifuFiltrate.length - visibiliWaifu }} rimanenti)
          </button>
        </div>
      </template>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         BULK UPLOAD TAB
         ══════════════════════════════════════════════════════════ -->
    <div v-else-if="subTab === 'bulk'">

      <!-- FASE: SELECT -->
      <div v-if="bulkFase === 'select'">
        <h2 style="font-family: Cinzel, serif; color: #f59e0b; letter-spacing: 3px; margin: 0 0 12px;">🚀 CARICAMENTO MASSIVO WAIFU</h2>
        <div style="background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
          <div style="font-family: Cinzel, serif; color: #a855f7; letter-spacing: 2px; font-size: 12px; margin-bottom: 6px;">ℹ COME FUNZIONA</div>
          <div style="font-size: 12px; line-height: 1.8; opacity: 0.85;">
            1. <strong>Seleziona fino a 200 immagini</strong> di waifu/personaggi anime<br/>
            2. Il sistema <strong>genera automaticamente</strong> nome, statistiche e rarità per ogni waifu<br/>
            3. <strong>(Opzionale)</strong> L'AI analizza le immagini e stima tette, età e colore capelli<br/>
            4. <strong>Puoi rivedere e modificare</strong> manualmente ogni waifu prima del caricamento<br/>
            5. <strong>Caricamento in batch</strong>: upload immagine + creazione waifu in Firestore
          </div>
        </div>
        <div
          style="border: 3px dashed rgba(245,158,11,0.4); border-radius: 16px; padding: 60px; text-align: center; background: rgba(245,158,11,0.03); cursor: pointer; transition: all 0.3s;"
          @click="($refs.bulkInput as HTMLInputElement).click()"
          @dragover.prevent="($event.currentTarget as HTMLElement).style.borderColor = '#f59e0b'; ($event.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.08)'"
          @dragleave="($event.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.4)'; ($event.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.03)'"
          @drop="onBulkDrop"
        >
          <div style="font-size: 60px; margin-bottom: 12px;">📁</div>
          <div style="font-family: Cinzel, serif; color: #f59e0b; font-size: 18px; letter-spacing: 3px; margin-bottom: 8px;">TRASCINA O CLICCA</div>
          <div style="font-size: 13px; opacity: 0.7;">Seleziona fino a 200 immagini (.jpg, .png, .webp)</div>
          <input ref="bulkInput" type="file" multiple accept="image/*" style="display: none;" @change="handleBulkFileSelect" />
        </div>
        <div style="margin-top: 16px; text-align: center; font-size: 11px; opacity: 0.5;">
          Waifu attuali nel catalogo: <strong>{{ waifuList.length }}</strong>
        </div>
      </div>

      <!-- FASE: PREVIEW -->
      <div v-else-if="bulkFase === 'preview'">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
          <h2 style="font-family: Cinzel, serif; color: #f59e0b; letter-spacing: 3px; margin: 0;">🔍 REVISIONE ({{ bulkPreviews.length }} waifu)</h2>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button @click="resetBulk" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; border-radius: 4px; cursor: pointer;">← INDIETRO</button>
            <button @click="rigeneraStats" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; border-radius: 4px; cursor: pointer;">🎲 RIGENERA STATS</button>
            <button v-if="!bulkAiAnalisi" @click="analizzaConAI" style="padding: 8px 18px; background: linear-gradient(135deg, #a855f7, #3b82f6); border: none; color: #fff; font-weight: 600; font-family: Cinzel, serif; font-size: 11px; letter-spacing: 2px; border-radius: 6px; cursor: pointer;">🤖 ANALIZZA CON AI ({{ bulkPreviews.length }} img)</button>
            <button
              @click="avviaUpload"
              :disabled="bulkAiAnalisi || nomiDuplicatiBulk.size > 0"
              :style="{ padding: '8px 18px', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', border: 'none', color: '#000', fontWeight: 600, fontFamily: 'Cinzel, serif', fontSize: '11px', letterSpacing: '2px', borderRadius: '6px', cursor: 'pointer', opacity: (bulkAiAnalisi || nomiDuplicatiBulk.size > 0) ? 0.5 : 1 }"
            >🚀 CARICA TUTTE ({{ bulkPreviews.length }}){{ nomiDuplicatiBulk.size > 0 ? ` — ⚠ ${nomiDuplicatiBulk.size} duplicati` : '' }}</button>
          </div>
        </div>

        <!-- Distribuzione rarità -->
        <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
          <div v-for="(v, k) in RARITA" :key="k" :style="{ padding: '4px 12px', borderRadius: '12px', border: `1px solid ${v.colore}60`, fontSize: '11px', color: v.colore }">
            {{ '★'.repeat(v.stelle) }} {{ v.nome }}: <strong>{{ bulkCountByRarity()[k as string] || 0 }}</strong>
          </div>
        </div>

        <!-- AI progress -->
        <div v-if="bulkAiAnalisi" style="padding: 12px; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; margin-bottom: 14px;">
          <div style="font-size: 12px; color: #a855f7; font-weight: 600; margin-bottom: 6px;">
            🤖 Analisi AI in corso... {{ bulkPreviews.filter(p => p.status === 'ready' || p.status === 'done').length }}/{{ bulkPreviews.length }}
          </div>
          <div style="height: 4px; background: rgba(0,0,0,0.4); border-radius: 2px; overflow: hidden;">
            <div :style="{ width: `${(bulkPreviews.filter(p => p.status !== 'pending' && p.status !== 'analyzing').length / bulkPreviews.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #3b82f6)', transition: 'width 0.3s' }" />
          </div>
        </div>

        <!-- Duplicati banner -->
        <div v-if="nomiDuplicatiBulk.size > 0" style="margin-bottom: 10px; padding: 10px 14px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.5); border-radius: 8px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">⚠</span>
          <div style="flex: 1;">
            <div style="font-family: Cinzel, serif; color: #ef4444; font-size: 11px; font-weight: 700; margin-bottom: 2px;">
              {{ nomiDuplicatiBulk.size }} {{ nomiDuplicatiBulk.size === 1 ? 'nome duplicato' : 'nomi duplicati' }} — correggi per poter caricare
            </div>
            <div style="font-size: 10px; color: rgba(239,68,68,0.7);">
              {{ [...nomiDuplicatiBulk].slice(0, 5).join(', ') }}{{ nomiDuplicatiBulk.size > 5 ? ` +${nomiDuplicatiBulk.size - 5} altri` : '' }}
            </div>
          </div>
        </div>

        <!-- Grid preview -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; max-height: 70vh; overflow-y: auto; padding: 4px;">
          <div
            v-for="(p, i) in bulkPreviews"
            :key="i"
            :style="{
              padding: '8px', borderRadius: '8px',
              background: nomiDuplicatiBulk.has(p.nome) ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${nomiDuplicatiBulk.has(p.nome) ? '#ef4444' : p.status === 'analyzing' ? '#a855f7' : p.status === 'error' ? '#ef4444' : (RARITA[p.rarita as keyof typeof RARITA] || RARITA.comune).colore}60`,
              opacity: p.status === 'analyzing' ? 0.7 : 1,
              position: 'relative',
            }"
          >
            <div v-if="p.status === 'analyzing'" style="position: absolute; top: 4px; right: 4px; background: #a855f7; color: #fff; padding: 2px 6px; border-radius: 8px; font-size: 8px; letter-spacing: 1px;">🤖 AI...</div>
            <div v-else-if="p.aiStats && !nomiDuplicatiBulk.has(p.nome)" style="position: absolute; top: 4px; right: 4px; background: #06d6a0; color: #000; padding: 2px 6px; border-radius: 8px; font-size: 8px; letter-spacing: 1px;">✓ AI</div>
            <div v-else-if="nomiDuplicatiBulk.has(p.nome)" style="position: absolute; top: 4px; right: 4px; background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 8px; font-size: 8px; letter-spacing: 1px;">⚠ DUPLICATO</div>

            <img :src="p.url" :alt="p.nome" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;" />

            <input
              :value="p.nome"
              @input="aggiornaPreview(i, 'nome', ($event.target as HTMLInputElement).value)"
              :style="{ width: '100%', padding: '4px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${nomiDuplicatiBulk.has(p.nome) ? '#ef4444' : 'rgba(245,158,11,0.3)'}`, borderRadius: '6px', color: '#f5e6d3', fontFamily: 'inherit', fontSize: '11px', boxSizing: 'border-box', marginBottom: nomiDuplicatiBulk.has(p.nome) ? '2px' : '4px', fontWeight: 600 }"
            />
            <div v-if="nomiDuplicatiBulk.has(p.nome)" style="font-size: 9px; color: #ef4444; margin-bottom: 4px; line-height: 1.3;">
              {{ nomiUsatiBulk.has(p.nome) ? '⚠ Esiste già in catalogo' : '⚠ Duplicato nel batch' }}
            </div>

            <select :value="p.rarita" @change="aggiornaPreview(i, 'rarita', ($event.target as HTMLSelectElement).value)" style="width: 100%; padding: 3px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-size: 10px; margin-bottom: 4px;">
              <option v-for="(v, k) in RARITA" :key="k" :value="k">{{ v.nome }}</option>
            </select>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; font-size: 9px;">
              <div v-for="stat in [{ icon: '💗', key: 'tette', val: p.stats.tette, min: 1, max: 7 }, { icon: '🦶', key: 'taglia_piedi', val: p.stats.taglia_piedi, min: 34, max: 44 }, { icon: '⏳', key: 'eta', val: p.stats.eta, min: 18, max: 100 }, { icon: '💇', key: 'colore_capelli', val: p.stats.colore_capelli, min: 1, max: 10 }]" :key="stat.key" style="display: flex; align-items: center; gap: 2px;">
                <span>{{ stat.icon }}</span>
                <input
                  type="number" :min="stat.min" :max="stat.max" :value="stat.val"
                  @input="aggiornaPreview(i, `stats.${stat.key}`, ($event.target as HTMLInputElement).value)"
                  style="width: 100%; padding: 2px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; color: #f5e6d3; font-size: 9px; box-sizing: border-box;"
                />
              </div>
            </div>

            <button @click="rimuoviPreview(i)" style="width: 100%; margin-top: 4px; padding: 3px 0; background: rgba(0,0,0,0.4); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; font-family: Cinzel, serif; font-size: 9px; border-radius: 4px; cursor: pointer;">✕ RIMUOVI</button>
          </div>
        </div>
      </div>

      <!-- FASE: UPLOADING -->
      <div v-else-if="bulkFase === 'uploading'" style="text-align: center; padding: 40px;">
        <div style="font-size: 60px; margin-bottom: 16px;">🚀</div>
        <h2 style="font-family: Cinzel, serif; color: #f59e0b; letter-spacing: 3px; margin-bottom: 12px;">CARICAMENTO IN CORSO...</h2>
        <div style="max-width: 400px; margin: 0 auto;">
          <div style="height: 8px; background: rgba(0,0,0,0.4); border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
            <div :style="{ width: `${bulkProgresso.totale > 0 ? Math.round((bulkProgresso.fatto / bulkProgresso.totale) * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #06d6a0)', transition: 'width 0.3s', borderRadius: '4px' }" />
          </div>
          <div style="font-size: 24px; font-family: Cinzel, serif; color: #f59e0b; font-weight: 700;">{{ bulkProgresso.totale > 0 ? Math.round((bulkProgresso.fatto / bulkProgresso.totale) * 100) : 0 }}%</div>
          <div style="font-size: 12px; opacity: 0.7; margin-top: 6px;">
            {{ bulkProgresso.fatto }} / {{ bulkProgresso.totale }} completate
            <span v-if="bulkProgresso.errori > 0" style="color: #ef4444;"> · {{ bulkProgresso.errori }} errori</span>
          </div>
          <div style="font-size: 11px; opacity: 0.5; margin-top: 12px;">Non chiudere questa pagina durante il caricamento</div>
        </div>
      </div>

      <!-- FASE: DONE -->
      <div v-else-if="bulkFase === 'done'" style="text-align: center; padding: 40px;">
        <div style="font-size: 60px; margin-bottom: 16px;">🎉</div>
        <h2 style="font-family: Cinzel, serif; color: #06d6a0; letter-spacing: 3px; margin-bottom: 12px;">CARICAMENTO COMPLETATO!</h2>
        <div style="font-size: 14px; margin-bottom: 6px;">
          <span style="color: #06d6a0; font-weight: 700;">{{ bulkRisultati.length }}</span> waifu create con successo
        </div>
        <div v-if="bulkProgresso.errori > 0" style="font-size: 13px; color: #ef4444; margin-bottom: 12px;">{{ bulkProgresso.errori }} errori durante il caricamento</div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px;">
          <button @click="resetBulk" style="padding: 8px 18px; background: linear-gradient(135deg, #f59e0b, #ec4899); border: none; color: #000; font-weight: 600; font-family: Cinzel, serif; font-size: 11px; letter-spacing: 2px; border-radius: 6px; cursor: pointer;">📁 CARICA ALTRE</button>
          <button @click="bulkFase = 'select'" style="padding: 5px 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.4); color: #f5e6d3; font-family: Cinzel, serif; font-size: 10px; border-radius: 4px; cursor: pointer;">← TORNA</button>
        </div>
        <div v-if="bulkRisultati.length > 0" style="margin-top: 24px; text-align: left;">
          <div style="font-size: 12px; color: #a855f7; letter-spacing: 2px; margin-bottom: 8px;">ULTIME CREATE:</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; max-height: 400px; overflow-y: auto;">
            <div v-for="(w, i) in bulkRisultati.slice(-20)" :key="i" :style="{ padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: `1px solid ${(RARITA[w.rarita as keyof typeof RARITA]?.colore || '#666')}40` }">
              <img :src="ikUrl(w.imageUrl, 'thumbnail') || ''" :alt="w.nome" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 4px;" />
              <div :style="{ fontSize: '10px', fontWeight: 600, color: RARITA[w.rarita as keyof typeof RARITA]?.colore }">{{ w.nome }}</div>
              <div style="font-size: 9px; opacity: 0.6;">{{ '★'.repeat(RARITA[w.rarita as keyof typeof RARITA]?.stelle || 1) }} {{ RARITA[w.rarita as keyof typeof RARITA]?.nome }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         ASSOCIA IMMAGINI TAB
         ══════════════════════════════════════════════════════════ -->
    <div v-else-if="subTab === 'associa'" style="color: #f5e6d3;">
      <h2 style="font-family: Cinzel; font-size: 18px; color: #f59e0b; margin-bottom: 8px;">🖼 Associa Immagini a Waifu Esistenti</h2>
      <p style="font-family: Orbitron; font-size: 10px; color: rgba(245,158,11,0.5); margin-bottom: 16px; line-height: 1.6;">
        Seleziona il tipo di asset, poi clicca "Seleziona" su ogni waifu per associare il file. Alla fine "Carica Tutto".
      </p>

      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;">
        <select v-model="assocTipoSel" style="font-family: Orbitron, sans-serif; font-size: 9px; background: rgba(0,0,0,0.6); border: 1px solid rgba(245,158,11,0.3); color: #f5e6d3; border-radius: 8px; padding: 7px 10px;">
          <option v-for="t in TIPI" :key="t" :value="t">{{ TIPI_LABEL[t] }}</option>
        </select>
        <select v-model="assocFiltro" style="font-family: Orbitron, sans-serif; font-size: 9px; background: rgba(0,0,0,0.6); border: 1px solid rgba(245,158,11,0.3); color: #f5e6d3; border-radius: 8px; padding: 7px 10px;">
          <option value="mancanti">Solo mancanti ({{ assocMancanti }})</option>
          <option value="tutte">Tutte ({{ waifuList.length }})</option>
        </select>
        <input v-model="assocRicerca" placeholder="Cerca..." style="flex: 1; font-family: Orbitron, sans-serif; font-size: 9px; background: rgba(0,0,0,0.6); border: 1px solid rgba(245,158,11,0.3); color: #f5e6d3; border-radius: 8px; padding: 7px 12px;" />
        <button v-if="assocPendingCount > 0 && !assocUploading" @click="assocCaricaTutto" style="font-family: Orbitron, sans-serif; font-size: 9px; padding: 7px 18px; background: linear-gradient(135deg, #f59e0b, #ec4899); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer;">
          ⬆ Carica Tutto ({{ assocPendingCount }})
        </button>
        <div v-if="assocUploading" style="font-family: Orbitron, sans-serif; font-size: 9px; padding: 7px 12px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; color: #f59e0b;">⏳ {{ assocProgresso.fatto }}/{{ assocProgresso.totale }}</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
        <div
          v-for="w in assocLista"
          :key="(w as any).id"
          :style="{
            background: assocPending[(w as any).id] ? 'rgba(6,214,160,0.08)' : 'rgba(0,0,0,0.4)',
            border: `1px solid ${assocPending[(w as any).id] ? 'rgba(6,214,160,0.4)' : 'rgba(245,158,11,0.15)'}`,
            borderRadius: '10px', padding: '10px 12px',
          }"
        >
          <div style="width: 100%; height: 80px; background: rgba(0,0,0,0.5); border-radius: 6px; margin-bottom: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <template v-if="assocPending[(w as any).id]?.previewUrl || (w as any)[assocTipoSel]">
              <div v-if="assocTipoSel.includes('video') && !assocPending[(w as any).id]" style="font-size: 24px;">🎬</div>
              <img v-else :src="assocPending[(w as any).id]?.previewUrl || ikUrl((w as any)[assocTipoSel], 'thumbnail') || ''" :alt="(w as any).nome" style="width: 100%; height: 100%; object-fit: cover;" />
            </template>
            <div v-else style="font-size: 24px; opacity: 0.3;">📷</div>
          </div>
          <div style="font-family: Orbitron, sans-serif; font-size: 9px; color: #f59e0b; margin-bottom: 4px; font-size: 10px; font-family: Cinzel; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ (w as any).nome }}</div>
          <div style="font-family: Orbitron, sans-serif; font-size: 7px; color: rgba(245,158,11,0.4); margin-bottom: 8px;">{{ (w as any).rarita }}</div>
          <div style="display: flex; gap: 5px;">
            <label :style="{
              flex: 1, fontFamily: 'Orbitron, sans-serif', fontSize: '9px',
              padding: '5px 6px',
              background: assocPending[(w as any).id] ? 'rgba(6,214,160,0.15)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${assocPending[(w as any).id] ? 'rgba(6,214,160,0.4)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: '6px', color: assocPending[(w as any).id] ? '#06d6a0' : '#f59e0b',
              cursor: 'pointer', textAlign: 'center',
            }">
              {{ assocPending[(w as any).id] ? '✓ Pronta' : 'Seleziona' }}
              <input
                type="file"
                :accept="assocTipoSel.includes('video') ? 'video/*' : 'image/*'"
                style="display: none;"
                :disabled="assocUploading"
                @change="(e: any) => { if (e.target.files[0]) assocHandleFileSelect((w as any).id, e.target.files[0]); e.target.value = ''; }"
              />
            </label>
            <button v-if="assocPending[(w as any).id]" @click="assocRimuoviPending((w as any).id)" :disabled="assocUploading" style="font-family: Orbitron, sans-serif; font-size: 9px; padding: 5px 8px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; color: #ef4444; cursor: pointer;">✕</button>
          </div>
        </div>
        <div v-if="assocLista.length === 0" style="grid-column: 1/-1; text-align: center; padding: 40px; color: rgba(245,158,11,0.3); font-family: Orbitron; font-size: 11px;">Nessuna waifu trovata</div>
      </div>
    </div>

  </div>
</template>
