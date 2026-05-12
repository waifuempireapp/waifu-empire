## Why

I Kisses sono la valuta in-game ma non hanno ancora valore economico né utilità al di là della Pesca Misteriosa. Questo blocca la monetizzazione e limita il loop di gioco. Introdurre un Negozio che permette di spendere Kisses per beni di gioco (pack, energia, passHard) e di ricaricare i Kisses con euro completa la catena economica: guadagno → spesa → ricarica.

## What Changes

- **Acquisto con Kisses**: pacchetti sfida, energia e passHard diventano acquistabili spendendo Kisses a prezzi configurati.
- **Sezione Negozio**: nuova sezione dell'app accessibile dalla homepage con un bottone dedicato. Al click naviga a una pagina/tab di dettaglio dedicata (non si espande in-homepage come la Pesca Misteriosa).
- **Pacchetti Kisses in vendita**: nel Negozio sono disponibili 4 tagli di Kisses acquistabili con euro tramite PayPal (lo stesso gateway già integrato per il passHard).
- **Modale Kisses insufficienti**: quando un utente tenta un acquisto con Kisses e non ne ha abbastanza, compare un modale inline che propone immediatamente l'acquisto dei Kisses senza uscire dal flusso. L'utente sceglie se acquistare o annullare.
- **API backend**: nuove route per (a) creare ordini PayPal con amount variabile per taglio Kisses e (b) assegnare i Kisses acquistati dopo la verifica del pagamento.

## Capabilities

### New Capabilities

- `negozio`: Sezione Negozio della homepage — mostra i prezzi Kisses dei beni di gioco e i tagli di Kisses acquistabili con euro; gestisce il flusso di pagamento PayPal per i Kisses.
- `acquisto-kisses-paypal`: Backend — API per creare ordini PayPal con amount variabile in base al taglio selezionato e assegnare Kisses dopo la cattura del pagamento.
- `kisses-insufficienti-modal`: Componente modale riutilizzabile che appare in-context quando il saldo Kisses è insufficiente, propone il taglio minimo necessario e avvia il flusso PayPal inline senza navigare fuori dalla sezione corrente.

### Modified Capabilities

- `kisses-currency`: aggiunta dei requisiti di acquisto beni con Kisses (pack sfida, energia, passHard) e del comportamento quando il saldo è insufficiente.

## Impact

- **Backend**: nuove route `/api/paypal/create-order-kisses` e `/api/paypal/capture-order-kisses` (variante di quelle esistenti con amount variabile e logica di assegnazione Kisses).
- **Frontend**: bottone Negozio in HomeTab, pagina/tab `NegozioPage` con prezzi e PayPal buttons per i 4 tagli Kisses, modale `KissesInsufficientModal` riutilizzabile.
- **Firestore**: nessuna nuova collection — i Kisses vengono aggiornati su `users/{uid}.kisses` con la funzione `awardKisses` esistente.
- **Dipendenze**: PayPal JS SDK già presente; nessuna nuova dipendenza.
- **Config Kisses prezzi**: i prezzi in Kisses dei beni di gioco e i 4 tagli euro→Kisses saranno configurabili in `config/negozio_settings` Firestore.
