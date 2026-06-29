import { defineStore } from 'pinia'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { getDb } from '~/utils/firebase'

export type MissionType =
  | 'open_pack'
  | 'conquer'
  | 'legendary'
  | 'swipe_waifu'
  | 'mysterious_draw'

interface MissionDef {
  id: MissionType
  label: string
  icon: 'gift' | 'map' | 'target' | 'heart' | 'fish'
  reward: { type: 'kisses' | 'pack'; amount: number }
  target: number
}

export interface Mission extends MissionDef {
  current: number
  completed: boolean
}

export const MISSIONS_DEF: MissionDef[] = [
  { id: 'open_pack',       label: 'Open 2 packs',            icon: 'gift',   reward: { type: 'kisses', amount: 50  }, target: 2  },
  { id: 'conquer',         label: 'Conquer 3 territories',   icon: 'map',    reward: { type: 'pack',   amount: 1   }, target: 3  },
  { id: 'legendary',       label: 'Unlock 1 legendary card', icon: 'target', reward: { type: 'kisses', amount: 200 }, target: 1  },
  { id: 'swipe_waifu',     label: 'Swipe 30 times',          icon: 'heart',  reward: { type: 'kisses', amount: 100 }, target: 30 },
  { id: 'mysterious_draw', label: 'Make a mysterious draw',  icon: 'fish',   reward: { type: 'kisses', amount: 75  }, target: 1  },
]

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface MissionsState {
  progress: Record<string, number>
  claimed:  Record<string, boolean>
  _uid:     string | null
}

export const useMissionsStore = defineStore('missions', {
  state: (): MissionsState => ({
    progress: {},
    claimed:  {},
    _uid:     null,
  }),

  getters: {
    missions: (state): Mission[] =>
      MISSIONS_DEF.map(def => ({
        ...def,
        current:   Math.min(state.progress[def.id] ?? 0, def.target),
        completed: (state.progress[def.id] ?? 0) >= def.target,
      })),

    completedCount: (state): number =>
      MISSIONS_DEF.filter(def => (state.progress[def.id] ?? 0) >= def.target).length,

    isClaimed: (state) => (id: MissionType): boolean =>
      state.claimed[id] === true,
  },

  actions: {
    // ── Caricamento ───────────────────────────────────────────────────────────
    async load(uid?: string) {
      if (uid) this._uid = uid

      // 1. Prova Firestore se abbiamo l'UID
      if (this._uid) {
        try {
          const db   = getDb()
          const snap = await getDoc(doc(db, 'users', this._uid))
          if (snap.exists()) {
            const data = (snap.data() as Record<string, unknown>)?.dailyMissions as
              | { date: string; progress: Record<string, number>; claimed: Record<string, boolean> }
              | undefined
            if (data?.date === todayStr()) {
              this.progress = data.progress ?? {}
              this.claimed  = data.claimed  ?? {}
              this._cacheLocal()
              return
            }
          }
        } catch { /* se Firestore non è raggiungibile, usa localStorage */ }
      }

      // 2. Fallback: localStorage
      this._loadLocal()
    },

    // ── Tracking azione ───────────────────────────────────────────────────────
    trackAction(type: MissionType, amount = 1) {
      const def = MISSIONS_DEF.find(d => d.id === type)
      if (!def) return
      const cur = this.progress[type] ?? 0
      if (cur >= def.target) return
      this.progress = { ...this.progress, [type]: Math.min(cur + amount, def.target) }
      this._cacheLocal()
      this._persistFirestore()
    },

    // ── Claim ricompensa ──────────────────────────────────────────────────────
    claimMission(id: MissionType) {
      this.claimed = { ...this.claimed, [id]: true }
      this._cacheLocal()
      this._persistFirestore()
    },

    // ── Reset (admin / test) ──────────────────────────────────────────────────
    resetDailyMissions() {
      this.progress = {}
      this.claimed  = {}
      this._cacheLocal()
      this._persistFirestore()
    },

    // ── Privati ───────────────────────────────────────────────────────────────
    _loadLocal() {
      if (typeof window === 'undefined') return
      const today = todayStr()
      try {
        this.progress = JSON.parse(localStorage.getItem(`waifu_daily_progress_${today}`) || '{}')
        this.claimed  = JSON.parse(localStorage.getItem(`waifu_daily_claimed_${today}`)  || '{}')
      } catch {
        this.progress = {}
        this.claimed  = {}
      }
    },

    _cacheLocal() {
      if (typeof window === 'undefined') return
      const today = todayStr()
      localStorage.setItem(`waifu_daily_progress_${today}`, JSON.stringify(this.progress))
      localStorage.setItem(`waifu_daily_claimed_${today}`,  JSON.stringify(this.claimed))
    },

    _persistFirestore() {
      if (!this._uid) return
      const payload = {
        dailyMissions: {
          date:     todayStr(),
          progress: this.progress,
          claimed:  this.claimed,
        },
      }
      try {
        const db = getDb()
        updateDoc(doc(db, 'users', this._uid), payload).catch(() => {})
      } catch { /* ignora: Firebase potrebbe non essere ancora inizializzato */ }
    },
  },
})
