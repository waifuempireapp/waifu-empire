// ============================================================
// FIX iOS/Safari: `btoa()` nativo lancia "InvalidCharacterError: The string
// contains invalid characters" quando riceve una stringa con caratteri > 0xFF
// (Unicode: nomi/descrizioni waifu con giapponese, accenti, emoji...).
// La base64 interna di Firebase (@firebase/util `base64.encodeString`) chiama
// `btoa()` diretto quando c'è supporto nativo → su iOS crashava l'apertura
// della Collezione con una Unhandled Promise Rejection.
//
// Patch SICURA: prova prima il btoa nativo (comportamento identico per stringhe
// Latin1/binarie, che DEVONO restare invariate). Solo se lancia — cioè input
// Unicode — ripiega su una codifica UTF-8 valida. Non altera nessun caso che
// oggi funziona; elimina solo il crash.
// ============================================================
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined' || typeof window.btoa !== 'function') return

  const nativeBtoa = window.btoa.bind(window)
  window.btoa = function (input: string): string {
    try {
      return nativeBtoa(input)
    } catch {
      // Input Unicode → codifica UTF-8 poi base64 (non lancia più)
      return nativeBtoa(unescape(encodeURIComponent(String(input))))
    }
  }
})
