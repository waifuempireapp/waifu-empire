# 🚀 Guida Deploy — Impero delle Waifu

Procedura completa dal progetto vuoto al sito live.

---

## PARTE 1 — Setup Firebase (10 minuti)

### 1.1 Crea il progetto Firebase
1. Vai su https://console.firebase.google.com
2. Click **"Aggiungi progetto"**
3. Nome progetto: `impero-waifu` (o quello che preferisci)
4. Disabilita Google Analytics (opzionale, non serve)
5. Click **"Crea progetto"**

### 1.2 Abilita Authentication
1. Nel menu laterale: **Build → Authentication**
2. Click **"Inizia"**
3. Tab **"Sign-in method"** → abilita:
   - **Google** (basta abilitare e impostare email pubblica)
   - **Email/Password**

### 1.3 Crea Firestore Database
1. Nel menu laterale: **Build → Firestore Database**
2. Click **"Crea database"**
3. Modalità: **Avvio in produzione** (le regole le caricheremo dopo)
4. Località: **eur3 (Europe)** o quella più vicina
5. Click **"Abilita"**

### 1.4 Crea Storage
1. Nel menu laterale: **Build → Storage**
2. Click **"Inizia"**
3. Modalità: **Avvio in produzione**
4. Località: stessa di Firestore
5. Click **"Fine"**

### 1.5 Aggiungi te stesso come admin in Firestore
1. Vai su **Firestore Database**
2. Click **"+ Avvia raccolta"**
3. ID raccolta: `admins`
4. ID documento: `list`
5. Aggiungi un campo:
   - Nome: `emails`
   - Tipo: `array`
   - Valori: aggiungi la tua email (es. `mario.rossi@gmail.com`)
6. Click **"Salva"**

### 1.6 Configura l'app Web
1. Nella dashboard del progetto, click sull'icona **`</>`** (Add web app)
2. Nickname app: `Impero Waifu Web`
3. **NON** abilitare Firebase Hosting (useremo Vercel)
4. Click **"Registra app"**
5. **Copia tutto il blocco `firebaseConfig`** — ti servirà tra un momento

### 1.7 Genera Service Account (per Admin SDK)
1. Vai sulle **impostazioni del progetto** (icona ingranaggio in alto)
2. Tab **"Account di servizio"**
3. Click **"Genera nuova chiave privata"** → scarica il file JSON
4. **Conservalo** — ti servirà per le variabili d'ambiente Vercel

---

## PARTE 2 — Setup GitHub (5 minuti)

### 2.1 Crea repository
1. Vai su https://github.com/new
2. Nome repo: `impero-waifu` (o come vuoi)
3. **Privato** (consigliato — il codice include la logica di gioco)
4. NON aggiungere README/gitignore (li abbiamo già)
5. Click **"Create repository"**

### 2.2 Push del codice locale
Dalla cartella del progetto:

```bash
git init
git add .
git commit -m "Initial commit - Impero delle Waifu"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/impero-waifu.git
git push -u origin main
```

---

## PARTE 3 — Deploy Vercel (5 minuti)

### 3.1 Importa il progetto
1. Vai su https://vercel.com (login con GitHub)
2. Click **"Add New… → Project"**
3. Seleziona il repo `impero-waifu`
4. Click **"Import"**

### 3.2 Configura le variabili d'ambiente
Nella schermata di import, espandi **"Environment Variables"** e aggiungi:

#### Variabili lato client (dal `firebaseConfig` copiato al punto 1.6):
| Nome | Valore |
|------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | il tuo apiKey |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | il tuo authDomain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | il tuo projectId |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | il tuo storageBucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | il tuo messagingSenderId |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | il tuo appId |
| `NEXT_PUBLIC_ADMIN_EMAILS` | la tua email (es. `mario.rossi@gmail.com`) |

#### Variabili lato server (dal file JSON service account scaricato al punto 1.7):
| Nome | Valore |
|------|--------|
| `FIREBASE_ADMIN_PROJECT_ID` | `project_id` dal JSON |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | `client_email` dal JSON |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **TUTTA** la `private_key` dal JSON, virgolette incluse |
| `ADMIN_EMAILS` | la tua email (stessa di `NEXT_PUBLIC_ADMIN_EMAILS`) |

> ⚠️ Per `FIREBASE_ADMIN_PRIVATE_KEY`: copia il valore esattamente come appare nel JSON, inclusi i `\n` letterali (NON convertirli in newline reali).

### 3.3 Deploy!
1. Click **"Deploy"**
2. Aspetta 2-3 minuti
3. Quando completa, hai un URL pubblico tipo `https://impero-waifu.vercel.app`

---

## PARTE 4 — Pubblica le regole di sicurezza (5 minuti)

### 4.1 Installa Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 4.2 Inizializza nel progetto
Dalla cartella del progetto:

```bash
firebase use TUO-PROJECT-ID
```

Sostituisci `TUO-PROJECT-ID` con il `projectId` Firebase.

### 4.3 Pubblica le regole
```bash
firebase deploy --only firestore:rules,storage
```

Questo carica `firestore.rules` e `storage.rules` su Firebase.

---

## PARTE 5 — Aggiungi i domini autorizzati per Auth

1. Console Firebase → **Authentication → Settings**
2. Sezione **"Authorized domains"**
3. Click **"Add domain"** e aggiungi:
   - `impero-waifu.vercel.app` (o il tuo dominio Vercel)
   - Eventuale dominio custom se ne hai uno

---

## PARTE 6 — Primo accesso e creazione drop

1. Vai sul tuo URL pubblico
2. Login con la tua email Google (quella in `ADMIN_EMAILS`)
3. Onboarding: crea il tuo impero
4. Vedrai **⚙ ADMIN** in alto a destra → click
5. **Tab "Drops"** → "+ NUOVO DROP" → "Stagione 1 - Genesi"
6. **Tab "Waifu"** → crea le prime waifu (anche solo i dati, gli asset li carichi dopo)
7. Torna ai "Drops" → modifica → seleziona le waifu/outfit/pose → spunta **"ATTIVO"** → SALVA

Adesso i tuoi pacchetti pescano da quel drop!

---

## 🔧 Aggiornamenti futuri

Dopo modifiche al codice:
```bash
git add .
git commit -m "messaggio"
git push
```

Vercel rebuilda automaticamente. Le regole Firestore/Storage vanno ridepoyate manualmente con `firebase deploy --only firestore:rules,storage` se le cambi.

---

## ❓ Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| "Firebase: Error (auth/unauthorized-domain)" | Aggiungi il dominio Vercel nei domini autorizzati (PARTE 5) |
| "Missing or insufficient permissions" | Verifica che il documento `admins/list` esista e contenga la tua email |
| Build fallisce su Vercel | Controlla che TUTTE le 11 variabili d'ambiente siano impostate |
| `FIREBASE_ADMIN_PRIVATE_KEY` non funziona | Copia il valore con virgolette doppie e `\n` letterali |
| Admin tab non appare | Verifica `NEXT_PUBLIC_ADMIN_EMAILS` (variabile client, deve avere il prefisso `NEXT_PUBLIC_`) |

---

## 📊 Costi stimati

- **Firebase**: Spark plan (gratis) basta per molte centinaia di utenti
- **Vercel**: Hobby (gratis) basta per il traffico iniziale
- **Dominio custom** (opzionale): ~12€/anno

Quando supererai le quote gratuite (Firestore: 50k letture/giorno, Storage: 5GB) potrai upgradare il piano Firebase Blaze (pay-as-you-go) — i costi reali rimangono molto bassi anche con migliaia di utenti.
