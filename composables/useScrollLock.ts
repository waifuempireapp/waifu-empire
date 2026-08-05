// Composable che blocca lo scroll del body quando un modal è aperto.
// TOKEN-BASED: ogni istanza possiede un token unico; il body è bloccato finché
// almeno un token è attivo. Rispetto al vecchio contatore numerico questo evita
// i desync (un release "extra" non porta più il contatore in negativo/positivo
// errato) che lasciavano lo scroll rotto OVUNQUE: o bloccato per sempre, o
// sbloccato mentre un modale era ancora aperto. take()/drop() sono idempotenti.
const _holders = new Set<symbol>()
let _scrollY = 0
let _applied = false

function _apply() {
  if (_applied) return
  _applied = true
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
  if (!_applied) return
  _applied = false
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

// Riallinea lo stato del body al numero di holder attivi.
function _sync() {
  if (_holders.size > 0) _apply()
  else _release()
}

/** Failsafe: rilascia TUTTI i lock (usato al cambio tab per non restare bloccati). */
export function releaseAllScrollLocks() {
  if (typeof document === 'undefined') return
  _holders.clear()
  _release()
}

export function useScrollLock(active: Ref<boolean> | boolean = true) {
  // Token unico per istanza: add/remove sono idempotenti e non interferiscono con
  // gli altri holder, quindi niente più desync del contatore.
  const tok = Symbol('scroll-lock')
  const take = () => { if (typeof document !== 'undefined') { _holders.add(tok); _sync() } }
  const drop = () => { if (typeof document !== 'undefined') { _holders.delete(tok); _sync() } }

  if (typeof active === 'boolean') {
    onMounted(() => { if (active) take() })
    onUnmounted(drop)
  } else {
    watch(active, (val) => { val ? take() : drop() }, { immediate: true })
    onUnmounted(drop)
  }
}
