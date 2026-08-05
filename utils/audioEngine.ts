// ============================================================
// AUDIO ENGINE — musica di sottofondo (file reali) + SFX click.
// Le 4 tracce (assets/musics) sono mappate su "mood" per tab, riprodotte in
// loop con crossfade dolce al cambio tab. Rallentate leggermente (playbackRate
// 0.9, senza preservare il pitch → più profonde/dolci) e a volume basso così
// restano di sottofondo e non stancano. Il click dei bottoni è un tick sintetico.
// ============================================================

// Import dei file (Vite → URL bundlato)
import urlPeace     from '~/assets/musics/mickeyscat-moment-of-peace-mickeyscat-554494.mp3'
import urlWonders   from '~/assets/musics/grand_project-wonders-of-the-earth-550792.mp3'
import urlDramatic  from '~/assets/musics/artmylife-powerful-dramatic-trailer-514242.mp3'
import urlAction    from '~/assets/musics/magpiemusic-action-trailer-promo-rock-513687.mp3'

export type Mood = 'home' | 'collection' | 'map' | 'battle' | 'shop' | 'default'

const MOOD_URL: Record<Mood, string> = {
  map:        urlDramatic,    // teso/drammatico
  collection: urlWonders,     // esplorazione
  battle:     urlAction,      // energico
  home:       urlPeace,       // tranquilla e pacata
  shop:       urlPeace,
  default:    urlPeace,
}

const BASE_VOL = 0.28          // volume base (basso: sottofondo)
const PLAYBACK = 0.82          // rallenta → più dolce/profonda
const FADE_MS  = 2400          // durata crossfade

interface Track { el: HTMLAudioElement; mood: Mood; raf: number | null }

class AudioEngine {
  private current: Track | null = null
  private pendingMood: Mood = 'default'
  private started = false

  // AudioContext piccolo solo per lo SFX click
  private ctx: AudioContext | null = null

  mood: Mood = 'default'
  musicEnabled = true
  sfxEnabled = true
  volume = 0.5

  private targetVol(): number {
    return this.musicEnabled ? BASE_VOL * this.volume : 0
  }

  private fade(el: HTMLAudioElement, to: number, ms: number, onEnd?: () => void): number {
    const from = el.volume
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      el.volume = Math.max(0, Math.min(1, from + (to - from) * p))
      if (p < 1) return requestAnimationFrame(step)
      onEnd?.()
      return 0
    }
    return requestAnimationFrame(step)
  }

  private makeTrack(mood: Mood): Track {
    const el = new Audio(MOOD_URL[mood] ?? MOOD_URL.default)
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
    // Rallenta senza preservare il pitch (più morbida). Prefissi vendor per Safari.
    try {
      (el as any).preservesPitch = false
      ;(el as any).mozPreservesPitch = false
      ;(el as any).webkitPreservesPitch = false
    } catch { /* noop */ }
    el.playbackRate = PLAYBACK
    return { el, mood, raf: null }
  }

  private playMood(mood: Mood): void {
    if (this.current && this.current.mood === mood) {
      // già attivo: assicura riproduzione e volume corretto
      this.current.el.play().catch(() => {})
      this.fade(this.current.el, this.targetVol(), 600)
      return
    }
    const next = this.makeTrack(mood)
    next.el.play().catch(() => {})
    this.fade(next.el, this.targetVol(), FADE_MS)
    // Sfuma e ferma la traccia precedente
    const prev = this.current
    if (prev) {
      this.fade(prev.el, 0, FADE_MS, () => { try { prev.el.pause(); prev.el.src = '' } catch { /* noop */ } })
    }
    this.current = next
  }

  // Avvia la musica (idempotente) — va chiamato dopo il primo gesto utente
  start(): void {
    if (typeof window === 'undefined') return
    this.started = true
    this.playMood(this.pendingMood)
  }

  // Cambia mood (tab): crossfade alla nuova traccia
  setMood(m: Mood): void {
    this.mood = m
    this.pendingMood = m
    if (this.started && this.musicEnabled) this.playMood(m)
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on
    if (!this.started) return
    if (on) this.playMood(this.pendingMood)
    else if (this.current) this.fade(this.current.el, 0, 500, () => { try { this.current?.el.pause() } catch { /* noop */ } })
  }

  setSfxEnabled(on: boolean): void { this.sfxEnabled = on }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.current && this.musicEnabled) this.fade(this.current.el, this.targetVol(), 200)
  }

  // Sospende l'audio (uscita dal gioco) senza cambiare le preferenze
  suspend(): void {
    try { this.current?.el.pause() } catch { /* noop */ }
    this.ctx?.suspend().catch(() => {})
  }

  // ── SFX click (tick morbido sintetico) ──────────────────────────────────
  private makeCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (this.ctx) return this.ctx
    const AC = (window.AudioContext || (window as any).webkitAudioContext)
    if (!AC) return null
    this.ctx = new AC()
    return this.ctx
  }
  // Genera un singolo tono con inviluppo dolce ed eventuale glissato f0→f1
  private tone(
    ctx: AudioContext, now: number,
    f0: number, f1: number, type: OscillatorType, vol: number, dur: number, glideT?: number,
  ): void {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, now)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, now + (glideT ?? dur))
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(g); g.connect(ctx.destination)
    osc.start(now); osc.stop(now + dur + 0.02)
  }

  // Tre timbri: 'yes' (positivo, ascendente), 'no' (grave, discendente), default (tick neutro)
  playClick(kind: 'yes' | 'no' | 'default' = 'default'): void {
    if (!this.sfxEnabled) return
    const ctx = this.makeCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    const v = 0.07 * (0.6 + this.volume * 0.6)
    if (kind === 'yes') {
      // Conferma: due voci che salgono, brillante e gradevole
      this.tone(ctx, now, 620, 1040, 'sine',     v,        0.12, 0.09)
      this.tone(ctx, now, 930, 1560, 'triangle', v * 0.30, 0.12, 0.09)
    } else if (kind === 'no') {
      // Rifiuto/annulla: grave e discendente, morbido (non sgradevole)
      this.tone(ctx, now, 440, 220, 'sine',     v,        0.17, 0.14)
      this.tone(ctx, now, 300, 150, 'triangle', v * 0.35, 0.17, 0.14)
    } else {
      // Tick neutro per tutto il resto
      this.tone(ctx, now, 640, 640, 'sine',     v,        0.11)
      this.tone(ctx, now, 960, 960, 'triangle', v * 0.35, 0.11)
    }
  }
}

export const audio = new AudioEngine()

export function tabToMood(tab: string): Mood {
  switch (tab) {
    case 'mappa': return 'map'
    case 'collezione': return 'collection'
    case 'home': return 'home'
    case 'swap':
    case 'classifica':
    case 'missioni': return 'home'
    default: return 'default'
  }
}
