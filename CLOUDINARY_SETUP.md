# GUIDA SETUP CLOUDINARY

Cloudinary è il servizio di hosting immagini che sostituisce Firebase Storage.

## 1. CREA ACCOUNT CLOUDINARY (GRATIS)

1. Vai su https://cloudinary.com/users/register_free
2. Registrati con email (oppure Google/GitHub)
3. Conferma email
4. Accedi alla Dashboard

## 2. OTTIENI LE CREDENZIALI

Nella Dashboard Cloudinary (https://console.cloudinary.com):

1. In alto a destra vedi il tuo **Cloud Name** (es: `democloud123`)
2. Clicca su **Settings** (icona ingranaggio in alto a destra)
3. Vai su **Access Keys**
4. Troverai:
   - **Cloud Name**: il tuo identificativo Cloudinary
   - **API Key**: chiave pubblica (es: `123456789012345`)
   - **API Secret**: chiave segreta (es: `AbC123XyZ...`) — clicca "Reveal" per vederla

## 3. CONFIGURA IL PROGETTO

Crea un file `.env.local` nella root del progetto (stessa cartella di `package.json`):

```env
# Copia da .env.example e compila con i tuoi valori

# Firebase (già configurate)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ...

# Cloudinary - INSERISCI I TUOI VALORI QUI
CLOUDINARY_CLOUD_NAME=il_tuo_cloud_name
CLOUDINARY_API_KEY=la_tua_api_key
CLOUDINARY_API_SECRET=la_tua_api_secret
```

**IMPORTANTE:**
- NON committare `.env.local` su Git (è già in `.gitignore`)
- Le credenziali Cloudinary sono SEGRETE come quelle Firebase Admin

## 4. INSTALLA DIPENDENZE

```bash
npm install
```

Questo installerà `cloudinary@^2.5.1` aggiunta al `package.json`.

## 5. VERIFICA SETUP

1. Avvia il progetto: `npm run dev`
2. Vai su `/admin`
3. Prova a caricare un'immagine per una waifu/outfit/posa
4. Se tutto funziona, vedrai l'URL Cloudinary salvato (formato: `https://res.cloudinary.com/[cloud_name]/image/upload/...`)

## 6. LIMITI PIANO GRATUITO

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/mese
- **Trasformazioni**: 25.000/mese

Per il tuo progetto in sviluppo è più che sufficiente.

## 7. TROUBLESHOOTING

### Errore "Invalid API credentials"
- Verifica di aver copiato correttamente Cloud Name, API Key e API Secret
- Assicurati che non ci siano spazi all'inizio/fine delle stringhe
- Riavvia il server Next.js dopo aver modificato `.env.local`

### Errore "CORS" o "Network error"
- L'upload passa tramite `/api/upload` (server-side), non dovrebbero esserci problemi CORS
- Verifica che la route API sia accessibile: `http://localhost:3000/api/upload`

### Immagini non si caricano
- Controlla la console browser (F12) per errori
- Verifica che l'URL Cloudinary restituito sia valido (aprilo in un altro tab)
- Controlla i logs del server Next.js per errori durante l'upload

## 8. MIGRAZIONE DA FIREBASE STORAGE (se avevi già immagini)

Se avevi già caricato immagini su Firebase Storage:

1. Scaricale manualmente dalla console Firebase Storage
2. Ri-caricale tramite l'admin panel (ora useranno Cloudinary)
3. Gli URL verranno automaticamente aggiornati nel database Firestore

## 9. STRUTTURA CARTELLE SU CLOUDINARY

Le immagini vengono organizzate così:

```
impero-waifu/
├── waifu/
│   ├── w1_paperdoll.png
│   ├── w1_statica.png
│   ├── w1_immersiva.mp4
│   └── ...
├── outfit/
│   ├── o1.png
│   └── ...
├── pose/
│   ├── p1.png
│   └── ...
└── drops/
    ├── drop1_pack.png
    └── ...
```

Puoi vederle tutte nella Cloudinary Dashboard > Media Library.

## 10. PERFORMANCE E CDN

Cloudinary include automaticamente:
- **CDN globale** (immagini servite dal nodo più vicino all'utente)
- **Ottimizzazione automatica** formato/qualità
- **Lazy loading** support
- **Responsive images** (puoi trasformare URL per diverse risoluzioni)

Esempio trasformazioni URL:
```
# Originale
https://res.cloudinary.com/demo/image/upload/v1234/impero-waifu/waifu/w1.png

# Ridimensionata a 300px larghezza
https://res.cloudinary.com/demo/image/upload/w_300/v1234/impero-waifu/waifu/w1.png

# WebP automatico (migliore compressione)
https://res.cloudinary.com/demo/image/upload/f_auto/v1234/impero-waifu/waifu/w1.png
```

Queste ottimizzazioni sono opzionali — puoi aggiungerle in futuro se necessario.
