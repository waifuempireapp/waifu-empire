## Why

La sezione Sbusta attuale è funzionale ma visivamente datata: le carte vengono rivelate con un semplice click una alla volta senza un'esperienza di apertura pack coinvolgente. Il rework porta un'esperienza premium in 3 fasi distinte (selezione → apertura animata → rivelazione sequenziale), allineata al design di riferimento in `reference/`.

## What Changes

- **Schermata 1 — Selezione Pack**: nuovo layout con card pack prominente (nome drop, arte generativa, probabilità rarità, countdown omaggio), pulsanti ×1 e ×10
- **Schermata 2 — Apertura Animata**: singolo tap sul pack → animazione di apertura (burst di luce, particelle, shake) con aspetto dorato/holo per Waifu Pack; transizione automatica alla rivelazione
- **Schermata 3 — Rivelazione sequenziale**: le 5 carte si rivelano automaticamente una alla volta con stagger, partendo dall'ultima (rarità più bassa) e terminando con la prima (rarità più alta, card grande); banner HOT e NEW preservati
- **Flusso ×10**: 10 pack sequenziali — dopo ogni set di 5 carte appare pulsante "Prossimo pack (N/10)" per continuare; alla fine riepilogo totale
- **Waifu Pack**: aspetto dorato/holo nella schermata selezione e nell'animazione apertura; logica esistente preservata
- **Banner HOT**: visibile nella rivelazione solo per utenti con `hardPass: true`; logica corrente preservata
- **Banner NEW**: visibile su carte aggiunte di recente al catalogo; logica corrente preservata
- Rimozione stili inline → classi CSS in `globals.css` (pattern come homepage-rework)

## Capabilities

### New Capabilities

- `sbusta-selection-screen`: schermata selezione pack con info drop, odds, countdown e CTA
- `sbusta-pack-opening`: animazione apertura pack (tap to open, holo per Waifu Pack)
- `sbusta-card-revelation`: rivelazione sequenziale automatica con carta grande per rarità massima
- `sbusta-bulk-open`: flusso per apertura 10 pack sequenziali

### Modified Capabilities

- `pack-snapshot`: la logica di creazione snapshot pack rimane invariata; cambia solo la presentazione

## Impact

- `src/app/gioco/page.jsx`: `SbustaTab` sostituita con 3 sub-componenti (SelectionScreen, PackOpeningScreen, RevelationScreen)
- `src/app/globals.css`: nuove classi `sb-*` per tutti i componenti sbusta
- Logica esistente (god pack, waifu pack detection, HOT/NEW banner, Firestore writes) rimane nel componente, solo la UI cambia
