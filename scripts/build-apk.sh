#!/usr/bin/env bash
# ============================================================
# build-apk.sh — Compila l'APK Android (debug) in un colpo solo.
# Uso:  npm run app
#
# L'app Android carica il sito live (capacitor.config server.url), quindi il
# contenuto di dist/ non è usato a runtime: serve solo perché `cap sync` lo
# richiede. Lo step chiave è la PULIZIA dei file duplicati "​ 2"/"​ 3" creati
# dal sync del filesystem (iCloud/Dropbox): finiscono nelle assets Android e
# rompono Gradle ("Failed to create MD5 hash", "invalid resource name").
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

clean_junk() {
  # Rimuove i file "<nome> <cifra>.<ext>" (es. "config 2.xml") nel percorso dato
  find "$1" -path "*/node_modules" -prune -o -path "*/.git" -prune -o \
    -name "* [0-9].*" -print -delete 2>/dev/null || true
}

echo "▶ [1/4] Pulizia file duplicati ' N' (rompono la build Android)…"
clean_junk "$ROOT/dist"
clean_junk "$ROOT/android"

# webDir richiesto da cap sync anche se l'app carica il sito remoto
if [ ! -d "$ROOT/dist" ]; then
  echo "▶ dist/ mancante → genero l'output web (una tantum)…"
  npx nuxi generate
  clean_junk "$ROOT/dist"
fi

echo "▶ [2/4] Sync Capacitor (config + plugin nativi)…"
npx cap sync android

echo "▶ [3/4] Ripulisco eventuali junk ricopiati nelle assets…"
clean_junk "$ROOT/android"

echo "▶ [4/4] Build APK debug…"
cd "$ROOT/android"
./gradlew assembleDebug

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
if [ -f "$APK" ]; then
  echo "✅ APK pronto:"
  echo "   $APK"
  echo "   Installa con:  adb install -r \"$APK\""
else
  echo "⚠ Build terminata ma APK non trovato in $APK"
  exit 1
fi
