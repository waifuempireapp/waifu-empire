/**
 * @module multiplayerService
 * @description Barrel export di multiplayerService.
 *
 * Mantiene la retrocompatibilità con tutti i componenti che importano da
 * '@/lib/multiplayerService' (o './multiplayerService').
 * Nessuna funzione è rimossa o rinominata — tutti gli export originali sono
 * accessibili da questo file senza modificare i componenti esistenti.
 *
 * Le implementazioni sono ora divise per dominio in:
 *   - @/lib/multiplayer/gameService   (lobby, ciclo di vita partita, salvataggio)
 *   - @/lib/multiplayer/battleService (battaglie, territori, round PvP, seed RNG)
 *   - @/lib/multiplayer/arenaService  (arena PvP waifu-battle real-time, picks)
 *
 * Principio SOLID applicato: SRP (Single Responsibility Principle)
 *   Il file originale aveva 27 funzioni con 3 responsabilità distinte mescolate.
 *   Lo split separa: gestione partita / logica di battaglia / arena PvP.
 *   Questo barrel garantisce OCP (Open/Closed): i componenti esistenti non devono
 *   essere modificati, ma si possono aggiungere nuovi import dai sotto-moduli.
 */

export * from './multiplayer/gameService';
export * from './multiplayer/battleService';
export * from './multiplayer/arenaService';
