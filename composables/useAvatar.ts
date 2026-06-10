// useAvatar — gestisce l'avatar utente.
// Valori ammessi per avatarUrl:
//   null          → avatar default "WE" (accent primary)
//   '#xxxxxx'     → cerchio colorato preset (hex color)
//   'https://...' o '/_nuxt/...' → immagine (preset o remota)
// Persiste in localStorage con chiave 'userAvatarUrl'.
// Aggiornamento reattivo tramite useState (Nuxt).
//
// Per aggiungere nuovi avatar: basta copiare un file *_icon.png in
// assets/images/icons/ — viene incluso automaticamente senza toccare codice.

export function useAvatar() {
  const avatarUrl = useState<string | null>('user-avatar-url', () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userAvatarUrl') || null
    }
    return null
  })

  function setAvatar(value: string | null) {
    avatarUrl.value = value
    if (typeof window !== 'undefined') {
      if (value) localStorage.setItem('userAvatarUrl', value)
      else localStorage.removeItem('userAvatarUrl')
    }
  }

  return { avatarUrl, setAvatar }
}

// Preset avatar — colori del design system + immagini da assets/images/icons/.
export type AvatarPreset =
  | { id: string; label: string; color: string; image?: never }
  | { id: string; label: string; image: string; color?: never }

// Carica automaticamente tutti i file *_icon.png dalla cartella icons.
// import.meta.glob è risolto da Vite a build-time: aggiungere un file
// nella cartella è sufficiente, nessun import manuale necessario.
const iconModules = import.meta.glob<{ default: string }>(
  '~/assets/images/icons/*_icon.png',
  { eager: true }
)

const iconPresets: AvatarPreset[] = Object.entries(iconModules).map(([path, mod]) => {
  // Estrae il nome dal percorso: '.../blade_icon.png' → 'Blade'
  const filename = path.split('/').pop() ?? ''
  const name = filename.replace('_icon.png', '')
  const label = name.charAt(0).toUpperCase() + name.slice(1)
  return { id: `preset-${name}`, image: mod.default, label }
})

export const AVATAR_PRESETS: AvatarPreset[] = [
  //{ id: 'preset-violet',  color: '#7C3AED', label: 'Viola'   },
  //{ id: 'preset-pink',    color: '#D946A8', label: 'Rosa'    },
  //{ id: 'preset-aqua',    color: '#06d6a0', label: 'Acqua'   },
  //{ id: 'preset-gold',    color: '#f5c560', label: 'Oro'     },
  //{ id: 'preset-blue',    color: '#5aa9ff', label: 'Blu'     },
  //{ id: 'preset-fuchsia', color: '#e879f9', label: 'Fucsia'  },
  ...iconPresets,
]
