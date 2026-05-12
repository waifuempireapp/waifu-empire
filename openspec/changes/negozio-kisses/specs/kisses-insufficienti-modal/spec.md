## ADDED Requirements

### Requirement: Modale Kisses insufficienti riutilizzabile
Il componente `KissesShortageModal` SHALL poter essere invocato da qualsiasi flusso che richieda Kisses (apertura pack sfida, ricarica energia, acquisto passHard, pesca misteriosa). Il modale MUST ricevere: `missingKisses` (quanti ne mancano), `onSuccess(newKisses)` (callback dopo acquisto), `onCancel` (callback per annullare).

#### Scenario: Modale mostra il deficit e suggerisce il taglio minimo
- **WHEN** il modale viene aperto con `missingKisses = 30`
- **THEN** mostra quanti Kisses mancano e pre-seleziona il taglio con il minor numero di Kisses che copra il deficit

#### Scenario: Acquisto Kisses inline dal modale
- **WHEN** l'utente seleziona un taglio e completa il pagamento PayPal nel modale
- **THEN** i Kisses vengono accreditati e `onSuccess(newKisses)` viene chiamato con il nuovo saldo; il flusso originale può riprendere

#### Scenario: Annullamento dal modale
- **WHEN** l'utente clicca "Annulla" nel modale
- **THEN** `onCancel()` viene chiamato, il modale si chiude, il flusso originale viene abbandonato senza modifiche al saldo

### Requirement: Ripresa automatica del flusso dopo acquisto Kisses
Se il modale `KissesShortageModal` viene aperto da un flusso specifico (es. apertura pack sfida), dopo il pagamento riuscito il sistema MUST riprendere automaticamente l'operazione originale con il nuovo saldo aggiornato, senza richiedere all'utente di ripetere manualmente il click.

#### Scenario: Pack sfida acquistato automaticamente dopo Kisses
- **WHEN** l'utente tenta di comprare un pack sfida con Kisses insufficienti, acquista Kisses dal modale, e il pagamento va a buon fine
- **THEN** il sistema scala automaticamente i Kisses per il pack sfida e lo aggiunge al profilo, senza che l'utente debba ri-premere "Acquista"
