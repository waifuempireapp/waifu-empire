// Composable che blocca lo scroll del body quando un modal è aperto.
// REFERENCE-COUNTED: con modali annidati (es. BattleModal → PickPhase → Arena)
// il body si sblocca solo quando l'ULTIMO lock viene rilasciato — prima ogni
// unmount sbloccava/ri-bloccava a caso e poteva lasciare lo scroll rotto ovunque.
let _locks = 0
let _scrollY = 0

function _apply() {
  const body = document.body
  _scrollY = window.scrollY
  body.classList.add('modal-open')
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${_scrollY}px`
  body.style.width = '100%'
  body.style.overscrollBehavior = 'none'
  document.documentElement.style.overflow = 'hidden'
}

function _release() {
  const body = document.body
  body.classList.remove('modal-open')
  body.style.overflow = ''
  body.style.position = ''
  body.style.top = ''
  body.style.width = ''
  body.style.overscrollBehavior = ''
  document.documentElement.style.overflow = ''
  window.scrollTo(0, _scrollY)
}

function lock() {
  if (typeof document === 'undefined') return
  _locks++
  if (_locks === 1) _apply()
}

function unlock() {
  if (typeof document === 'undefined') return
  _locks = Math.max(0, _locks - 1)
  if (_locks === 0) _release()
}

/** Failsafe: rilascia TUTTI i lock (usato al cambio tab per non restare bloccati). */
export function releaseAllScrollLocks() {
  if (typeof document === 'undefined') return
  if (_locks > 0) { _locks = 0; _release() }
}

export function useScrollLock(active: Ref<boolean> | boolean = true) {
  let holding = false
  const take = () => { if (!holding) { holding = true; lock() } }
  const drop = () => { if (holding) { holding = false; unlock() } }

  if (typeof active === 'boolean') {
    onMounted(() => { if (active) take() })
    onUnmounted(drop)
  } else {
    watch(active, (val) => { val ? take() : drop() }, { immediate: true })
    onUnmounted(drop)
  }
}
