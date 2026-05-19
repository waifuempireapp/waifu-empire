## ADDED Requirements

### Requirement: Chiusura classifica manuale con upgrade rarità
Il sistema SHALL permettere all'Admin di chiudere manualmente la classifica Swap tramite un pulsante dedicato nel pannello Admin. La chiusura SHALL eseguire in sequenza: (1) lettura top 5 waifu per voti, (2) upgrade rarità +1 step per ogni waifu top-5, (3) ricalcolo velocita/crit_chance per tutte le copie utenti delle waifu interessate, (4) reset voti, (5) salvataggio log operazione. La chiusura NON SHALL essere automatica (nessun cron job).

La tabella di upgrade rarità:
- `comune` → `raro`
- `raro` → `epico`
- `epico` → `leggendario`
- `leggendario` → `immersivo` (con `asset_video` = null, da caricare separatamente)
- `immersivo` (soft) → `immersivo` con `asset_video_hard` = null (Immersiva Hard, da caricare)
- `immersivo` con `asset_video_hard` già presente → nessun upgrade (cap massimo, non partecipa alla classifica)

#### Scenario: Chiusura classifica con top 5 valide
- **WHEN** l'Admin preme "Chiudi Classifica & Upgrade Rarità" e conferma la modale
- **THEN** il sistema SHALL eseguire gli step 1-5 in sequenza, mostrare un loader durante l'operazione e al termine mostrare un riepilogo delle 5 waifu upgraddate con la nuova rarità

#### Scenario: Upgrade rarità di una waifu top-5
- **WHEN** durante la chiusura classifica, una waifu top-5 ha rarità `raro`
- **THEN** il sistema SHALL aggiornare `catalogo_waifu/{waifuId}.rarita = 'epico'`, ricalcolare `velocita_base`/`crit_chance_base` con il moltiplicatore `epico` (1.00), e aggiornare `velocita`/`crit_chance` in tutte le copie utenti che possiedono quella waifu

#### Scenario: Waifu immersiva hard non partecipa alla classifica
- **WHEN** viene caricato il pool di waifu per il Waifu Swap
- **THEN** le waifu con `rarita = 'immersivo'` E `asset_video_hard` non null SHALL essere escluse dal pool di voto e dalla classifica

#### Scenario: Reset voti dopo chiusura
- **WHEN** la chiusura classifica viene completata con successo
- **THEN** il sistema SHALL aggiornare `swap_config/main.classifica_reset_at = serverTimestamp()` e il sistema di classifica SHALL utilizzare solo i voti ricevuti dopo questo timestamp

#### Scenario: Classifica insufficiente (meno di 5 waifu)
- **WHEN** la classifica ha meno di 5 waifu con voti > 0
- **THEN** il sistema SHALL upgradare solo le waifu con voti > 0 (anche se meno di 5) e procedere normalmente

### Requirement: Log operazione chiusura classifica
Il sistema SHALL salvare un log dell'operazione di chiusura in `admin_logs/swap_closure_{timestamp}` contenente: timestamp, uid admin, lista delle 5 waifu con rarità prima/dopo upgrade, totale utenti aggiornati.

#### Scenario: Salvataggio log
- **WHEN** la chiusura classifica viene completata (successo o errore parziale)
- **THEN** il sistema SHALL salvare il documento di log con tutti i dettagli dell'operazione e mostrarlo all'Admin nella cronologia operazioni

### Requirement: Criteri di ordinamento classifica con parità
Il sistema SHALL ordinare la classifica per voti totali decrescenti. In caso di parità, SHALL applicare in ordine: (1) rarità più alta, (2) espansione più vecchia (numero espansione minore), (3) ordine alfabetico per nome waifu.

#### Scenario: Parità di voti — criteri di tiebreak
- **WHEN** due waifu hanno lo stesso numero di voti totali
- **THEN** il sistema SHALL posizionare prima quella con rarità più alta; se anche la rarità è uguale, quella dell'espansione con `espansione_id` più basso; se anche questo è uguale, in ordine alfabetico per `nome`
