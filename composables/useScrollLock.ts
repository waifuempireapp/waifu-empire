// Composable che blocca lo scroll del body quando un modal è aperto.
// Porta useScrollLock.js — gestisce iOS fix con position:fixed + top negativo.
export function useScrollLock(active: Ref<boolean> | boolean = true) {
  let scrollY = 0

  function lock() {
    scrollY = window.scrollY
    const body = document.body
    body.classList.add('modal-open')
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overscrollBehavior = 'none'
    document.documentElement.style.overflow = 'hidden'
  }

  function unlock() {
    const body = document.body
    body.classList.remove('modal-open')
    body.style.overflow = ''
    body.style.position = ''
    body.style.top = ''
    body.style.width = ''
    body.style.overscrollBehavior = ''
    document.documentElement.style.overflow = ''
    window.scrollTo(0, scrollY)
  }

  if (typeof active === 'boolean') {
    // Utilizzo statico: lock al mount, unlock al unmount
    onMounted(() => { if (active) lock() })
    onUnmounted(unlock)
  } else {
    // Utilizzo reattivo: segue il ref
    watch(active, (val) => { val ? lock() : unlock() }, { immediate: true })
    onUnmounted(unlock)
  }
}
