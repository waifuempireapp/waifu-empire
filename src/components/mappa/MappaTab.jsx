'use client';

/**
 * @module MappaTab
 * @description Sezione "Mappa" del gioco: gestisce la selezione territori,
 * il flusso di battaglia vs CPU, la pick phase e la navigazione multiplayer.
 *
 * Principio SRP: questo componente gestisce SOLO la sezione Mappa.
 * La logica di battaglia è delegata a WaifuBattleArena e PickPhase.
 * La visualizzazione SVG è delegata a MappaMondoArt (tramite MappaScrollabile).
 *
 * NOTA DI ARCHITETTURA — estrazione parziale:
 *   MappaTab dipende da RoundEndBar, SelezioneWaifuTeam, BarraFiltriWaifu,
 *   TradeCountdownInline e SortChip, che sono tutti definiti in page.jsx e
 *   non ancora estratti in moduli separati. Estrarre MappaTab in questo file
 *   richiederebbe spostare anche quei componenti, operazione da fare in una
 *   iterazione dedicata per evitare regressioni.
 *
 *   Per ora questo file serve da punto di documentazione e segnaposto:
 *   il corpo effettivo di MappaTab rimane in src/app/gioco/page.jsx.
 *   Quando i componenti dipendenti saranno estratti, importarli qui e
 *   spostare il corpo della funzione in questo modulo.
 *
 * Dipendenze interne da estrarre prima del completamento:
 *   - RoundEndBar         (src/app/gioco/page.jsx:5361)
 *   - SelezioneWaifuTeam  (src/app/gioco/page.jsx:5517)
 *   - BarraFiltriWaifu    (src/app/gioco/page.jsx:5429)
 *   - TradeCountdownInline (src/app/gioco/page.jsx:5396)
 *   - SortChip            (src/app/gioco/page.jsx:5416)
 *
 * Dipendenze esterne già disponibili:
 *   - @/components/MappaMondoArt
 *   - @/components/MappaMultiplayer
 *   - @/components/WaifuBattleArena
 *   - @/components/PickPhase
 *   - @/components/mappa/MappaScrollabile  ← estratto in questo refactoring
 *   - @/lib/battleEngine (generateCPUTeamOf5)
 *   - @/lib/gameLogic (applicaAbilitaOutfit, applicaModificatoriOpp)
 *   - @/lib/firestoreService (updateUserProfile)
 *   - @/lib/constants (TERRITORI, NOMI_CONTINENTI, STAT_RANGES_DEFAULT)
 *   - @/components/ui/UIKit (PannelloOrnato, TitoloOrnato, BtnDecorato, Chip)
 *
 * @param {Object}   props
 * @param {Object}   props.profilo        — Profilo Firestore del giocatore (nomeImpero, energia ecc.).
 * @param {Function} props.setProfilo     — Setter per aggiornare il profilo localmente.
 * @param {Object}   props.collezione     — Collezione waifu del giocatore.
 * @param {Array}    props.waifuCat       — Catalogo globale di tutte le waifu.
 * @param {Array}    props.outfitCat      — Catalogo globale degli outfit.
 * @param {Object}   props.user           — Utente Firebase autenticato.
 * @param {Function} props.mostraNotif    — Callback per mostrare notifiche toastate.
 */

// TODO: quando RoundEndBar, SelezioneWaifuTeam, BarraFiltriWaifu, TradeCountdownInline
//       e SortChip saranno estratti dai rispettivi moduli, spostare qui il corpo
//       di MappaTab da src/app/gioco/page.jsx e aggiungere l'export default.
//
// export { default } from '@/app/gioco/_components/MappaTab';  // futuro percorso
