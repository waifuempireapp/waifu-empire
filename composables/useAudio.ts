// Composable Vue attorno all'audioEngine: stato reattivo (musica/SFX/volume)
// persistito in localStorage. I ref sono a livello di modulo → condivisi.
import { ref } from 'vue'
import { audio } from '~/utils/audioEngine'

const musicOn = ref(true)
const sfxOn   = ref(true)
const volume  = ref(0.5)
let inited = false

function loadOnce() {
  if (inited || typeof window === 'undefined') return
  inited = true
  const m = localStorage.getItem('iw_music_on'); if (m !== null) musicOn.value = m === '1'
  const s = localStorage.getItem('iw_sfx_on');   if (s !== null) sfxOn.value   = s === '1'
  const v = localStorage.getItem('iw_volume');   if (v !== null) volume.value  = parseFloat(v) || 0.5
  audio.musicEnabled = musicOn.value
  audio.sfxEnabled   = sfxOn.value
  audio.volume       = volume.value
}

export function useAudio() {
  loadOnce()
  const setMusic = (on: boolean) => {
    musicOn.value = on
    if (typeof window !== 'undefined') localStorage.setItem('iw_music_on', on ? '1' : '0')
    audio.setMusicEnabled(on)
  }
  const setSfx = (on: boolean) => {
    sfxOn.value = on
    if (typeof window !== 'undefined') localStorage.setItem('iw_sfx_on', on ? '1' : '0')
    audio.setSfxEnabled(on)
  }
  const setVol = (v: number) => {
    volume.value = v
    if (typeof window !== 'undefined') localStorage.setItem('iw_volume', String(v))
    audio.setVolume(v)
  }
  return { musicOn, sfxOn, volume, setMusic, setSfx, setVol, audio }
}
