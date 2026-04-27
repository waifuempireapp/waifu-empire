# 👑 Impero delle Waifu

Web app gacha + Risiko in stile Genshin Impact / Pokémon Pocket.

## ⚡ Quick Start

```bash
# 1. Installa dipendenze
npm install

# 2. Crea .env.local con i tuoi valori Firebase (vedi .env.example)
cp .env.example .env.local
# poi modifica .env.local con le tue credenziali

# 3. Avvia in locale
npm run dev

# 4. Apri http://localhost:3000
```

## 📁 Struttura del progetto

```
impero-waifu/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.jsx          # Layout root con AuthProvider
│   │   ├── page.jsx            # Redirect home → login/gioco
│   │   ├── login/              # Login (Google + email)
│   │   ├── onboarding/         # Setup nuovo utente + 5 pacchetti benvenuto
│   │   ├── gioco/              # Hub principale (home, sbusta, collezione, mappa)
│   │   └── admin/              # Area admin completa
│   │       └── page.jsx        # Gestione drop, waifu, outfit, pose
│   ├── components/
│   │   ├── PaperDoll.jsx       # Paper-doll SVG layered (con asset support)
│   │   └── CartaWaifu.jsx      # Carte: statica + immersiva + outfit + posa
│   ├── lib/
│   │   ├── firebase.js         # Client config Firebase
│   │   ├── firebaseAdmin.js    # Admin SDK (server-side)
│   │   ├── AuthContext.jsx     # React Context per auth
│   │   ├── constants.js        # RARITA, COLORI, TERRITORI, etc.
│   │   ├── gameLogic.js        # Sbustamento, ricariche, level up
│   │   ├── promptGenerator.js  # ⭐ Generatore prompt AI strutturati
│   │   ├── firestoreService.js # CRUD Firestore
│   │   └── storageService.js   # Upload Firebase Storage
│   └── data/                   # Dati seed (opzionale)
├── public/
├── firestore.rules             # Regole sicurezza Firestore
├── storage.rules               # Regole sicurezza Storage
├── firebase.json               # Config Firebase CLI
├── DEPLOY.md                   # 🚀 Guida deploy passo-passo
├── BRIEF_GRAFICO.md            # 🎨 Brief per illustratore (template)
└── package.json
```

## 🎯 Funzionalità

### Per il giocatore
- ✅ Login Google + email/password
- ✅ Onboarding con scelta nome impero e bandiera
- ✅ 5 pacchetti di benvenuto (senza doppioni di waifu)
- ✅ Apertura pacchetti (2 waifu + 2 outfit + 1 posa)
- ✅ Sistema rarità a 5 livelli (comune → immersivo)
- ✅ Collezione persistente con paper-doll modificabile
- ✅ Equipaggiamento outfit (4 slot) + pose specifiche
- ✅ Level up a 3 copie (+1 stat a scelta)
- ✅ Scarto outfit/pose per energia
- ✅ Energia 10/giorno, 2 pacchetti max, ricarica 12h
- ✅ Mappa mondo con 28 territori e 6 continenti
- ✅ Battaglie 1v1 a carte (5 stat)
- ✅ Carte statiche + carte immersive (Pokémon Pocket style)
- ✅ Mobile + desktop responsive

### Per l'admin (te)
- ✅ **Drop stagionali**: crea/modifica/attiva drop tematici
- ✅ **Generazione prompt AI** strutturati per ogni waifu (3 varianti)
- ✅ **Generazione prompt** per outfit e pose
- ✅ **Upload diretto** asset generati su Firebase Storage
- ✅ **Download** asset originali per passarli al grafico
- ✅ **Anti-ripetizione**: monitor archetipi/palette per drop
- ✅ **20 archetipi** + **10 palette** predefinite per diversificazione
- ✅ Link diretti ai motori AI consigliati (ComfyUI, A1111, NovelAI, Tensor.art)

## 🚀 Deploy in produzione

Vedi **DEPLOY.md** per la guida passo-passo (Firebase + Vercel + GitHub).

## 🎨 Asset grafici

Il sistema funziona con placeholder SVG senza asset, ma dà il massimo con immagini AI.

Vedi **BRIEF_GRAFICO.md** per:
- Specifiche tecniche di ogni asset (dimensioni, formato, sfondo)
- Workflow consigliato (ComfyUI + Animagine XL 4.0)
- Template per brief al grafico

## 🔧 Stack tecnico

- **Framework**: Next.js 14 (App Router)
- **Backend**: Firebase (Auth + Firestore + Storage)
- **Hosting**: Vercel
- **Lingua**: Italiano
- **Styling**: CSS-in-JS inline (zero dipendenze CSS extra)
- **Font**: Cinzel + Inter (Google Fonts)

## 📝 Note

- Tutti i contenuti sensibili (descrizioni outfit, livello fanservice) sono compilati dall'admin tramite "filler" — il sistema fornisce solo le parti tecniche neutre dei prompt.
- Età minima delle waifu: 18 anni (vincolato a livello di prompt e validazione).
- Le carte immersive si attivano automaticamente per waifu di rarità leggendaria/immersiva con asset dedicato.
