/**
 * MappaMultiplayer — punto d'ingresso e orchestratore della sezione Multiplayer.
 *
 * Architettura (principi SOLID applicati):
 *  - SRP : ogni sub-componente ha una sola responsabilità
 *           (Menu, Lobby, CreaPartita, UniscitiPartita, CaricaPartita
 *            sono estratti in src/components/multiplayer/).
 *  - OCP : nuove viste si aggiungono senza toccare il router interno (switch su `vista`).
 *  - LSP : tutti i sub-componenti rispettano il contratto di callback (onCreata/onUnito/…).
 *  - ISP : ogni componente riceve solo le prop di cui ha bisogno.
 *  - DIP : la logica Firebase è importata da @/lib/multiplayerService,
 *           non accoppiata alle UI.
 *
 * Rimangono in questo file:
 *  - MappaMultiplayer (default export) — router di viste + gestione listener
 *  - SchermataPartita — troppo interdipendente con le prop per essere spostato ora
 *  - BattagliaMultiplayer — idem (contiene tutto il motore PvP/CPU)
 *  - Componenti interni di supporto: CartaTerritorio, MappaScrollabileMulti,
 *    RoundEndBarMulti, PopupGameEnd, SpettatoreView
 */
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  avviaPartitaMultiplayer,
  ascoltaPartita, scegliAttacco,
  registraRisultatoBattaglia, salvaPartitaConNome, setGiocatoreInLobby,
  salvaMazzoBattaglia, salvaRoster5Battaglia,
  salvaSceltaPvpRound, salvaPrimoTurnoPvp,
  salvaProseguiTurnoRound, registraRisultatoBattagliaPvp,
  salvaRisultatoPvpRound,
  salvaArenaMove, inizializzaArena,
  inizializzaArenaSeedRng,
} from '@/lib/multiplayerService';
import { resolvePvPTurn } from '@/lib/pvpArenaEngine';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import PickPhase from '@/components/PickPhase'; // [WAIFU CHAMPIONS REFACTOR]
import { initBattleWaifu, generateCPUTeam } from '@/lib/battleEngine';
import { TERRITORI, NOMI_CONTINENTI, STAT_RANGES_DEFAULT } from '@/lib/constants';
import { applicaAbilitaOutfit, applicaModificatoriOpp } from '@/lib/gameLogic';
import { updateUserProfile } from '@/lib/firestoreService';
import MappaMondoArt from '@/components/MappaMondoArt';
import { CartaWaifu } from '@/components/CartaWaifu';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
} from '@/components/ui/UIKit';

// ── Sub-componenti estratti (src/components/multiplayer/) ─────────────
import MenuMultiplayer    from './multiplayer/MenuMultiplayer';
import CreaPartita        from './multiplayer/CreaPartita';
import UniscitiPartita    from './multiplayer/UniscitiPartita';
import CaricaPartita      from './multiplayer/CaricaPartita';
import Lobby              from './multiplayer/Lobby';
import ModaleNomePartita  from './multiplayer/ModaleNomePartita';
// Stili condivisi (usati dai componenti interni rimasti in questo file)
import { btnStyle, inputStyle, labelStyle } from './multiplayer/sharedStyles';


// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE — router di viste + gestione listener
// ════════════════════════════════════════════════════════════════════

/**
 * Orchestratore della sezione Multiplayer.
 * Gestisce il routing tra le viste (menu/crea/unisciti/carica/lobby/partita)
 * e il ciclo di vita del listener Firestore.
 *
 * @param {Object}   props
 * @param {Object}   props.profilo           - Profilo utente corrente.
 * @param {Object}   props.user              - Oggetto Firebase Auth.
 * @param {Object}   props.collezione        - Collezione del giocatore.
 * @param {Object[]} props.waifuCat          - Catalogo waifu.
 * @param {Object[]} props.outfitCat         - Catalogo outfit.
 * @param {Function} props.mostraNotif       - Callback notifiche UI.
 * @param {Function} props.onEsci            - Esce dalla sezione multiplayer.
 * @param {string}   [props.vistaIniziale]   - Vista da mostrare all'avvio (default: 'menu').
 */
export default function MappaMultiplayer({
  profilo, user, collezione, waifuCat, outfitCat,
  mostraNotif, onEsci, vistaIniziale = 'menu',
}) {
  // Vista corrente: 'menu' | 'crea' | 'unisciti' | 'carica' | 'lobby' | 'partita'
  const [vista, setVista] = useState(vistaIniziale);
  const [partita, setPartita] = useState(null);
  const [codicePartita, setCodicePartita] = useState('');
  // Modale nome partita: { aperto, onConferma }
  const [modaleNome, setModaleNome] = useState({ aperto: false, onConferma: null });
  // useRef per il listener: evita problemi con setState che chiama la funzione come updater
  const unsubscribeRef = useRef(null);
  // Ref per accedere a partita/codice nei callback senza stale closure
  const partitaRef = useRef(null);
  const codiceRef = useRef('');
  useEffect(() => { partitaRef.current = partita; }, [partita]);
  useEffect(() => { codiceRef.current = codicePartita; }, [codicePartita]);

  // Cleanup al unmount — auto-save silenzioso senza nome
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      // Auto-save al dismount (es. navigazione fuori dal tab) senza bloccare il render
      const p = partitaRef.current;
      const c = codiceRef.current;
      if (p?.codice && p.stato !== 'terminata') {
        salvaPartitaConNome(c, user.uid, p.nomiPartita?.[user.uid] || p.codice).catch(() => {});
        setGiocatoreInLobby(c, user.uid, false).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sanitizza i dati Firestore: converte Timestamp in millisecondi (numeri serializzabili)
  const sanitizzaPartita = useCallback((p) => {
    if (!p) return p;
    const conv = (v) => {
      if (v && typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis();
      if (v && typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
      return v;
    };
    return { ...p, creato: conv(p.creato), aggiornato: conv(p.aggiornato) };
  }, []);

  // Avvia listener realtime.
  const avviaListener = useCallback((codice) => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    const unsub = ascoltaPartita(codice, (p) => {
      if (p) setTimeout(() => setPartita(sanitizzaPartita(p)), 0);
    });
    unsubscribeRef.current = unsub;
  }, [sanitizzaPartita]);

  // Quando il listener riceve partita.stato === 'in_gioco' e il giocatore
  // è ancora in lobby, passa automaticamente alla schermata di gioco.
  useEffect(() => {
    if (vista === 'lobby' && partita?.stato === 'in_gioco') {
      setGiocatoreInLobby(partita.codice, user.uid, true).catch(() => {});
      setVista('partita');
    }
  }, [partita?.stato, vista]);

  // ── Salvataggio con modale nome ───────────────────────────────────
  // Apre il modale, chiede il nome, poi esegue il salvataggio e chiama il callback.
  const richiediNomeESalva = useCallback((codice, nomeDefault, onDopo) => {
    setModaleNome({
      aperto: true,
      nomeDefault,
      onConferma: async (nome) => {
        setModaleNome({ aperto: false, onConferma: null });
        try {
          await salvaPartitaConNome(codice, user.uid, nome);
          await setGiocatoreInLobby(codice, user.uid, false);
        } catch (e) { /* non bloccare l'uscita */ }
        if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
        onDopo();
      },
      onAnnulla: () => setModaleNome({ aperto: false, onConferma: null }),
    });
  }, [user.uid]);

  const handleEsciESalva = useCallback(() => {
    const p = partitaRef.current;
    const c = codiceRef.current;
    if (c && p?.stato !== 'terminata') {
      const nomeDefault = p?.nomiPartita?.[user.uid] || c;
      richiediNomeESalva(c, nomeDefault, onEsci);
    } else {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
      onEsci();
    }
  }, [richiediNomeESalva, onEsci, user.uid]);

  // ── Render viste ──────────────────────────────────────────────────
  return (
    <>
      {/* Modale nome partita — sovrapposto a tutto */}
      {modaleNome.aperto && (
        <ModaleNomePartita
          nomeDefault={modaleNome.nomeDefault || ''}
          onConferma={modaleNome.onConferma}
          onAnnulla={modaleNome.onAnnulla}
        />
      )}

      {vista === 'menu' && (
        <MenuMultiplayer
          onCrea={() => setVista('crea')}
          onUnisciti={() => setVista('unisciti')}
          onCarica={() => setVista('carica')}
          onIndietro={onEsci}
        />
      )}

      {vista === 'crea' && (
        <CreaPartita
          profilo={profilo}
          user={user}
          onCreata={async ({ codice }) => {
            setCodicePartita(codice);
            avviaListener(codice);
            setVista('lobby');
          }}
          onAnnulla={() => setVista('menu')}
        />
      )}

      {vista === 'unisciti' && (
        <UniscitiPartita
          profilo={profilo}
          user={user}
          onUnito={async ({ codice }) => {
            setCodicePartita(codice);
            avviaListener(codice);
            setVista('lobby');
          }}
          onAnnulla={() => setVista('menu')}
        />
      )}

      {vista === 'carica' && (
        <CaricaPartita
          user={user}
          onCaricata={async (p) => {
            setPartita(p);
            setCodicePartita(p.codice);
            avviaListener(p.codice);
            if (p.stato === 'in_gioco') {
              await setGiocatoreInLobby(p.codice, user.uid, true);
              setVista('partita');
            } else {
              setVista('lobby');
            }
          }}
          onAnnulla={() => setVista('menu')}
        />
      )}

      {vista === 'lobby' && (
        <Lobby
          partita={partita}
          codice={codicePartita}
          user={user}
          onAvvia={async () => {
            try {
              await avviaPartitaMultiplayer(codicePartita);
              await setGiocatoreInLobby(codicePartita, user.uid, true);
              setVista('partita');
            } catch (e) { mostraNotif(e.message, '#ff3d3d'); }
          }}
          onEsci={handleEsciESalva}
          mostraNotif={mostraNotif}
        />
      )}

      {vista === 'partita' && (
        <SchermataPartita
          partita={partita}
          codice={codicePartita}
          user={user}
          profilo={profilo}
          collezione={collezione}
          waifuCat={waifuCat}
          outfitCat={outfitCat}
          mostraNotif={mostraNotif}
          onEsciEsalva={handleEsciESalva}
          onAggiornata={setPartita}
        />
      )}
    </>
  );
}

// (sub-componenti estratti — ora importati da ./multiplayer/)

// ════════════════════════════════════════════════════════════════════
// SCHERMATA PARTITA
// Gestisce la vista della mappa durante una partita in corso.
// Rimane in questo file perché è fortemente interdipendente con
// BattagliaMultiplayer e con le funzioni Firebase del padre.
// ════════════════════════════════════════════════════════════════════

/**
 * Vista principale della partita in corso (mappa + turni + log).
 *
 * @param {Object}   props
 * @param {Object|null} props.partita       - Documento partita (aggiornato in real-time dal listener).
 * @param {string}   props.codice           - Codice partita a 6 caratteri.
 * @param {Object}   props.user             - Oggetto Firebase Auth (uid).
 * @param {Object}   props.profilo          - Profilo utente corrente.
 * @param {Object}   props.collezione       - Collezione waifu/team/equipaggiamento del giocatore.
 * @param {Object[]} props.waifuCat         - Catalogo waifu completo.
 * @param {Object[]} props.outfitCat        - Catalogo outfit/abilità.
 * @param {Function} props.mostraNotif      - Mostra una notifica temporanea.
 * @param {Function} props.onEsciEsalva     - Esce dalla partita con salvataggio.
 * @param {Function} props.onAggiornata     - Notifica il padre di un aggiornamento locale della partita.
 */
function SchermataPartita({
  partita, codice, user, profilo, collezione, waifuCat, outfitCat,
  mostraNotif, onEsciEsalva, onAggiornata,
}) {
  const [terrSel, setTerrSel] = useState(null);
  const [vistaAttiva, setVistaAttiva] = useState('mappa'); // 'mappa' | 'battaglia' | 'fine'
  const [battagliaInfo, setBattagliaInfo] = useState(null);
  const [teamSelezionato, setTeamSelezionato] = useState(null);
  const [waifuSelezionate, setWaifuSelezionate] = useState([]);
  // Scelta spettatore: null = non ancora scelto, 'aspetta' | 'guarda'
  const [sceltaSpettatore, setSceltaSpettatore] = useState(null);

  // NOTA: questo useEffect deve stare PRIMA di qualsiasi early return
  // per rispettare la regola dei hook (stesso numero di hook per ogni render).
  const _ordine = partita?.ordineGiocatori || [];
  const _turnoUid = _ordine[partita?.turnoCorrente ?? 0];
  const _isMioTurno = _turnoUid === user?.uid;
  useEffect(() => {
    if (!_isMioTurno) setTerrSel(null);
  }, [_isMioTurno]);

  // Reset scelta spettatore quando la battaglia finisce
  const _battagliaCorrente = partita?.battagliaCorrente;
  useEffect(() => {
    if (!_battagliaCorrente) setSceltaSpettatore(null);
  }, [_battagliaCorrente]);

  if (!partita) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>
          Caricamento partita…
        </div>
      </div>
    );
  }

  const mappaTerritori = partita.mappaTerritori || {};
  const giocatori = partita.giocatori || {};
  const myUid = user.uid;
  const myGiocatore = giocatori[myUid];
  const ordine = partita.ordineGiocatori || [];
  const turnoUid = ordine[partita.turnoCorrente ?? 0];
  const isMioTurno = turnoUid === myUid;
  const sonoEliminato = myGiocatore?.eliminato;
  const giocatoriAttivi = Object.values(giocatori).filter(g => g.uid !== 'cpu' && !g.eliminato);

  // Partita terminata
  if (partita.stato === 'terminata') {
    const vincitore = giocatori[partita.vincitore];
    const hoVinto = partita.vincitore === myUid;
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{
          background: 'rgba(10,7,38,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${hoVinto ? 'rgba(245,197,96,0.5)' : 'rgba(255,133,182,0.35)'}`,
          borderRadius: 20,
          padding: 36,
          textAlign: 'center',
          maxWidth: 360,
          boxShadow: hoVinto ? '0 0 40px rgba(245,197,96,0.15)' : '0 0 40px rgba(255,133,182,0.1)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{hoVinto ? '👑' : '💔'}</div>
          <div style={{
            fontFamily: "'Unbounded', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: hoVinto ? '#f5c560' : '#ff85b6',
            letterSpacing: 2,
            marginBottom: 8,
          }}>
            {hoVinto ? 'HAI VINTO!' : 'PARTITA FINITA'}
          </div>
          {vincitore && (
            <div style={{ fontSize: 12, color: vincitore.coloreImpero, fontFamily: 'Orbitron', marginBottom: 20 }}>
              🏆 {vincitore.nomeImpero} ha conquistato il mondo!
            </div>
          )}
          <button onClick={onEsciEsalva} style={{
            padding: '12px 24px',
            background: 'linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))',
            border: '0.8px solid rgba(255,233,168,0.6)',
            borderRadius: 12,
            cursor: 'pointer',
            color: 'rgb(42,31,0)',
            fontFamily: "'Saira Condensed', Saira, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
            boxShadow: 'rgba(245,197,96,0.35) 0px 6px 20px 0px',
          }}>TORNA AL MENU</button>
        </div>
      </div>
    );
  }

  // Verifica presenza per riprendere dopo disconnessione.
  // REGOLE:
  // - I combattenti (attaccante/difensore) NON vedono mai la schermata "In attesa":
  //   se sono tornati online è perché hanno caricato la partita e possono giocare subito.
  // - Il giocatore del turno corrente non blocca la partita per gli altri:
  //   gli spettatori vedono la mappa normalmente.
  // - Nessuno schermo d'attesa per i non-coinvolti (spettatori in partite 3+).
  const battaglia = partita.battagliaCorrente;
  const sonoCoinvolto = battaglia && (battaglia.attaccanteUid === myUid || battaglia.difensoreUid === myUid);
  const sonoAttaccante = battaglia?.attaccanteUid === myUid;
  const sonoDifensore = battaglia?.difensoreUid === myUid;

  // Se c'è una battaglia PvP e NON sono coinvolto: mostro solo che è in corso ma non blocco
  // Se sono coinvolto: vado direttamente alla battaglia (nessun check presenza)
  // Fuori dalla battaglia: nessuna schermata d'attesa — il giocatore del turno agirà quando torna

  if (battaglia && battaglia.statoFase === 'in_attesa' && (sonoAttaccante || (sonoDifensore && battaglia.difensoreUid !== 'cpu'))) {
    // Avvia battaglia locale
    return (
      <BattagliaMultiplayer
        partita={partita}
        codice={codice}
        user={user}
        profilo={profilo}
        collezione={collezione}
        waifuCat={waifuCat}
        outfitCat={outfitCat}
        sonoAttaccante={sonoAttaccante}
        onBattagliaFinita={async (vincitoreUid) => {
          const isBattagliaPvp = battaglia.difensoreUid !== 'cpu';
          if (isBattagliaPvp) {
            // PvP: usa registraRisultatoBattagliaPvp (no energia persa, territori marcati pvp)
            await registraRisultatoBattagliaPvp({ codice, vincitoreUid, territorioId: battaglia.territorioId });
            // Il vincitore ottiene un pacchetto sfida (solo se sono io il vincitore)
            if (vincitoreUid === myUid) {
              try {
                const profCorrente = profilo;
                const nuoviPacchettiSfida = (profCorrente?.pacchettiSfida ?? 0) + 1;
                const nuoveVittorie = (profCorrente?.vittoriePvp ?? 0) + 1;
                await updateUserProfile(myUid, { pacchettiSfida: nuoviPacchettiSfida, vittoriePvp: nuoveVittorie });
              } catch (e) {
                // Errore non bloccante
              }
            }
          } else {
            await registraRisultatoBattaglia({ codice, vincitoreUid, territorioId: battaglia.territorioId });
          }
        }}
        mostraNotif={mostraNotif}
      />
    );
  }

  // ── Spettatore: battaglia in corso ma non sono coinvolto ──────────
  if (battaglia && !sonoCoinvolto) {
    const attUid = battaglia.attaccanteUid;
    const difUid = battaglia.difensoreUid;
    const gAtt = giocatori[attUid];
    const gDif = difUid === 'cpu' ? { nomeImpero: 'CPU', coloreImpero: '#666666' } : giocatori[difUid];

    if (sceltaSpettatore === null) {
      // Mostra scelta: aspetta o guarda
      return (
        <div className="fade-in">
          <div style={{
            background: 'rgba(255,133,182,0.06)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '0.8px solid rgba(255,133,182,0.25)',
            borderRadius: 20,
            padding: 28,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚔️</div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 700, color: '#ff85b6', marginBottom: 8 }}>SFIDA IN CORSO</div>
            <div style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", marginBottom: 6, marginTop: 4 }}>
              <span style={{ color: gAtt?.coloreImpero }}>{gAtt?.nomeImpero}</span>
              <span style={{ color: 'rgba(238,232,220,0.4)', margin: '0 8px' }}>vs</span>
              <span style={{ color: gDif?.coloreImpero }}>{gDif?.nomeImpero}</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>
              per {TERRITORI.find(t => t.id === battaglia.territorioId)?.nome}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280, margin: '0 auto' }}>
              <button onClick={() => setSceltaSpettatore('guarda')} style={{
                width: '100%',
                padding: '12px 18px',
                background: 'linear-gradient(rgba(255,133,182,0.2), rgba(255,133,182,0.06))',
                border: '0.8px solid rgba(255,133,182,0.4)',
                borderRadius: 12,
                cursor: 'pointer',
                color: '#ff85b6',
                fontFamily: "'Saira Condensed', Saira, sans-serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                backdropFilter: 'blur(8px)',
              }}>
                👁 GUARDA LA SFIDA
              </button>
              <button onClick={() => setSceltaSpettatore('aspetta')} style={btnStyle('#666', true)}>
                ⏳ ASPETTA IL TUO TURNO
              </button>
            </div>
            <div style={{ marginTop: 20 }}>
              <button onClick={onEsciEsalva} style={{ background: 'none', border: 'none', color: 'rgba(238,232,220,0.3)', fontFamily: "'DM Sans', sans-serif", fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}>
                💾 SALVA ED ESCI
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (sceltaSpettatore === 'aspetta') {
      return (
        <div className="fade-in">
          <div style={{
            background: 'rgba(10,7,38,0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '0.8px solid rgba(167,139,250,0.2)',
            borderRadius: 20,
            padding: 24,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>IN ATTESA</div>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
              Sfida in corso tra
            </div>
            <div style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>
              <span style={{ color: gAtt?.coloreImpero }}>{gAtt?.nomeImpero}</span>
              <span style={{ color: 'rgba(238,232,220,0.3)', margin: '0 8px' }}>vs</span>
              <span style={{ color: gDif?.coloreImpero }}>{gDif?.nomeImpero}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', animation: `mmpulse 1.2s ease-in-out ${i*0.4}s infinite` }} />
              ))}
            </div>
            <button onClick={() => setSceltaSpettatore('guarda')} style={{
              width: '100%',
              padding: '12px 18px',
              background: 'linear-gradient(rgba(255,133,182,0.2), rgba(255,133,182,0.06))',
              border: '0.8px solid rgba(255,133,182,0.4)',
              borderRadius: 12,
              cursor: 'pointer',
              color: '#ff85b6',
              fontFamily: "'Saira Condensed', Saira, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              backdropFilter: 'blur(8px)',
              marginBottom: 10,
            }}>
              👁 GUARDA LA SFIDA
            </button>
            <div style={{ marginTop: 10 }}>
              <button onClick={onEsciEsalva} style={{ background: 'none', border: 'none', color: 'rgba(238,232,220,0.3)', fontFamily: "'DM Sans', sans-serif", fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}>
                💾 SALVA ED ESCI
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (sceltaSpettatore === 'guarda') {
      return (
        <SpettatoreView
          partita={partita}
          giocatori={giocatori}
          battaglia={battaglia}
          waifuCat={waifuCat}
          onAspetta={() => setSceltaSpettatore('aspetta')}
          onEsci={onEsciEsalva}
        />
      );
    }
  }

  // Mappa principale
  const mieiTerritori = Object.entries(mappaTerritori)
    .filter(([, v]) => v?.uid === myUid)
    .map(([k]) => k);

  // Costruisce la struttura territoriUtente compatibile con MappaMondoArt
  const territoriUtente = {};
  TERRITORI.forEach(t => {
    const info = mappaTerritori[t.id];
    if (info) {
      const isConquistato = info.uid !== 'cpu';
      territoriUtente[t.id] = {
        conquistato: isConquistato,
        impero: info.nomeImpero,
        coloreImpero: info.coloreImpero,
      };
    }
  });

  const handleTerritorioClick = async (t) => {
    if (!isMioTurno || sonoEliminato) return;
    const info = mappaTerritori[t.id];
    if (info?.uid === myUid) return; // già mio
    // Controlla confinante
    const conf = t.conf || [];
    const eConfinante = mieiTerritori.length === 0 || conf.some(c => mieiTerritori.includes(c));
    if (!eConfinante) { mostraNotif('Territorio non confinante!', '#ff3d3d'); return; }
    setTerrSel(t);
  };

  const avviaAttacco = async () => {
    if (!terrSel) return;
    try {
      await scegliAttacco({ codice, attaccanteUid: myUid, territorioId: terrSel.id });
      setTerrSel(null);
    } catch (e) { mostraNotif(e.message, '#ff3d3d'); }
  };

  return (
    <div className="fade-in">
      {/* Header partita */}
      <div style={{
        background: 'rgba(10,7,38,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.8px solid rgba(167,139,250,0.2)',
        borderRadius: 12,
        padding: '8px 14px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: "'Saira Condensed', Saira, sans-serif", letterSpacing: 2 }}>PARTITA MULTIPLAYER</div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 700, color: myGiocatore?.coloreImpero || '#a78bfa' }}>
              {myGiocatore?.nomeImpero}
              {sonoEliminato && <span style={{ color: '#ff85b6', marginLeft: 6 }}> ELIMINATO</span>}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {isMioTurno && !sonoEliminato ? (
              <div style={{
                color: '#6cf0e0',
                fontFamily: "'Unbounded', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                textShadow: '0 0 12px rgba(108,240,224,0.5)',
              }}>⚡ È IL TUO TURNO</div>
            ) : (
              <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: "'DM Sans', sans-serif" }}>
                Turno di: <span style={{ fontFamily: "'Unbounded', sans-serif", color: giocatori[turnoUid]?.coloreImpero || '#a78bfa' }}>
                  {giocatori[turnoUid]?.nomeImpero || '…'}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip colore="#9b59ff" size="xs">🏴 {mieiTerritori.length}</Chip>
            <button onClick={onEsciEsalva} style={{
              padding: '4px 10px', background: 'rgba(100,100,100,0.15)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'rgba(238,232,220,0.6)', fontSize: 9, cursor: 'pointer', fontFamily: "'Saira Condensed', Saira, sans-serif",
            }}>💾 ESCI</button>
          </div>
        </div>
      </div>

      {/* Mappa */}
      <PannelloOrnato glow="#9b59ff" style={{ padding: 8, marginBottom: 10, position: 'relative' }}>
        <MappaScrollabileMulti
          territoriUtente={territoriUtente}
          coloreImpero={myGiocatore?.coloreImpero}
          nomeImpero={myGiocatore?.nomeImpero}
          territorioSelezionato={terrSel?.id}
          onTerritorioClick={handleTerritorioClick}
          mieiTerritori={mieiTerritori}
          mappaMulti={mappaTerritori}
          myUid={myUid}
        />

        {/* ── Overlay "non è il tuo turno" ── */}
        {!isMioTurno && !sonoEliminato && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            background: 'rgba(10,7,38,0.72)', backdropFilter: 'blur(3px)',
            borderRadius: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10,
          }}>
            <div style={{ fontSize: 28 }}>⏳</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: giocatori[turnoUid]?.coloreImpero || '#f5a623', letterSpacing: 2, textAlign: 'center' }}>
              TURNO DI {(giocatori[turnoUid]?.nomeImpero || '…').toUpperCase()}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', textAlign: 'center' }}>
              In attesa che scelga il territorio da attaccare…
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: giocatori[turnoUid]?.coloreImpero || '#f5a623',
                  animation: `mmpulse 1.2s ease-in-out ${i*0.4}s infinite`,
                }} />
              ))}
            </div>
            <style>{`@keyframes mmpulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
          </div>
        )}

        {/* Popup territorio */}
        {terrSel && (() => {
          const info = mappaTerritori[terrSel.id] || {};
          const isConfinante = mieiTerritori.length === 0 || (terrSel.conf || []).some(c => mieiTerritori.includes(c));
          return (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'rgba(10,7,38,0.96)', backdropFilter: 'blur(14px)',
              border: `1px solid ${info.coloreImpero || '#9b59ff'}40`,
              borderRadius: 14, padding: 18, minWidth: 240, maxWidth: 300, zIndex: 50,
              boxShadow: `0 0 30px rgba(155,89,255,0.2)`,
            }}>
              <button onClick={() => setTerrSel(null)} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', color: 'rgba(238,232,220,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
              {/* Carta territorio */}
              <CartaTerritorio territorio={terrSel} infoImpero={info} />
              {isMioTurno && !sonoEliminato && info.uid !== myUid && isConfinante && (
                <button onClick={avviaAttacco} style={{ ...btnStyle('#ff2d78'), marginTop: 12, width: '100%' }}>
                  ⚔ ATTACCA!
                </button>
              )}
              {!isConfinante && (
                <div style={{ fontSize: 9, color: '#ff3d3d', textAlign: 'center', marginTop: 8, fontFamily: 'Orbitron' }}>Non confinante</div>
              )}
              {!isMioTurno && (
                <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', textAlign: 'center', marginTop: 8, fontFamily: 'Orbitron' }}>Non è il tuo turno</div>
              )}
            </div>
          );
        })()}
      </PannelloOrnato>

      {/* Log partita */}
      {(partita.log || []).length > 0 && (
        <PannelloOrnato glow="#444" style={{ padding: '8px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', letterSpacing: 2, marginBottom: 4 }}>LOG</div>
          {[...(partita.log || [])].slice(-5).reverse().map((entry, i) => (
            <div key={i} style={{ fontSize: 9, color: 'rgba(238,232,220,0.5)', padding: '2px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {entry}
            </div>
          ))}
        </PannelloOrnato>
      )}

      {/* Giocatori attivi */}
      <PannelloOrnato glow="#333" style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', letterSpacing: 2, marginBottom: 8 }}>GIOCATORI</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.values(giocatori).filter(g => g.uid !== 'cpu').map(g => (
            <div key={g.uid} style={{
              padding: '4px 10px', borderRadius: 6,
              background: g.eliminato ? 'rgba(60,60,60,0.15)' : `${g.coloreImpero}15`,
              border: `1px solid ${g.eliminato ? 'rgba(255,255,255,0.05)' : g.coloreImpero + '40'}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.eliminato ? '#444' : g.coloreImpero }} />
              <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: g.eliminato ? 'rgba(238,232,220,0.2)' : g.coloreImpero }}>
                {g.nomeImpero}
                {g.uid === turnoUid && !g.eliminato && <span style={{ marginLeft: 4 }}>⚡</span>}
                {g.eliminato && <span style={{ marginLeft: 4, opacity: 0.4 }}>✕</span>}
              </span>
              <span style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron' }}>
                {(g.territoriIds || []).length}🏴
              </span>
            </div>
          ))}
        </div>
      </PannelloOrnato>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARTA TERRITORIO
// ════════════════════════════════════════════════════════════════════
function CartaTerritorio({ territorio, infoImpero }) {
  const terrData = TERRITORI.find(t => t.id === territorio.id) || territorio;
  const colore = infoImpero?.coloreImpero || '#9b59ff';
  const nomeContinent = NOMI_CONTINENTI[terrData.cont] || terrData.cont;

  return (
    <div style={{
      border: `2px solid ${colore}`,
      borderRadius: 12,
      padding: 14,
      background: `linear-gradient(135deg, ${colore}15, rgba(6,3,15,0.9))`,
      boxShadow: `0 0 18px ${colore}30`,
      textAlign: 'center',
      marginBottom: 4,
    }}>
      {/* Forma territorio (SVG path) */}
      {terrData.path && (
        <div style={{ marginBottom: 10 }}>
          <svg
            viewBox="0 0 1050 650"
            style={{ width: 100, height: 62, display: 'block', margin: '0 auto' }}
          >
            <path
              d={terrData.path}
              fill={colore}
              fillOpacity={0.5}
              stroke={colore}
              strokeWidth={2}
            />
          </svg>
        </div>
      )}
      <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, color: colore, marginBottom: 4 }}>
        {terrData.nome}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 2 }}>
        {nomeContinent}
      </div>
      {infoImpero?.nomeImpero && (
        <div style={{ fontSize: 10, fontFamily: 'Orbitron', color: colore, marginTop: 6 }}>
          👑 {infoImpero.nomeImpero}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BATTAGLIA MULTIPLAYER — PvP vero tra 2 giocatori (o vs CPU)
//
// Architettura interna:
//  - Firestore è la fonte di verità per tutte le scelte PvP.
//  - Solo l'attaccante (sonoAttaccante) risolve il round e scrive
//    il risultato su Firestore; entrambi leggono da lì.
//  - Il motore WaifuBattleArena gestisce le animazioni arena;
//    la sincronizzazione avviene tramite arenaMosse / arenaRisultato.
//  - Vs CPU tutta la logica è locale (nessuna scrittura Firestore
//    per i round, solo il risultato finale).
// ════════════════════════════════════════════════════════════════════

/**
 * Componente battaglia per una singola sfida territoriale.
 *
 * @param {Object}   props
 * @param {Object}   props.partita           - Documento partita corrente.
 * @param {string}   props.codice            - Codice partita.
 * @param {Object}   props.user              - Oggetto Firebase Auth (uid).
 * @param {Object}   props.profilo           - Profilo utente (nomeImpero, hardPass, …).
 * @param {Object}   props.collezione        - Collezione del giocatore (waifu, teams, equipaggiamento).
 * @param {Object[]} props.waifuCat          - Catalogo waifu completo.
 * @param {Object[]} props.outfitCat         - Catalogo outfit/abilità.
 * @param {boolean}  props.sonoAttaccante    - true se questo client è l'attaccante (RESOLVER PvP).
 * @param {Function} props.onBattagliaFinita - Callback con vincitoreUid al termine della battaglia.
 * @param {Function} props.mostraNotif       - Mostra una notifica temporanea.
 */
function BattagliaMultiplayer({
  partita, codice, user, profilo, collezione, waifuCat, outfitCat,
  sonoAttaccante, onBattagliaFinita, mostraNotif,
}) {
  const myUid = user.uid;
  const giocatori = partita.giocatori || {};
  const battaglia = partita.battagliaCorrente;
  const avversarioUid = sonoAttaccante ? battaglia.difensoreUid : battaglia.attaccanteUid;
  const avversario = giocatori[avversarioUid];
  const isCpu = avversarioUid === 'cpu';
  const territorioId = battaglia.territorioId;
  const terrData = TERRITORI.find(t => t.id === territorioId);

  const STATS_BATTAGLIA = [
    { key: 'tette', label: 'Tette', icon: '💗' },
    { key: 'taglia_piedi', label: 'Piedi', icon: '👠' },
    { key: 'eta', label: 'Età', icon: '📅' },
    { key: 'colore_capelli', label: 'Capelli', icon: '💇' },
    { key: 'esperienza', label: 'Esperienza', icon: '⭐' },
  ];

  // ── STATO ARENA PvP ──────────────────────────────────────────────
  // `fase` guida il flusso della battaglia:
  //   coin → pvpScegliWaifu/playerScegliWaifu → scegliStat → scegliDir
  //   → attesa/risoluzione → reveal → roundEnd → (prosegui) → prossimo round
  const [fase, setFase] = useState('coin');
  const [coinResult, setCoinResult] = useState(null);
  const [primoTurno, setPrimoTurno] = useState(null);   // 'player' | 'cpu'
  const [turno, setTurno] = useState(null);             // chi sceglie stat+dir in questo round
  const [round, setRound] = useState(1);
  // Per PvP: { player: N, cpu: N } dove 'cpu' = avversario umano per coerenza UI
  const [punteggio, setPunteggio] = useState({ player: 0, cpu: 0 });
  const [mazzoP, setMazzoP] = useState([]);
  const [mazzoC, setMazzoC] = useState([]);
  const [carteP, setCarteP] = useState(null);
  const [carteC, setCarteC] = useState(null);
  const [statScelta, setStatScelta] = useState(null);
  const [direzione, setDirezione] = useState(null);
  // CPU only
  const [cpuWaifuPending, setCpuWaifuPending] = useState(null);
  const [cpuStatPending, setCpuStatPending] = useState(null);
  const [cpuDirPending, setCpuDirPending] = useState(null);
  const [vincitoreRound, setVincitoreRound] = useState(null);
  const [risultatiWaifu, setRisultatiWaifu] = useState({});
  const [inSuddenDeath, setInSuddenDeath] = useState(false);
  const [statsUsatePartita, setStatsUsatePartita] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [teamSel, setTeamSel] = useState(null);
  const [waifuSel, setWaifuSel] = useState([]);
  const [modoBattaglia, setModoBattaglia] = useState(true);
  const [iniziata, setIniziata] = useState(false);
  // Risultato finale per il popup "Fine partita"
  const [risultatoFinale, setRisultatoFinale] = useState(null);

  // ── NUOVO SISTEMA ARENA WaifuBattle ─────────────────────────────────
  const [arenaAttiva, setArenaAttiva]         = useState(false);
  const [arenaPlayerTeam, setArenaPlayerTeam] = useState([]);
  const [arenaEnemyTeam, setArenaEnemyTeam]   = useState([]);
  // [WAIFU CHAMPIONS REFACTOR] — pick phase state
  const [pickPhaseAttiva, setPickPhaseAttiva] = useState(false);
  const [pickRoster5P, setPickRoster5P]       = useState([]);
  const [pickRoster5E, setPickRoster5E]       = useState([]);
  // PvP: roster5 inviato su Firestore, in attesa del roster5 dell'avversario
  const [attesaRoster5Avv, setAttesaRoster5Avv] = useState(false);
  const mioRoster5Ref = useRef([]); // roster5 del giocatore corrente (usato dal listener)
  const [pvpOpponentMove, setPvpOpponentMove] = useState(null);
  const [pvpWaiting, setPvpWaiting]           = useState(false);
  // PvP Arena sync — Attacker-as-resolver
  const [pvpBattleSeed, setPvpBattleSeed]     = useState(null);   // seed RNG condiviso (generato dall'attaccante)
  // pvpTurnResult rimosso: approccio deterministico simmetrico — nessun RECEIVER
  const arenaTurnoRef    = useRef(0);   // turno corrente arena (PvP move sync)
  const arenaVincitoreRef = useRef(null); // vincitore UID arena, settato da onBattleResult

  // ── Helpers mazzo (definiti prima degli useEffect che li usano) ───
  const waifuDisponibili = Object.entries(collezione?.waifu || {}).map(([id, dati]) => {
    const w = waifuCat.find(x => x.id === id);
    return w ? { ...w, ...dati } : null;
  }).filter(Boolean);
  const teams = collezione?.teams || {};

  const buildWaifuBattaglia = (id) => {
    const w = waifuDisponibili.find(x => x.id === id);
    const dati = collezione?.waifu[id];
    if (!w) return null;
    const equipIds = Object.values(collezione?.equipaggiamento?.[id] || {}).filter(Boolean);
    let wb = {
      ...w,
      tette: Math.min(7, w.tette + (dati?.stat_bonus?.tette || 0)),
      taglia_piedi: Math.min(45, w.taglia_piedi + (dati?.stat_bonus?.taglia_piedi || 0)),
      eta: Math.min(5000, w.eta + (dati?.stat_bonus?.eta || 0)),
      colore_capelli: Math.min(10, w.colore_capelli + (dati?.stat_bonus?.colore_capelli || 0)),
      esperienza: Math.min(5000, w.esperienza + (dati?.stat_bonus?.esperienza || 0)),
      _outfitEquipIds: equipIds,
    };
    const { waifuModificata } = applicaAbilitaOutfit(wb, equipIds, outfitCat, STAT_RANGES_DEFAULT);
    return { ...waifuModificata, _outfitEquipIds: equipIds };
  };

  // ── Stato PvP (Firestore-driven) ──────────────────────────────────
  // ARCHITETTURA: Firestore è la fonte di verità.
  // 1. Ogni client scrive SOLO la propria scelta su Firestore
  // 2. Il listener legge lo stato e aggiorna la UI
  // 3. Solo l'attaccante (sonoAttaccante) scrive il risultato del round su Firestore
  // 4. Entrambi leggono il risultato da Firestore

  const [pvpHoScelto, setPvpHoScelto] = useState(false);
  const [pvpHoPremutoProsegui, setPvpHoPremutoProsegui] = useState(false);
  // Ref per guard — NON stato React (evita stale closure)
  const pvpScriviRef = useRef('');           // roundKey già inviato a Firestore (solo attaccante)
  const pvpRoundRisoltoRef = useRef('');     // roundKey già applicato localmente (tutti)
  const pvpProseguiEseguitoRef = useRef(''); // roundKey già avanzato al prossimo round
  // Ref per i valori critici usati nella risoluzione (evita stale closure)
  const mazzoPRef = useRef([]);
  const mazzoCRef = useRef([]);
  const turnoRef = useRef(null);
  const primoTurnoRef = useRef(null);
  const roundRef = useRef(1);
  const inSuddenDeathRef = useRef(false);
  const punteggioRef = useRef({ player: 0, cpu: 0 });
  const statsUsateRef = useRef([]);

  const FASI_TIMER_ACTIVE = isCpu
    ? ['playerScegliWaifu', 'playerScegliStat', 'playerScegliDir', 'playerScegliWaifuVsCPU', 'suddenDeathWaifu']
    : ['pvpScegliWaifu', 'pvpScegliStat', 'pvpScegliDir', 'pvpScegliWaifuRispondi', 'suddenDeathWaifu', 'pvpAttesaProsegui'];

  // ── Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!FASI_TIMER_ACTIVE.includes(fase)) return;
    if (timeLeft <= 0) { autoCompleta(); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, timeLeft]);

  // ── Ripristino stato alla riconnessione ───────────────────────────
  // Se il componente viene smontato e rimontato (cambio sezione + ritorno),
  // leggiamo Firestore per capire in quale punto della battaglia eravamo
  // e saltiamo la selezione del team se avevamo già scelto il mazzo.
  useEffect(() => {
    if (isCpu) return; // vs CPU non ha senso: il mazzo CPU era generato localmente
    const batt = partita?.battagliaCorrente;
    if (!batt) return;

    const mazziPartita = batt.mazzi || {};
    const mioMazzoIds = mazziPartita[myUid];
    if (!mioMazzoIds || mioMazzoIds.length < 5) return; // non avevo ancora scelto il mazzo

    // Ricostruisco il mio mazzo
    const mioMazzo = mioMazzoIds.map(id => buildWaifuBattaglia(id)).filter(Boolean);
    if (mioMazzo.length < 5) return;

    const mazzoAvvIds = mazziPartita[avversarioUid];
    const mazzoAvversario = mazzoAvvIds && mazzoAvvIds.length >= 5
      ? mazzoAvvIds.map(id => { const w = waifuCat.find(x => x.id === id); return w ? { ...w, id: `opp_${w.id}`, _outfitEquipIds: [] } : null; }).filter(Boolean)
      : null;

    // Imposto mio mazzo immediatamente
    setMazzoP(mioMazzo);
    mazzoPRef.current = mioMazzo;
    setMazzoSalvato(true);

    if (!mazzoAvversario || mazzoAvversario.length < 5) {
      // Avversario non ha ancora scelto: torno alla schermata di attesa
      setModoBattaglia(false); // nasconde selezione team
      setAttesaMazzoAvv(true);
      return;
    }

    // Entrambi i mazzi disponibili: ripristino la partita in corso
    setMazzoC(mazzoAvversario);
    mazzoCRef.current = mazzoAvversario;
    setAttesaMazzoAvv(false);
    setModoBattaglia(false);
    setIniziata(true);

    // Ripristino punteggio dai risultati dei round già salvati su Firestore
    const pvpRisultato = batt.pvpRisultato || {};
    const sceltePvp = batt.sceltePvp || {};
    let playerScore = 0;
    let cpuScore = 0;
    let ultimoRound = 0;
    let statsUsate = [];
    const risWaifu = {};

    // Ricalcola i risultati di tutti i round già giocati
    Object.entries(pvpRisultato).forEach(([rKey, ris]) => {
      const { vincitoreUid, attaccanteWaifuId, difensoreWaifuId, statKey } = ris;
      if (statKey && !statsUsate.includes(statKey)) statsUsate.push(statKey);
      const vincePlayer = vincitoreUid === myUid;
      const vinceCpu = vincitoreUid !== 'pareggio' && vincitoreUid !== myUid;
      if (vincePlayer) playerScore++;
      else if (vinceCpu) cpuScore++;
      // Traccia waifu usate (IDs assoluti attaccante/difensore)
      const sonoIoAtt = ris.attaccanteUid === myUid;
      const mioWId = sonoIoAtt ? attaccanteWaifuId : difensoreWaifuId;
      const avvWId = sonoIoAtt ? difensoreWaifuId : attaccanteWaifuId;
      const vince = vincitoreUid === 'pareggio' ? 'pareggio' : vincitoreUid === myUid ? 'player' : 'cpu';
      if (mioWId) risWaifu[mioWId] = vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio';
      if (avvWId) {
        const avvWIdOpp = `opp_${avvWId}`;
        risWaifu[avvWIdOpp] = vince === 'cpu' ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio';
      }
      // Calcola il round numero massimo giocato
      if (rKey !== 'sd') {
        const n = parseInt(rKey, 10);
        if (!isNaN(n) && n > ultimoRound) ultimoRound = n;
      }
    });

    setPunteggio({ player: playerScore, cpu: cpuScore });
    punteggioRef.current = { player: playerScore, cpu: cpuScore };
    setStatsUsatePartita(statsUsate);
    statsUsateRef.current = statsUsate;
    setRisultatiWaifu(risWaifu);

    // Ripristino primoTurno
    if (batt.primoTurno) {
      const pt = batt.primoTurno === myUid ? 'player' : 'cpu';
      setPrimoTurno(pt);
      primoTurnoRef.current = pt;
    }

    // Determina il round corrente e la fase da riprendere
    const roundCorrente = ultimoRound + 1;
    setRound(roundCorrente);
    roundRef.current = roundCorrente;

    const roundKey = String(roundCorrente);
    const scelteRoundCorrente = sceltePvp[roundKey] || {};
    const miaSceltaCorrente = scelteRoundCorrente[myUid];
    const sceltaAvvCorrente = scelteRoundCorrente[avversarioUid];
    const risultatoRoundCorrente = pvpRisultato[roundKey];

    if (risultatoRoundCorrente) {
      // Round già risolto: siamo in attesa di "prosegui"
      pvpRoundRisoltoRef.current = roundKey;
      const { attaccanteWaifuId, difensoreWaifuId, statKey, dir, vincitoreUid } = risultatoRoundCorrente;
      const sonoIoAtt = risultatoRoundCorrente.attaccanteUid === myUid;
      const mioWId = sonoIoAtt ? attaccanteWaifuId : difensoreWaifuId;
      const avvWId = sonoIoAtt ? difensoreWaifuId : attaccanteWaifuId;
      const wMy = mioMazzo.find(w => w.id === mioWId);
      const wAvv = mazzoAvversario.find(w => w.id === avvWId || w.id === `opp_${avvWId}`);
      const vince = vincitoreUid === 'pareggio' ? 'pareggio' : vincitoreUid === myUid ? 'player' : 'cpu';
      if (wMy) setCarteP(wMy);
      if (wAvv) setCarteC(wAvv);
      setStatScelta(statKey);
      setDirezione(dir);
      setVincitoreRound(vince);
      // Verifica se anche l'avversario ha già premuto "prosegui"
      const proseguiData = batt.proseguiRound || {};
      const proseguiRound = proseguiData[roundKey] || {};
      if (proseguiRound[myUid]) {
        setPvpHoPremutoProsegui(true);
      }
      setFase('pvpAttesaProsegui');
    } else if (miaSceltaCorrente && !sceltaAvvCorrente) {
      // Ho già scelto, aspetto l'avversario
      setPvpHoScelto(true);
      const sonoIoAtt = sonoAttaccante;
      setFase(sonoIoAtt ? 'pvpAttesaAvv' : 'pvpAttesaRisoluzione');
    } else if (!batt.primoTurno) {
      // Coin flip non ancora avvenuto
      setFase('coin');
    } else {
      // Ricomincia dal turno corretto
      const pt = batt.primoTurno === myUid ? 'player' : 'cpu';
      const nuovoTurno = roundCorrente % 2 === 1 ? pt : (pt === 'player' ? 'cpu' : 'player');
      setTurno(nuovoTurno);
      turnoRef.current = nuovoTurno;
      setTimeLeft(30);
      setFase(nuovoTurno === 'player' ? 'pvpScegliWaifu' : 'pvpScegliWaifuRispondi');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CPU turno (solo vs CPU) ───────────────────────────────────────
  useEffect(() => {
    if (isCpu && fase === 'cpuSceglieTutto') {
      const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
      const cpuW = cpuDisp[Math.floor(Math.random() * cpuDisp.length)];
      if (!cpuW) return;
      const pool = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));
      const stat = (pool.length > 0 ? pool : STATS_BATTAGLIA)[Math.floor(Math.random() * (pool.length || STATS_BATTAGLIA.length))];
      const dir = Math.random() < 0.5 ? 'piu' : 'meno';
      setCpuWaifuPending(cpuW); setCpuStatPending(stat.key); setCpuDirPending(dir);
      setTimeout(() => { setTimeLeft(30); setFase('playerScegliWaifuVsCPU'); }, 400);
    }
  }, [fase]);

  // ── PvP: Listener Firestore-driven (pattern classico PvP a turni) ──────
  // Sync refs con state per evitare stale closure nella risoluzione
  useEffect(() => { mazzoPRef.current = mazzoP; }, [mazzoP]);
  useEffect(() => { mazzoCRef.current = mazzoC; }, [mazzoC]);
  useEffect(() => { turnoRef.current = turno; }, [turno]);
  useEffect(() => { primoTurnoRef.current = primoTurno; }, [primoTurno]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { inSuddenDeathRef.current = inSuddenDeath; }, [inSuddenDeath]);
  useEffect(() => { punteggioRef.current = punteggio; }, [punteggio]);
  useEffect(() => { statsUsateRef.current = statsUsatePartita; }, [statsUsatePartita]);

  // Listener principale: reagisce a OGNI cambio di battagliaCorrente su Firestore
  // FLUSSO: scelte → [attaccante scrive risultato] → tutti leggono risultato → reveal → roundEnd → prosegui → next round
  useEffect(() => {
    if (isCpu || !iniziata) return;
    const batt = partita?.battagliaCorrente;
    if (!batt) return;

    const roundKey = inSuddenDeathRef.current ? 'sd' : String(roundRef.current);
    const sceltePvp = batt.sceltePvp || {};
    const scelteRound = sceltePvp[roundKey] || {};
    const miaScelta = scelteRound[myUid];
    const sceltaAvv = scelteRound[avversarioUid];
    const entrambiHannoScelto = !!(miaScelta && sceltaAvv);
    const pvpRisultato = batt.pvpRisultato || {};
    const risultatoRound = pvpRisultato[roundKey];

    // ── 1. Primo turno: chi inizia? ──
    if (!primoTurnoRef.current && batt.primoTurno && fase === 'coin') {
      const pt = batt.primoTurno === myUid ? 'player' : 'cpu';
      setCoinResult(pt);
      setPrimoTurno(pt);
      primoTurnoRef.current = pt;
      setTimeout(() => {
        setTurno(pt);
        turnoRef.current = pt;
        setTimeLeft(30);
        setFase(pt === 'player' ? 'pvpScegliWaifu' : 'pvpScegliWaifuRispondi');
      }, 1800);
      return;
    }

    // ── 2. Preview waifu avversario durante selezione stat/dir ──
    if ((fase === 'pvpScegliStat' || fase === 'pvpScegliDir') && sceltaAvv) {
      const wAvv = mazzoCRef.current.find(w => w.id === sceltaAvv.waifuId || w.id === `opp_${sceltaAvv.waifuId}`);
      if (wAvv) setCarteC(wAvv);
    }

    // ── 3. Attaccante: quando entrambi hanno scelto, risolve e scrive su Firestore ──
    // pvpScriviRef evita doppia scrittura; è SEPARATO da pvpRoundRisoltoRef (che serve per l'applicazione)
    if (sonoAttaccante && entrambiHannoScelto && pvpScriviRef.current !== roundKey) {
      pvpScriviRef.current = roundKey;
      _risolviERiscrivi(scelteRound, roundKey);
      // NON usciamo: continuiamo a controllare se risultatoRound è già disponibile
    }

    // ── 4. TUTTI (attaccante e difensore): appena risultatoRound appare, applica ──
    if (risultatoRound && pvpRoundRisoltoRef.current !== roundKey) {
      pvpRoundRisoltoRef.current = roundKey;
      _applicaRisultato(risultatoRound, roundKey);
      return;
    }

    // ── 5. Prosegui turno: entrambi hanno premuto ──
    if (fase === 'pvpAttesaProsegui') {
      const proseguiData = batt.proseguiRound || {};
      const proseguiRound = proseguiData[roundKey] || {};
      if (proseguiRound[myUid] && proseguiRound[avversarioUid] && pvpProseguiEseguitoRef.current !== roundKey) {
        pvpProseguiEseguitoRef.current = roundKey;
        _eseguiProssimoRound();
      }
    }
  }, [partita?.battagliaCorrente, fase, iniziata]);

  // ── Arena PvP: sincronizzazione mosse — SIMMETRICO per entrambi i giocatori ──
  // Quando ENTRAMBE le mosse sono in Firestore, sblocca la risoluzione del turno.
  // Il calcolo avviene in modo deterministico su entrambi i device (stesso seed RNG).
  useEffect(() => {
    if (!arenaAttiva || isCpu) return;
    const arenaMosse = partita?.battagliaCorrente?.arenaMosse;
    if (!arenaMosse) return;
    const t = arenaTurnoRef.current;
    const myMoveData  = arenaMosse?.[`t${t}`]?.[myUid];
    const oppMoveData = arenaMosse?.[`t${t}`]?.[avversarioUid];

    // Passa la mossa dell'avversario a WaifuBattleArena appena disponibile
    if (oppMoveData?.moveIndex !== undefined) {
      setPvpOpponentMove(oppMoveData.moveIndex);
    }

    // Sblocca l'attesa solo quando ENTRAMBI hanno inviato la mossa
    if (myMoveData?.moveIndex !== undefined && oppMoveData?.moveIndex !== undefined) {
      setPvpWaiting(false);
    }
  }, [partita?.battagliaCorrente?.arenaMosse, arenaAttiva, myUid, avversarioUid]); // eslint-disable-line

  // ── Arena PvP: seed RNG — il difensore legge il seed pubblicato dall'attaccante ──
  // L'attaccante genera il seed e lo scrive su Firestore via inizializzaArenaSeedRng.
  // Il difensore lo legge qui e lo salva in pvpBattleSeed per il calcolo deterministico.
  useEffect(() => {
    if (!arenaAttiva || isCpu || sonoAttaccante) return;
    const battleSeed = partita?.battagliaCorrente?.battleSeed;
    if (!battleSeed || pvpBattleSeed) return;
    setPvpBattleSeed(battleSeed);
  }, [partita?.battagliaCorrente?.battleSeed, arenaAttiva, sonoAttaccante, pvpBattleSeed]); // eslint-disable-line

  const handlePvPMoveSubmit = async (moveIdx) => {
    const t = arenaTurnoRef.current;
    // Reset pvpOpponentMove PRIMA di scrivere su Firestore per evitare che il listener
    // simmetrico riutilizzi il valore del turno precedente.
    setPvpOpponentMove(null);
    setPvpWaiting(true);
    try {
      await salvaArenaMove(codice, myUid, t, { moveIndex: moveIdx });
    } catch (e) {
      mostraNotif('Errore sincronizzazione mossa', '#ff3d3d');
    }
  };

  // Avanza il contatore turno su questo device dopo che il turno è stato risolto.
  // Chiamato da WaifuBattleArena al termine di ogni turno PvP.
  const handlePvPTurnAdvance = useCallback(() => {
    arenaTurnoRef.current += 1;
    setPvpOpponentMove(null); // reset per il prossimo turno
    setPvpWaiting(false);     // reset attesa
  }, []);

  // Risolve il round (solo l'attaccante) e scrive il risultato su Firestore
  const _risolviERiscrivi = async (scelteRound, roundKey) => {
    const miaScelta = scelteRound[myUid];
    const sceltaAvv = scelteRound[avversarioUid];
    if (!miaScelta || !sceltaAvv) return;

    // Chi ha il turno ha scelto stat+dir; l'altro ha scelto solo waifu
    const turnoCorrente = turnoRef.current;
    const sceltaTurno = turnoCorrente === 'player' ? miaScelta : sceltaAvv;
    const statKey = sceltaTurno.stat;
    const dir = sceltaTurno.direzione;

    // FIX PvP: usiamo ID assoluti (per uid) invece di relativi (wMyId/wAvvId dal punto di vista dell'attaccante).
    // In questo modo entrambi i client (attaccante e difensore) sanno con certezza
    // quale waifuId appartiene a quale giocatore, e cercano nel mazzoP/mazzoC corretto.
    const attaccanteWaifuId = miaScelta.waifuId; // l'attaccante è sempre myUid in questo branch
    const difensoreWaifuId  = sceltaAvv.waifuId;

    const wAttaccante = mazzoPRef.current.find(w => w.id === attaccanteWaifuId);
    const wDifensore  = mazzoCRef.current.find(w => w.id === difensoreWaifuId || w.id === `opp_${difensoreWaifuId}`);

    if (!wAttaccante || !wDifensore) return;

    const { modOpp: modP } = applicaAbilitaOutfit(wAttaccante, wAttaccante._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
    const { modOpp: modC } = applicaAbilitaOutfit(wDifensore,  wDifensore._outfitEquipIds  || [], outfitCat, STAT_RANGES_DEFAULT);
    const pEff = applicaModificatoriOpp(wAttaccante, modC, STAT_RANGES_DEFAULT);
    const cEff = applicaModificatoriOpp(wDifensore,  modP, STAT_RANGES_DEFAULT);
    const valP = pEff[statKey];
    const valC = cEff[statKey];
    // Calcola chi vince in modo assoluto (vincitoreUid) anziché relativo ('player'/'cpu')
    const vinceAttaccante = valP === valC ? null : dir === 'piu' ? (valP > valC) : (valP < valC);
    const vincitoreUid = valP === valC ? 'pareggio' : vinceAttaccante ? myUid : avversarioUid;

    // Salva su Firestore con ID assoluti: entrambi i client leggeranno e sapranno chi è chi
    const risultato = { attaccanteUid: myUid, attaccanteWaifuId, difensoreWaifuId, statKey, dir, vincitoreUid };
    try {
      await salvaRisultatoPvpRound(codice, roundKey, risultato);
      // L'attaccante applica subito localmente senza aspettare il proprio onSnapshot
      if (pvpRoundRisoltoRef.current !== roundKey) {
        pvpRoundRisoltoRef.current = roundKey;
        _applicaRisultato(risultato, roundKey);
      }
    } catch (e) {
      // fallback se Firestore fallisce
      if (pvpRoundRisoltoRef.current !== roundKey) {
        pvpRoundRisoltoRef.current = roundKey;
        _applicaRisultato(risultato, roundKey);
      }
    }
  };

  // Applica il risultato scritto su Firestore (chiamato da entrambi i client)
  // FIX PvP: il risultato ora contiene ID assoluti (attaccanteUid, attaccanteWaifuId, difensoreWaifuId).
  // Ogni client sa se è l'attaccante e cerca la waifu nel mazzo corretto:
  //   - waifu dell'attaccante → nel mazzoPRef del client attaccante, nel mazzoCRef (opp_) del difensore
  //   - waifu del difensore   → nel mazzoCRef (opp_) del client attaccante, nel mazzoPRef del difensore
  const _applicaRisultato = (risultato, roundKey) => {
    const { attaccanteUid, attaccanteWaifuId, difensoreWaifuId, statKey, dir, vincitoreUid } = risultato;
    const sonoIoAttaccante = myUid === attaccanteUid;
    const mioWaifuId  = sonoIoAttaccante ? attaccanteWaifuId : difensoreWaifuId;
    const avvWaifuId  = sonoIoAttaccante ? difensoreWaifuId  : attaccanteWaifuId;
    // Converti vincitoreUid nel valore locale 'player'/'cpu'/'pareggio'
    const vince = vincitoreUid === 'pareggio' ? 'pareggio' : vincitoreUid === myUid ? 'player' : 'cpu';
    const wMy = mazzoPRef.current.find(w => w.id === mioWaifuId);
    const wAvv = mazzoCRef.current.find(w => w.id === avvWaifuId || w.id === `opp_${avvWaifuId}`);
    if (!wMy || !wAvv) return;

    setCarteP(wMy);
    setCarteC(wAvv);
    setStatScelta(statKey);
    setDirezione(dir);
    setStatsUsatePartita(prev => {
      const aggiornato = prev.includes(statKey) ? prev : [...prev, statKey];
      statsUsateRef.current = aggiornato;
      return aggiornato;
    });
    // Mostra prima l'esito nel campo di gioco (fase reveal), poi dopo aggiorna punteggio e colori carte
    setVincitoreRound(vince);

    setTimeout(() => {
      if (inSuddenDeathRef.current) {
        // In sudden death: aggiorna tutto e poi conclude
        setPunteggio(prev => {
          const aggiornato = {
            player: prev.player + (vince === 'player' ? 1 : 0),
            cpu: prev.cpu + (vince === 'cpu' ? 1 : 0),
          };
          punteggioRef.current = aggiornato;
          return aggiornato;
        });
        setRisultatiWaifu(prev => ({
          ...prev,
          [wMy.id]: vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio',
          [wAvv.id]: vince === 'cpu' ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio',
        }));
        if (vince === 'pareggio') setTimeout(() => avviaSuddenDeath(), 2500);
        else setTimeout(() => fineBattaglia(vince === 'player'), 2500);
      } else {
        // Passa a roundEnd: qui aggiorniamo punteggio e colori carte (dopo il reveal)
        setPunteggio(prev => {
          const aggiornato = {
            player: prev.player + (vince === 'player' ? 1 : 0),
            cpu: prev.cpu + (vince === 'cpu' ? 1 : 0),
          };
          punteggioRef.current = aggiornato;
          return aggiornato;
        });
        setRisultatiWaifu(prev => ({
          ...prev,
          [wMy.id]: vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio',
          [wAvv.id]: vince === 'cpu' ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio',
        }));
        setFase('roundEnd');
      }
    }, 1500);
  };

  const _pvpResetRound = () => {
    setPvpHoScelto(false);
    setPvpHoPremutoProsegui(false);
    // NON resettiamo pvpRoundRisoltoRef qui — viene resettato solo quando cambia roundKey
  };

  const _eseguiProssimoRound = () => {
    const pt = punteggioRef.current;
    const r = roundRef.current;
    if (r >= 5 || pt.player >= 3 || pt.cpu >= 3) {
      if (pt.player === pt.cpu) avviaSuddenDeath();
      else fineBattaglia(pt.player > pt.cpu);
      return;
    }
    const nr = r + 1;
    const ptUid = primoTurnoRef.current === 'player' ? myUid : avversarioUid;
    const turnoUid = nr % 2 === 1 ? ptUid : (ptUid === myUid ? avversarioUid : myUid);
    const nuovoTurno = turnoUid === myUid ? 'player' : 'cpu';

    setCarteP(null); setCarteC(null); setStatScelta(null);
    setDirezione(null); setVincitoreRound(null);
    pvpScriviRef.current = '';
    pvpRoundRisoltoRef.current = '';
    pvpProseguiEseguitoRef.current = '';
    _pvpResetRound();
    setRound(nr);
    roundRef.current = nr;
    setTurno(nuovoTurno);
    turnoRef.current = nuovoTurno;
    setTimeLeft(30);
    setFase(nuovoTurno === 'player' ? 'pvpScegliWaifu' : 'pvpScegliWaifuRispondi');
  };

  // ── Auto-completa (timer scaduto) ─────────────────────────────────
  const autoCompleta = () => {
    if (isCpu) {
      const pDisp = mazzoP.filter(w => !risultatiWaifu[w.id]);
      if (fase === 'playerScegliWaifu') { const p = pDisp[Math.floor(Math.random() * pDisp.length)]; if (p) onScegliWaifuCpu(p); }
      else if (fase === 'playerScegliStat') { onScegliStatCpu(STATS_BATTAGLIA[Math.floor(Math.random() * STATS_BATTAGLIA.length)].key); }
      else if (fase === 'playerScegliDir') { onScegliDirCpu(Math.random() < 0.5 ? 'piu' : 'meno'); }
      else if (fase === 'playerScegliWaifuVsCPU') { const p = pDisp[Math.floor(Math.random() * pDisp.length)]; if (p) onScegliWaifuVsCpu(p); }
    } else {
      const pDisp = mazzoP.filter(w => !risultatiWaifu[w.id]);
      if (fase === 'pvpScegliWaifu') { const p = pDisp[Math.floor(Math.random() * pDisp.length)]; if (p) pvpScegliWaifu(p); }
      else if (fase === 'pvpScegliStat') {
        const statsDisp = STATS_BATTAGLIA.filter(s => !statsUsateRef.current.includes(s.key));
        const s = statsDisp[Math.floor(Math.random() * statsDisp.length)] || STATS_BATTAGLIA[0];
        pvpScegliStat(s.key);
      } else if (fase === 'pvpScegliDir') { pvpScegliDir(Math.random() < 0.5 ? 'piu' : 'meno'); }
      else if (fase === 'pvpScegliWaifuRispondi') { const p = pDisp[Math.floor(Math.random() * pDisp.length)]; if (p) pvpRispondiWaifu(p); }
      else if (fase === 'suddenDeathWaifu') { const p = mazzoP[Math.floor(Math.random() * mazzoP.length)]; if (p) pvpScegliWaifuSD(p); }
      else if (fase === 'pvpAttesaProsegui') { _pvpPremutoProsegui(); }
    }
  };

  // ── Handlers CPU ──────────────────────────────────────────────────
  const onScegliWaifuCpu = (w) => { if (fase !== 'playerScegliWaifu') return; setCarteP(w); setTimeLeft(30); setFase('playerScegliStat'); };
  const onScegliStatCpu = (k) => {
    if (fase !== 'playerScegliStat') return;
    setStatScelta(k);
    setStatsUsatePartita(prev => { const a = prev.includes(k) ? prev : [...prev, k]; statsUsateRef.current = a; return a; });
    setTimeLeft(30); setFase('playerScegliDir');
  };
  const onScegliDirCpu = (dir) => {
    if (fase !== 'playerScegliDir') return;
    setDirezione(dir);
    const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
    const cpuW = cpuDisp[Math.floor(Math.random() * cpuDisp.length)];
    setCarteC(cpuW); setFase('cpuRispondeWaifu');
    setTimeout(() => risolviCpu(carteP, cpuW, statScelta, dir), 1200);
  };
  const onScegliWaifuVsCpu = (w) => {
    if (fase !== 'playerScegliWaifuVsCPU') return;
    setCarteP(w); setCarteC(cpuWaifuPending); setStatScelta(cpuStatPending); setDirezione(cpuDirPending);
    setStatsUsatePartita(prev => { const a = prev.includes(cpuStatPending) ? prev : [...prev, cpuStatPending]; statsUsateRef.current = a; return a; });
    setFase('reveal');
    setTimeout(() => risolviCpu(w, cpuWaifuPending, cpuStatPending, cpuDirPending), 1400);
  };

  const risolviCpu = (waifuP, waifuC, stat, dir) => {
    setFase('reveal');
    setTimeout(() => {
      const { modOpp: modP } = applicaAbilitaOutfit(waifuP, waifuP._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
      const { modOpp: modC } = applicaAbilitaOutfit(waifuC, waifuC._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
      const pEff = applicaModificatoriOpp(waifuP, modC, STAT_RANGES_DEFAULT);
      const cEff = applicaModificatoriOpp(waifuC, modP, STAT_RANGES_DEFAULT);
      const valP = pEff[stat]; const valC = cEff[stat];
      let vince = valP === valC ? 'pareggio' : dir === 'piu' ? (valP > valC ? 'player' : 'cpu') : (valP < valC ? 'player' : 'cpu');
      setVincitoreRound(vince);
      // Aggiorna punteggio e colori dopo la fase reveal (non subito)
      setTimeout(() => {
        setPunteggio(prev => {
          const a = { player: prev.player + (vince === 'player' ? 1 : 0), cpu: prev.cpu + (vince === 'cpu' ? 1 : 0) };
          punteggioRef.current = a; return a;
        });
        setRisultatiWaifu(prev => ({
          ...prev,
          [waifuP.id]: vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio',
          [waifuC.id]: vince === 'cpu' ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio',
        }));
        setFase('roundEnd');
      }, 1500);
    }, 1500);
  };

  // ── Handlers PvP ─────────────────────────────────────────────────
  const pvpScegliWaifu = (w) => {
    if (fase !== 'pvpScegliWaifu') return;
    setCarteP(w);
    setTimeLeft(30);
    setFase('pvpScegliStat');
  };

  const pvpScegliStat = (k) => {
    if (fase !== 'pvpScegliStat') return;
    setStatScelta(k);
    setStatsUsatePartita(prev => {
      const a = prev.includes(k) ? prev : [...prev, k];
      statsUsateRef.current = a;
      return a;
    });
    setTimeLeft(30);
    setFase('pvpScegliDir');
  };

  const pvpScegliDir = async (dir) => {
    if (fase !== 'pvpScegliDir') return;
    setDirezione(dir);
    setFase('pvpAttesaAvv');
    setPvpHoScelto(true);
    const roundKey = inSuddenDeathRef.current ? 'sd' : String(roundRef.current);
    try {
      await salvaSceltaPvpRound(codice, myUid, roundKey, {
        waifuId: carteP.id,
        stat: statScelta,
        direzione: dir,
      });
    } catch (e) {
      mostraNotif('Errore sincronizzazione', '#ff3d3d');
    }
  };

  const pvpRispondiWaifu = async (w) => {
    if (fase !== 'pvpScegliWaifuRispondi') return;
    setCarteP(w);
    setFase('pvpAttesaRisoluzione');
    setPvpHoScelto(true);
    const roundKey = inSuddenDeathRef.current ? 'sd' : String(roundRef.current);
    try {
      await salvaSceltaPvpRound(codice, myUid, roundKey, {
        waifuId: w.id,
        stat: null,
        direzione: null,
      });
    } catch (e) {
      mostraNotif('Errore sincronizzazione', '#ff3d3d');
    }
  };

  const pvpScegliWaifuSD = async (w) => {
    if (fase !== 'suddenDeathWaifu' || isCpu) return;
    // In SD chi NON ha turno sceglie waifu
    if (turnoRef.current === 'player') {
      // Io ho il turno: scelgo waifu e invio tutto (stat+dir già impostati)
      setCarteP(w);
      setFase('pvpAttesaAvv');
      setPvpHoScelto(true);
      try {
        await salvaSceltaPvpRound(codice, myUid, 'sd', {
          waifuId: w.id,
          stat: cpuStatPending || statScelta,
          direzione: cpuDirPending || direzione,
        });
      } catch (e) {
        mostraNotif('Errore sincronizzazione', '#ff3d3d');
      }
    } else {
      // Io non ho turno: scelgo solo waifu
      setCarteP(w);
      setFase('pvpAttesaRisoluzione');
      setPvpHoScelto(true);
      try {
        await salvaSceltaPvpRound(codice, myUid, 'sd', {
          waifuId: w.id,
          stat: null,
          direzione: null,
        });
      } catch (e) {
        mostraNotif('Errore sincronizzazione', '#ff3d3d');
      }
    }
  };

  const prossimoRound = () => {
    if (isCpu) {
      const pt = punteggioRef.current;
      const r = roundRef.current;
      if (r >= 5 || pt.player >= 3 || pt.cpu >= 3) {
        if (pt.player === pt.cpu) avviaSuddenDeath();
        else fineBattaglia(pt.player > pt.cpu);
        return;
      }
      const nr = r + 1;
      const ts = primoTurnoRef.current === 'player' ? (nr % 2 === 1 ? 'player' : 'cpu') : (nr % 2 === 1 ? 'cpu' : 'player');
      setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null); setVincitoreRound(null);
      setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
      setRound(nr);
      roundRef.current = nr;
      setTurno(ts);
      turnoRef.current = ts;
      setTimeLeft(30);
      setFase(ts === 'player' ? 'playerScegliWaifu' : 'cpuSceglieTutto');
    } else {
      _pvpPremutoProsegui();
    }
  };

  const _pvpPremutoProsegui = async () => {
    if (pvpHoPremutoProsegui) return;
    setPvpHoPremutoProsegui(true);
    setFase('pvpAttesaProsegui');
    setTimeLeft(30);
    const roundKey = inSuddenDeathRef.current ? 'sd' : String(roundRef.current);
    try {
      await salvaProseguiTurnoRound(codice, myUid, roundKey);
    } catch (e) {
      mostraNotif('Errore sincronizzazione', '#ff3d3d');
    }
  };

  const avviaSuddenDeath = () => {
    setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setInSuddenDeath(true);
    inSuddenDeathRef.current = true;
    pvpScriviRef.current = ''; // reset per il nuovo roundKey 'sd'
    pvpRoundRisoltoRef.current = '';
    pvpProseguiEseguitoRef.current = '';
    const stats = statsUsateRef.current;
    const pool = STATS_BATTAGLIA.filter(s => !stats.includes(s.key));
    const stat = (pool.length > 0 ? pool : STATS_BATTAGLIA)[Math.floor(Math.random() * (pool.length || STATS_BATTAGLIA.length))];
    const dir = Math.random() < 0.5 ? 'piu' : 'meno';

    if (isCpu) {
      const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
      const cpuW = cpuDisp.length > 0 ? cpuDisp[Math.floor(Math.random() * cpuDisp.length)] : mazzoC[Math.floor(Math.random() * mazzoC.length)];
      setCpuWaifuPending(cpuW); setCpuStatPending(stat.key); setCpuDirPending(dir);
      setCarteC(cpuW); setTimeLeft(30); setFase('suddenDeathWaifu');
    } else {
      // PvP SD: l'attaccante ha il turno (regola fissa, evita desync)
      const turnoSD = sonoAttaccante ? 'player' : 'cpu';
      setTurno(turnoSD);
      turnoRef.current = turnoSD;
      setPvpHoScelto(false);
      setCpuStatPending(stat.key); setCpuDirPending(dir);
      setStatScelta(stat.key); setDirezione(dir);
      setTimeLeft(30);
      setFase('suddenDeathWaifu');
    }
  };

  // Sudden death vs CPU
  const onScegliWaifuSD = (w) => {
    if (fase !== 'suddenDeathWaifu' || !isCpu) return;
    setCarteP(w); setStatScelta(cpuStatPending); setDirezione(cpuDirPending); setFase('suddenDeathReveal');
    setTimeout(() => {
      const valP = w[cpuStatPending]; const valC = cpuWaifuPending[cpuStatPending];
      let vince = valP === valC ? 'pareggio' : cpuDirPending === 'piu' ? (valP > valC ? 'player' : 'cpu') : (valP < valC ? 'player' : 'cpu');
      setVincitoreRound(vince);
      if (vince === 'pareggio') setTimeout(() => avviaSuddenDeath(), 2500);
      else setTimeout(() => fineBattaglia(vince === 'player'), 2500);
    }, 1800);
  };

  const fineBattaglia = (vittoria) => {
    const vincitoreUid = vittoria ? myUid : avversarioUid;
    // Salva risultato e attendi che l'utente prema il pulsante (non chiamiamo subito onBattagliaFinita
    // altrimenti Firestore azzerebbe battagliaCorrente e smonterebbe questo componente prima del popup)
    setRisultatoFinale({ vittoria, punteggioFinale: punteggioRef.current, vincitoreUid });
    setFase('gameEnd');
  };

  // ── Attesa mazzo avversario ────────────────────────────────────────
  const [attesaMazzoAvv, setAttesaMazzoAvv] = useState(false);
  const [mazzoSalvato, setMazzoSalvato] = useState(false);

  const _avviaBattaglia = (mazzoAvversario, attaccante) => {
    setMazzoC(mazzoAvversario);
    setAttesaMazzoAvv(false);
    setModoBattaglia(false);
    setIniziata(true);
    setPunteggio({ player: 0, cpu: 0 }); punteggioRef.current = { player: 0, cpu: 0 };
    setRound(1); roundRef.current = 1;
    setRisultatiWaifu({}); setStatsUsatePartita([]); statsUsateRef.current = [];
    setCarteP(null); setCarteC(null); setStatScelta(null);
    setDirezione(null); setVincitoreRound(null);
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setCoinResult(null);
    setInSuddenDeath(false); inSuddenDeathRef.current = false;
    setPrimoTurno(null); primoTurnoRef.current = null;
    setTurno(null); turnoRef.current = null;
    pvpScriviRef.current = '';
    pvpRoundRisoltoRef.current = '';
    pvpProseguiEseguitoRef.current = '';
    setPvpHoScelto(false);
    setPvpHoPremutoProsegui(false);
    setFase('coin');
    if (attaccante) {
      salvaPrimoTurnoPvp(codice, myUid).catch(() => {});
    }
  };

  // Costruisce un team arena da IDs usando il catalog raw + battleStats
  // Supporta team da 3–5 waifu (pick phase seleziona 3 da roster di 5)
  const buildArenaTeam = (waifuIds, useCollData = false) =>
    (waifuIds ?? []).map(id => {
      const rawW = waifuCat.find(x => x.id === id);
      if (!rawW) return null;
      const collData = useCollData ? (collezione?.waifu?.[id] ?? null) : null;
      return initBattleWaifu(rawW, collData);
    }).filter(Boolean);

  // Quando arriva il roster5 dell'avversario (PvP pick phase), avvia la PickPhase.
  // Guardia attesaRoster5Avv=true: si attiva SOLO mentre siamo in attesa del roster avversario.
  // Questo evita il bug "roster avversario vuoto" che si verificava quando il listener
  // sparava l'effetto prima che il giocatore avesse inviato il proprio roster5.
  useEffect(() => {
    if (!attesaRoster5Avv || isCpu) return;
    const roster5Partita = partita?.battagliaCorrente?.roster5 || {};
    const roster5AvvIds = roster5Partita[avversarioUid];
    if (!roster5AvvIds || roster5AvvIds.length < 1) return;
    // Entrambi i roster5 pronti → costruisci il roster avversario e mostra la pick phase
    const rosterE = roster5AvvIds.map(id => waifuCat.find(x => x.id === id)).filter(Boolean);
    if (rosterE.length < 1) return; // waifu non trovate nel catalogo locale
    setPickRoster5E(rosterE);
    setPickPhaseAttiva(true);
    setAttesaRoster5Avv(false);
  }, [partita?.battagliaCorrente?.roster5, attesaRoster5Avv]); // eslint-disable-line

  // Quando arriva il mazzo avversario (PvP in attesa), avvia l'arena
  useEffect(() => {
    if (!attesaMazzoAvv || isCpu) return;
    const mazziPartita = partita?.battagliaCorrente?.mazzi || {};
    const mazzoAvvIds = mazziPartita[avversarioUid];
    // Picks sono 3 waifu — controllo corretto: >= 3
    if (!mazzoAvvIds || mazzoAvvIds.length < 3) return;

    const eTeam = buildArenaTeam(mazzoAvvIds, false);
    if (eTeam.length < 1) return;

    // Reset atomico: arenaTurnoRef e pvpWaiting azzerati prima di attivare l'arena
    // per evitare race condition dove il listener vede turno=0 ma l'arena non è ancora attiva.
    arenaTurnoRef.current = 0;
    arenaVincitoreRef.current = null;
    setPvpOpponentMove(null);
    setPvpWaiting(false);
    // arenaPlayerTeam è già stato impostato in handlePickConfirm
    setArenaEnemyTeam(eTeam);
    // L'attaccante genera e pubblica il seed RNG per la battaglia (entrambi i device usano lo stesso seed)
    if (sonoAttaccante) {
      const newSeed = Math.floor(Math.random() * 0x7FFFFFFF);
      setPvpBattleSeed(newSeed);
      inizializzaArenaSeedRng(codice, newSeed).catch(() => {});
    }
    setArenaAttiva(true);
    setAttesaMazzoAvv(false);
  }, [partita?.battagliaCorrente?.mazzi, attesaMazzoAvv]); // eslint-disable-line

  // [WAIFU CHAMPIONS REFACTOR] — launches PickPhase instead of arena directly
  const confermaEAvvia = async () => {
    let waifuIds;
    if (teamSel && teamSel !== 'manuale') {
      const team = teams[teamSel];
      waifuIds = (team?.waifu ?? []);
    } else {
      waifuIds = waifuSel;
    }
    if (waifuIds.length < 5) { mostraNotif('Seleziona esattamente 5 waifu per la Pick Phase!', '#ff3d3d'); return; }

    // Build player roster: raw waifu docs with livello from collection, up to 5
    const rosterP = waifuIds.slice(0, 5).map(id => {
      const raw = waifuCat.find(x => x.id === id);
      if (!raw) return null;
      return { ...raw, livello: collezione?.waifu?.[id]?.livello ?? 1 };
    }).filter(Boolean);

    if (rosterP.length < 3) { mostraNotif('Team insufficiente!', '#ff3d3d'); return; }

    // Build enemy roster
    let rosterE;
    if (isCpu) {
      const playerIds = new Set(waifuIds);
      const pool = waifuCat.filter(w => !playerIds.has(w.id));
      rosterE = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
    } else {
      // PvP: show opponent's roster if they've already submitted their mazzo
      const avvIds = (partita?.battagliaCorrente?.mazzi?.[avversarioUid] ?? []).slice(0, 5);
      rosterE = avvIds.map(id => waifuCat.find(x => x.id === id)).filter(Boolean);
    }

    setPickRoster5P(rosterP);
    mioRoster5Ref.current = rosterP;

    if (!isCpu) {
      // PvP online: salva il roster5 su Firestore e aspetta quello dell'avversario
      try {
        await salvaRoster5Battaglia(codice, myUid, rosterP.map(w => w.id));
      } catch (e) {
        mostraNotif('Errore salvataggio roster', '#ff3d3d');
        return;
      }
      // Se il roster5 avversario è già in Firestore, mostra subito la pick phase
      const roster5Partita = partita?.battagliaCorrente?.roster5 || {};
      const roster5AvvIds = roster5Partita[avversarioUid];
      if (roster5AvvIds && roster5AvvIds.length >= 1) {
        const rosterEFromDb = roster5AvvIds.map(id => waifuCat.find(x => x.id === id)).filter(Boolean);
        setPickRoster5E(rosterEFromDb);
        setPickPhaseAttiva(true);
      } else {
        // Aspetta che l'avversario invii il suo roster5
        setPickRoster5E(rosterE); // potrebbe essere vuoto, verrà aggiornato dal listener
        setAttesaRoster5Avv(true);
      }
    } else {
      setPickRoster5E(rosterE);
      setPickPhaseAttiva(true);
    }
    setModoBattaglia(false);
  };

  // Called by PickPhase when player(s) have confirmed their picks
  const handlePickConfirm = async (playerTeam, enemyTeam) => {
    setPickPhaseAttiva(false);
    if (isCpu) {
      arenaVincitoreRef.current = null;
      setArenaPlayerTeam(playerTeam);
      setArenaEnemyTeam(enemyTeam);
      setArenaAttiva(true);
    } else {
      // PvP: mostra SUBITO la schermata di attesa prima di qualsiasi await,
      // così il render non cade nel vecchio sistema di battaglia (coin flip ecc.)
      setArenaPlayerTeam(playerTeam);
      setAttesaMazzoAvv(true); // schermata attesa visibile immediatamente
      setPickPhaseAttiva(false);

      // Salva le 3 picks su Firestore
      const mazzoIds = playerTeam.map(w => w.id ?? w._id).filter(Boolean);
      try {
        await salvaMazzoBattaglia(codice, myUid, mazzoIds);
        setMazzoSalvato(true);
      } catch (e) {
        mostraNotif('Errore salvataggio mazzo', '#ff3d3d');
        setAttesaMazzoAvv(false);
        return;
      }

      // Dopo il salvataggio, controlla se l'avversario aveva già scelto
      // (potrebbe essere già in Firestore se era il secondo a scegliere)
      const mazziPartita = partita?.battagliaCorrente?.mazzi || {};
      const mazzoAvvIds = mazziPartita[avversarioUid];
      if (mazzoAvvIds && mazzoAvvIds.length >= 3) {
        // L'avversario aveva già scelto: avvia l'arena subito
        const eTeam = buildArenaTeam(mazzoAvvIds, false);
        // Reset atomico prima di attivare l'arena (evita race condition)
        arenaTurnoRef.current = 0;
        arenaVincitoreRef.current = null;
        setPvpOpponentMove(null);
        setPvpWaiting(false);
        setArenaEnemyTeam(eTeam);
        // L'attaccante genera e pubblica il seed RNG per la battaglia (entrambi i device usano lo stesso seed)
        if (sonoAttaccante) {
          const newSeed = Math.floor(Math.random() * 0x7FFFFFFF);
          setPvpBattleSeed(newSeed);
          inizializzaArenaSeedRng(codice, newSeed).catch(() => {});
        }
        setArenaAttiva(true);
        setAttesaMazzoAvv(false);
      }
      // Altrimenti: attesaMazzoAvv=true rimane e il useEffect gestirà l'arrivo
    }
  };

  const nomeAvversario = isCpu ? 'CPU' : (avversario?.nomeImpero || 'Avversario');
  const coloreAvversario = isCpu ? '#666' : (avversario?.coloreImpero || '#ff3d3d');

  // ── Attesa mazzo 3-waifu avversario (PvP: player ha scelto ma avversario no) ──
  // Nota: questo check è a livello TOP-LEVEL, fuori da modoBattaglia, per essere
  // visibile anche dopo che confermaEAvvia ha impostato modoBattaglia=false.
  if (attesaMazzoAvv && !arenaAttiva && !pickPhaseAttiva) {
    return (
      <div className="fade-in">
        <div style={{
          background: 'rgba(10,7,38,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '0.8px solid rgba(167,139,250,0.2)',
          borderRadius: 20,
          padding: 28,
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>
            PICK PHASE
          </div>
          <div style={{ fontSize: 36, margin: '16px 0' }}>⚔️</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#b6aed6', marginBottom: 6 }}>
            Le tue 3 waifu sono pronte.
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(167,139,250,0.6)', marginBottom: 20 }}>
            In attesa che <span style={{ color: coloreAvversario, fontWeight: 700 }}>{nomeAvversario}</span> scelga il suo team…
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', background: '#a78bfa',
                animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
              }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
          <button onClick={() => { setAttesaMazzoAvv(false); onBattagliaFinita(null); }} style={btnStyle('#666', true)}>
            ANNULLA
          </button>
        </div>
      </div>
    );
  }

  // [WAIFU CHAMPIONS REFACTOR] — PickPhase before arena
  if (pickPhaseAttiva) {
    const battleCtx = { terrSel: terrData, nomeImperoAvversario: nomeAvversario };
    return (
      <PickPhase
        roster5P={pickRoster5P}
        roster5E={pickRoster5E}
        isCpu={isCpu}
        isOnlinePvP={!isCpu}
        battleCtx={battleCtx}
        onConfirm={handlePickConfirm}
      />
    );
  }

  // ── Attesa roster5 avversario (PvP: player ha cliccato BATTAGLIA! ma avversario non ancora) ──
  if (attesaRoster5Avv) {
    return (
      <div className="fade-in">
        <div style={{
          background: 'rgba(10,7,38,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '0.8px solid rgba(167,139,250,0.2)',
          borderRadius: 20,
          padding: 28,
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>
            PICK PHASE
          </div>
          <div style={{ fontSize: 36, margin: '16px 0' }}>⚔️</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#b6aed6', marginBottom: 6 }}>
            Il tuo roster è pronto.
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(167,139,250,0.6)', marginBottom: 20 }}>
            In attesa che <span style={{ color: coloreAvversario }}>{nomeAvversario}</span> scelga il suo roster…
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', background: '#a78bfa',
                animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
              }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
          <button onClick={() => { setAttesaRoster5Avv(false); setModoBattaglia(false); onBattagliaFinita(null); }} style={btnStyle('#666', true)}>
            ANNULLA
          </button>
        </div>
      </div>
    );
  }

  // ── Arena WaifuBattleArena attiva ─────────────────────────────────
  if (arenaAttiva) {
    const myGiocatore = partita?.giocatori?.[myUid];
    const battleCtx = {
      terrSel: terrData,
      nomeImperoAvversario: nomeAvversario,
      sonoAttaccante,
      nomeImpero: myGiocatore?.nomeImpero || profilo?.nomeImpero || 'Tu',
    };
    return (
      <WaifuBattleArena
        playerTeam={arenaPlayerTeam}
        enemyTeam={arenaEnemyTeam}
        battleCtx={battleCtx}
        onBattleResult={(isVictory) => {
          arenaVincitoreRef.current = isVictory ? myUid : avversarioUid;
        }}
        onExit={() => {
          setArenaAttiva(false);
          const vincUid = arenaVincitoreRef.current ?? avversarioUid;
          onBattagliaFinita(vincUid);
        }}
        isPvP={!isCpu}
        pvpOpponentMove={pvpOpponentMove}
        pvpWaiting={pvpWaiting}
        onPvPMoveSubmit={!isCpu ? handlePvPMoveSubmit : undefined}
        onPvPTurnAdvance={!isCpu ? handlePvPTurnAdvance : undefined}
        pvpBattleSeed={pvpBattleSeed}
      />
    );
  }

  // ── Selezione team ────────────────────────────────────────────────
  if (modoBattaglia) {
    if (attesaMazzoAvv) {
      return (
        <div className="fade-in">
          <div style={{
            background: 'rgba(10,7,38,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '0.8px solid rgba(255,133,182,0.2)',
            borderRadius: 20,
            padding: 28,
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700, color: '#ff85b6', marginBottom: 12 }}>BATTAGLIA PER {terrData?.nome}</div>
            <div style={{ fontSize: 36, margin: '20px 0' }}>⏳</div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 700, color: '#f5c560', letterSpacing: 1, marginBottom: 8 }}>
              MAZZO INVIATO!
            </div>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>
              In attesa che <span style={{ color: coloreAvversario }}>{nomeAvversario}</span> scelga il suo team…
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: coloreAvversario,
                  animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
            <div style={{ marginTop: 24 }}>
              <button onClick={() => { setAttesaMazzoAvv(false); setMazzoSalvato(false); onBattagliaFinita(null); }} style={btnStyle('#666', true)}>
                ANNULLA
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Esattamente 5 waifu richieste per la Pick Phase
    const teamSavedSize = teamSel && teamSel !== 'manuale' ? (teams[teamSel]?.waifu?.length ?? 0) : 0;
    const canConfirm = teamSel && teamSel !== 'manuale'
      ? (teamSavedSize >= 5)   // saved team deve avere almeno 5 waifu
      : waifuSel.length === 5; // selezione manuale: esattamente 5
    return (
      <div className="fade-in">
        <div style={{
          background: 'rgba(10,7,38,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '0.8px solid rgba(255,133,182,0.2)',
          borderRadius: 20,
          padding: 20,
        }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, fontWeight: 700, color: '#ff85b6', marginBottom: 12 }}>BATTAGLIA PER {terrData?.nome}</div>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
              vs <span style={{ color: coloreAvversario }}>{nomeAvversario}</span>
              {!isCpu && (
                <span style={{ display: 'block', marginTop: 4, color: '#f5c560', fontSize: 9 }}>
                  ⚡ SFIDA CONTRO GIOCATORE REALE
                </span>
              )}
            </div>
          </div>
          {Object.keys(teams).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#6cf0e0', letterSpacing: 2, marginBottom: 6, textAlign: 'center', fontFamily: "'Saira Condensed', Saira, sans-serif" }}>TEAM SALVATI</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Object.entries(teams).map(([id, team]) => (
                  <button key={id} onClick={() => { setTeamSel(id); setWaifuSel([]); }} style={{
                    padding: '8px 16px', background: teamSel === id ? 'linear-gradient(rgba(108,240,224,0.25), rgba(108,240,224,0.08))' : 'rgba(255,255,255,0.03)',
                    color: teamSel === id ? '#6cf0e0' : '#eee8dc', border: `0.8px solid ${teamSel === id ? 'rgba(108,240,224,0.5)' : 'rgba(108,240,224,0.15)'}`,
                    borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                  }}>{team.nome} ({team.waifu.length})</button>
                ))}
                <button onClick={() => setTeamSel('manuale')} style={{
                  padding: '8px 16px', background: teamSel === 'manuale' ? 'linear-gradient(rgba(245,197,96,0.25), rgba(245,197,96,0.08))' : 'rgba(255,255,255,0.03)',
                  color: teamSel === 'manuale' ? '#f5c560' : '#eee8dc', border: `0.8px solid ${teamSel === 'manuale' ? 'rgba(245,197,96,0.5)' : 'rgba(245,197,96,0.15)'}`,
                  borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                }}>✋ MANUALE</button>
              </div>
            </div>
          )}
          {(teamSel === 'manuale' || Object.keys(teams).length === 0) && (
            <div>
              <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: "'Saira Condensed', Saira, sans-serif", textAlign: 'center', marginBottom: 8 }}>SCEGLI IL TUO ROSTER (esattamente 5 waifu) — {waifuSel.length}/5</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                {waifuDisponibili.map(w => {
                  const sel = waifuSel.includes(w.id);
                  return (
                    <div key={w.id} onClick={() => {
                      if (sel) setWaifuSel(waifuSel.filter(x => x !== w.id));
                      else if (waifuSel.length < 5) setWaifuSel([...waifuSel, w.id]);
                    }} style={{ cursor: 'pointer', opacity: sel ? 1 : 0.5, border: sel ? '2px solid #6cf0e0' : '2px solid transparent', borderRadius: 8 }}>
                      <CartaWaifu waifu={w} dimensione="mini" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {teamSel && teamSel !== 'manuale' && teams[teamSel] && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
              {teams[teamSel].waifu.map(id => { const w = waifuCat.find(x => x.id === id); return w ? <CartaWaifu key={id} waifu={w} dimensione="piccola" /> : null; })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={() => onBattagliaFinita(null)} style={btnStyle('#666', true)}>ANNULLA</button>
            <button onClick={confermaEAvvia} disabled={!canConfirm} style={btnStyle('#ff2d78')}>⚔ BATTAGLIA!</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Coin flip ─────────────────────────────────────────────────────
  if (fase === 'coin') {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 14, color: '#9b59ff', fontFamily: 'Orbitron', marginBottom: 16 }}>
          vs <span style={{ color: coloreAvversario }}>{nomeAvversario}</span>
        </div>
        <style>{`@keyframes coinSpin { 0% { transform: rotateY(0); } 100% { transform: rotateY(2160deg); } } .coin-spin { animation: coinSpin 1.6s ease-out forwards; }`}</style>
        <div className="coin-spin" style={{ width: 100, height: 100, margin: '0 auto', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffd666, #c77d0a)', boxShadow: '0 0 40px rgba(245,166,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontFamily: 'Orbitron', color: '#3a1c00', fontWeight: 700 }}>♛</div>
        <div style={{ marginTop: 20, fontFamily: 'Orbitron', letterSpacing: 3, fontSize: 14, color: '#f5a623' }}>
          {coinResult ? (coinResult === 'player' ? '🎯 INIZI TU!' : `🎯 INIZIA ${nomeAvversario}`) : '🪙 LANCIO...'}
        </div>
      </div>
    );
  }

  // ── Fine battaglia ────────────────────────────────────────────────
  if (fase === 'gameEnd' && risultatoFinale) {
    const vittoria = risultatoFinale.vittoria;
    const pFin = risultatoFinale.punteggioFinale;
    const coloreRisultato = vittoria ? '#00e676' : '#ff3d3d';

    let testoTerritorio;
    if (vittoria) {
      testoTerritorio = sonoAttaccante ? `🏴 Hai conquistato ${terrData?.nome}!` : `🛡 Hai difeso ${terrData?.nome}!`;
    } else {
      testoTerritorio = sonoAttaccante ? `❌ Non hai conquistato ${terrData?.nome}` : `💔 Hai perso ${terrData?.nome}`;
    }

    // Popup con timer locale indipendente (5s) — non influenzato dall'altro giocatore
    return (
      <PopupGameEnd
        vittoria={vittoria}
        pFin={pFin}
        coloreRisultato={coloreRisultato}
        testoTerritorio={testoTerritorio}
        nomeAvversario={nomeAvversario}
        coloreAvversario={coloreAvversario}
        onProcedi={() => onBattagliaFinita(risultatoFinale.vincitoreUid)}
      />
    );
  }

  // ── Battaglia attiva ──────────────────────────────────────────────
  const fasiBattagliaAttive = isCpu
    ? ['playerScegliWaifu', 'playerScegliStat', 'playerScegliDir', 'cpuRispondeWaifu', 'cpuSceglieTutto', 'playerScegliWaifuVsCPU', 'reveal', 'roundEnd', 'suddenDeathWaifu', 'suddenDeathReveal']
    : ['pvpScegliWaifu', 'pvpScegliStat', 'pvpScegliDir', 'pvpAttesaAvv', 'pvpScegliWaifuRispondi', 'pvpAttesaRisoluzione', 'reveal', 'roundEnd', 'pvpAttesaProsegui', 'suddenDeathWaifu', 'suddenDeathReveal'];
  if (!fasiBattagliaAttive.includes(fase)) return null;

  const waifuPDisp = inSuddenDeath ? mazzoP.filter(w => w.id !== carteP?.id) : mazzoP.filter(w => !risultatiWaifu[w.id]);
  const statsDisp = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));
  const statInfo = STATS_BATTAGLIA.find(s => s.key === statScelta);
  const showTimer = FASI_TIMER_ACTIVE.includes(fase);

  // Helpers stato waifu (come vs CPU)
  const getStatoWaifu = (id) => {
    const r = risultatiWaifu[id];
    if (!r) return 'disponibile';
    return r; // 'vinta' | 'persa' | 'pareggio'
  };
  const getColoreBordo = (stato) => {
    if (stato === 'disponibile') return 'rgba(255,255,255,0.08)';
    if (stato === 'vinta') return '#00e676';
    if (stato === 'persa') return '#ff3d3d';
    return '#ffd666';
  };
  const getIconaStato = (stato) => {
    if (stato === 'vinta') return '✅';
    if (stato === 'persa') return '❌';
    if (stato === 'pareggio') return '🤝';
    return '';
  };

  // Chi deve scegliere waifu in questo momento
  const pvpDeveScegliereWaifu = ['pvpScegliWaifu', 'pvpScegliWaifuRispondi', 'suddenDeathWaifu'].includes(fase);

  // Fase "attesa avversario" (PvP)
  const pvpInAttesa = fase === 'pvpAttesaAvv' || fase === 'pvpAttesaRisoluzione';

  const labelFase = () => {
    if (!isCpu) {
      if (fase === 'pvpScegliWaifu') return '👇 Scegli la tua waifu';
      if (fase === 'pvpScegliStat') return '🎯 Scegli la statistica';
      if (fase === 'pvpScegliDir') return '📊 Scegli la direzione';
      if (fase === 'pvpAttesaAvv') return `⏳ In attesa di ${nomeAvversario}…`;
      if (fase === 'pvpScegliWaifuRispondi') return `👇 Scegli la tua waifu (${nomeAvversario} sta scegliendo…)`;
      if (fase === 'pvpAttesaRisoluzione') return `⏳ In attesa di ${nomeAvversario}…`;
      if (fase === 'roundEnd') return '🏁 Risultato round';
      if (fase === 'pvpAttesaProsegui') return `⏳ In attesa che ${nomeAvversario} prosegua…`;
      if (fase === 'suddenDeathWaifu') return turno === 'player' ? '⚡ SUDDEN DEATH — Scegli waifu!' : '⚡ SUDDEN DEATH — Scegli waifu!';
    }
    if (fase === 'playerScegliWaifu') return '👇 Scegli la tua waifu';
    if (fase === 'playerScegliStat') return '🎯 Scegli la statistica';
    if (fase === 'playerScegliDir') return '📊 Scegli la direzione';
    if (fase === 'cpuRispondeWaifu') return `🤖 ${nomeAvversario} sceglie...`;
    if (fase === 'cpuSceglieTutto') return `🤖 ${nomeAvversario} sta decidendo...`;
    if (fase === 'playerScegliWaifuVsCPU') return '👇 Scegli la tua waifu';
    if (fase === 'reveal') return '⚡ Risoluzione...';
    if (fase === 'suddenDeathWaifu') return '⚡ SUDDEN DEATH — Scegli!';
    if (fase === 'suddenDeathReveal') return '⚡ Risoluzione Sudden Death...';
    return '';
  };

  return (
    <div className="fade-in">
      {/* ── Header punteggio ── */}
      <div style={{
        background: 'rgba(10,7,38,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.8px solid rgba(255,133,182,0.2)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: "'Saira Condensed', Saira, sans-serif" }}>{profilo.nomeImpero}</div>
            <div style={{ fontSize: 28, color: '#00e676', fontFamily: "'Unbounded', sans-serif", fontWeight: 700 }}>{punteggio.player}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Unbounded', sans-serif", letterSpacing: 1, fontSize: 10, fontWeight: 700, color: '#ff85b6' }}>
              {inSuddenDeath ? '⚡ SUDDEN DEATH' : `ROUND ${round}/5`}
            </div>
            <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: "'Saira Condensed', Saira, sans-serif" }}>
              {turno === 'player' ? 'TUO TURNO' : `TURNO ${nomeAvversario.toUpperCase()}`}
            </div>
            {showTimer && (
              <div style={{ fontSize: 20, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: "'Unbounded', sans-serif", fontWeight: 700, marginTop: 2 }}>
                ⏱ {timeLeft}s
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: "'Saira Condensed', Saira, sans-serif" }}>{nomeAvversario}</div>
            <div style={{ fontSize: 28, color: coloreAvversario, fontFamily: "'Unbounded', sans-serif", fontWeight: 700 }}>{punteggio.cpu}</div>
          </div>
        </div>
        {labelFase() && (
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: '#ffd666', fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>
            {labelFase()}
          </div>
        )}
        {/* HUD stat usate */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {STATS_BATTAGLIA.map(s => {
            const usata = statsUsatePartita.includes(s.key);
            return (
              <div key={s.key} style={{
                padding: '2px 7px', borderRadius: 5, fontSize: 8, fontFamily: "'Saira Condensed', Saira, sans-serif",
                background: usata ? 'rgba(255,61,61,0.08)' : 'rgba(0,230,118,0.10)',
                border: `1px solid ${usata ? '#ff3d3d30' : '#00e67630'}`,
                color: usata ? '#ff3d3d50' : '#00e676',
                textDecoration: usata ? 'line-through' : 'none',
                opacity: usata ? 0.4 : 0.9,
              }}>
                {s.icon} {s.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Territorio in gioco */}
      {terrData && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <Chip colore="#ff2d78" size="sm">⚔ {terrData.nome} — {NOMI_CONTINENTI[terrData.cont]}</Chip>
        </div>
      )}

      {/* ── Campo di battaglia: carte ── */}
      <div style={{
        background: 'rgba(10,7,38,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.8px solid rgba(167,139,250,0.15)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', flexWrap: 'nowrap', gap: 8 }}>
          {/* Carta Player */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.4, marginBottom: 4, fontFamily: 'Orbitron' }}>TU</div>
            {carteP
              ? <div className="battle-carta-scelta"><CartaWaifu waifu={carteP} dimensione="piccola"
                  evidenziaStat={(['reveal', 'roundEnd', 'pvpAttesaProsegui', 'suddenDeathReveal'].includes(fase)) ? statScelta : null}
                  perdente={fase === 'roundEnd' && vincitoreRound === 'cpu'} /></div>
              : <div style={{ width: 130, height: 195, border: '1px dashed rgba(255,45,120,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,45,120,0.4)', fontFamily: 'Orbitron', fontSize: 9 }} className="pulse">SCEGLI</div>
            }
          </div>

          {/* Centro VS + stat/risultato */}
          <div style={{ textAlign: 'center', minWidth: 100, flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontFamily: 'Orbitron', background: 'linear-gradient(135deg, #ff2d78, #9b59ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>VS</div>
            {(['reveal', 'roundEnd', 'pvpAttesaProsegui', 'suddenDeathReveal'].includes(fase)) && statScelta && (
              <div className="fade-up" style={{ marginTop: 10, padding: 8, background: 'rgba(245,166,35,0.06)', borderRadius: 8, border: '1px solid rgba(245,166,35,0.2)' }}>
                <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>STAT</div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#f5a623', marginTop: 2 }}>
                  {statInfo?.icon} {statInfo?.label}
                </div>
                <div style={{ fontSize: 11, marginTop: 2, color: direzione === 'piu' ? '#00e676' : '#ff3d3d' }}>
                  {direzione === 'piu' ? '▲ PIÙ' : '▼ MENO'}
                </div>
              </div>
            )}
            {(fase === 'reveal' || fase === 'roundEnd' || fase === 'pvpAttesaProsegui') && vincitoreRound && (
              <div className="fade-up" style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? coloreAvversario : '#ffd666' }}>
                  {vincitoreRound === 'player' ? '✅ VINTO!' : vincitoreRound === 'cpu' ? '❌ PERSO' : '🤝 PARI'}
                </div>
                {carteP && carteC && statScelta && (
                  <div style={{ fontSize: 10, marginTop: 4, color: 'rgba(238,232,220,0.7)' }}>
                    Tu: <strong>{carteP[statScelta]}</strong> vs <strong>{carteC[statScelta]}</strong>
                  </div>
                )}
              </div>
            )}
            {fase === 'suddenDeathReveal' && vincitoreRound && (
              <div className="fade-up" style={{ marginTop: 8 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? coloreAvversario : '#ffd666' }}>
                  {vincitoreRound === 'player' ? '✅ VINCI!' : vincitoreRound === 'cpu' ? '❌ PERDI' : '🤝 ANCORA!'}
                </div>
                {carteP && carteC && statScelta && (
                  <div style={{ fontSize: 10, marginTop: 4 }}>Tu: <strong>{carteP[statScelta]}</strong> vs <strong>{carteC[statScelta]}</strong></div>
                )}
              </div>
            )}
            {pvpInAttesa && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: coloreAvversario, animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }} />
                  ))}
                </div>
                <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
              </div>
            )}
          </div>

          {/* Carta Avversario */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.4, marginBottom: 4, fontFamily: 'Orbitron' }}>{nomeAvversario.toUpperCase()}</div>
            {carteC
              ? ((['reveal', 'roundEnd', 'pvpAttesaProsegui', 'suddenDeathReveal'].includes(fase))
                  ? <div className="battle-carta-scelta"><CartaWaifu waifu={carteC} dimensione="piccola"
                      evidenziaStat={statScelta}
                      perdente={fase === 'roundEnd' && vincitoreRound === 'player'}
                      censurata={carteC.hot === true && !profilo?.hardPass} /></div>
                  : <div style={{ width: 130, height: 195, background: `linear-gradient(160deg, rgba(${parseInt(coloreAvversario.slice(1,3),16)},${parseInt(coloreAvversario.slice(3,5),16)},${parseInt(coloreAvversario.slice(5,7),16)},0.05), #06030f)`, border: `1px solid ${coloreAvversario}40`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: `${coloreAvversario}80` }}>?</div>
                )
              : <div style={{ width: 130, height: 195, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'Orbitron' }}>ATTESA</div>
            }
          </div>
        </div>
      </div>

      {/* ── Mazzo del player (sempre visibile con stati) ── */}
      <div style={{
        background: 'rgba(10,7,38,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.8px solid rgba(167,139,250,0.15)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: '#ff85b6', textAlign: 'center', marginBottom: 8, fontFamily: "'Saira Condensed', Saira, sans-serif" }}>
          {pvpDeveScegliereWaifu || (!isCpu && ['playerScegliWaifu', 'playerScegliWaifuVsCPU', 'suddenDeathWaifu'].includes(fase))
            ? '👇 SCEGLI LA TUA WAIFU' : 'IL TUO TEAM'}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {mazzoP.map(w => {
            const stato = getStatoWaifu(w.id);
            const usata = stato !== 'disponibile';
            let cliccabile = false;
            let handler = () => {};
            if (!isCpu) {
              // In suddenDeathWaifu tutti i round sono già finiti → risultatiWaifu pieno,
              // ma in SD il giocatore deve poter scegliere qualsiasi waifu del mazzo.
              const inSD = fase === 'suddenDeathWaifu';
              cliccabile = inSD
                ? pvpDeveScegliereWaifu && !pvpHoScelto
                : pvpDeveScegliereWaifu && !usata;
              handler = () => {
                if (!cliccabile) return;
                if (fase === 'pvpScegliWaifu') pvpScegliWaifu(w);
                else if (fase === 'pvpScegliWaifuRispondi') pvpRispondiWaifu(w);
                else if (fase === 'suddenDeathWaifu') {
                  pvpScegliWaifuSD(w); // handles both turno and non-turno cases
                }
              };
            } else {
              const playerDeveScegliereWaifu = ['playerScegliWaifu', 'playerScegliWaifuVsCPU', 'suddenDeathWaifu'].includes(fase);
              // In SD vs CPU: tutte le waifu sono rieleggibili
              cliccabile = fase === 'suddenDeathWaifu'
                ? playerDeveScegliereWaifu
                : playerDeveScegliereWaifu && !usata;
              handler = () => {
                if (!cliccabile) return;
                if (fase === 'playerScegliWaifu') onScegliWaifuCpu(w);
                else if (fase === 'playerScegliWaifuVsCPU') onScegliWaifuVsCpu(w);
                else if (fase === 'suddenDeathWaifu') onScegliWaifuSD(w);
              };
            }
            // In SD tutte le waifu appaiono disponibili (risultatiWaifu non conta)
            const inSD = inSuddenDeath && fase === 'suddenDeathWaifu';
            const mostraUsata = usata && !inSD;
            return (
              <div key={w.id} onClick={handler} style={{
                position: 'relative', cursor: cliccabile ? 'pointer' : 'default',
                opacity: mostraUsata ? 0.35 : 1, filter: mostraUsata ? 'grayscale(0.5)' : 'none',
                transition: 'all 0.2s',
                border: `2px solid ${inSD ? 'rgba(255,214,102,0.4)' : getColoreBordo(stato)}`, borderRadius: 12, padding: 2,
              }}
              onMouseEnter={e => { if (cliccabile) e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                <CartaWaifu waifu={w} dimensione="piccola" />
                {mostraUsata && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 24, textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>{getIconaStato(stato)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: Scelta statistica ── */}
      {(fase === 'playerScegliStat' || fase === 'pvpScegliStat') && carteP && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="fade-up" style={{ background: 'rgba(10,7,38,0.96)', border: '0.8px solid rgba(255,133,182,0.3)', borderRadius: 16, padding: 22, maxWidth: 380, width: '100%', boxShadow: '0 0 50px rgba(255,133,182,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, color: '#ff85b6', fontFamily: "'Saira Condensed', Saira, sans-serif" }}>🎯 SCEGLI STATISTICA</div>
              <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: "'Unbounded', sans-serif", fontWeight: 700, marginTop: 4 }}>⏱ {timeLeft}s</div>
            </div>
            {/* Stat usate */}
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              {STATS_BATTAGLIA.map(s => {
                const usata = statsUsatePartita.includes(s.key);
                return (
                  <div key={s.key} style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontFamily: 'Orbitron', letterSpacing: 1,
                    background: usata ? 'rgba(255,61,61,0.08)' : 'rgba(0,230,118,0.12)',
                    border: `1px solid ${usata ? '#ff3d3d40' : '#00e67640'}`,
                    color: usata ? '#ff3d3d60' : '#00e676',
                    textDecoration: usata ? 'line-through' : 'none',
                    opacity: usata ? 0.5 : 1,
                  }}>
                    {s.icon} {s.label}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {statsDisp.map(s => (
                <button key={s.key}
                  onClick={() => isCpu ? onScegliStatCpu(s.key) : pvpScegliStat(s.key)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'rgba(155,89,255,0.06)',
                    border: '1px solid rgba(255,45,120,0.15)', borderRadius: 10, cursor: 'pointer',
                    color: '#eee8dc', fontFamily: 'Orbitron', fontSize: 12, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,120,0.12)'; e.currentTarget.style.borderColor = '#ff2d78'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(155,89,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,45,120,0.15)'; }}
                >
                  <span style={{ fontSize: 18, marginRight: 10 }}>{s.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 16, color: '#ffd666', fontWeight: 700 }}>{carteP[s.key]}</span>
                </button>
              ))}
              {statsDisp.length === 0 && (
                <div style={{ textAlign: 'center', color: '#ff3d3d', fontFamily: 'Orbitron', fontSize: 11, padding: 12 }}>
                  Tutte le stat sono state usate!<br/>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>Scelta automatica...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Scelta direzione ── */}
      {(fase === 'playerScegliDir' || fase === 'pvpScegliDir') && statInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="fade-up" style={{ background: 'rgba(10,7,38,0.96)', border: '0.8px solid rgba(255,133,182,0.3)', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 0 50px rgba(255,133,182,0.2)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{statInfo?.icon}</div>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 700, color: '#ff85b6', letterSpacing: 1, marginBottom: 4 }}>
              {statInfo?.label}: <strong>{carteP?.[statScelta]}</strong>
            </div>
            <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: "'Unbounded', sans-serif", fontWeight: 700, marginBottom: 16 }}>⏱ {timeLeft}s</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => isCpu ? onScegliDirCpu('piu') : pvpScegliDir('piu')}
                style={{ flex: 1, padding: '16px 12px', background: 'rgba(0,230,118,0.08)', border: '1px solid #00e676', borderRadius: 12, cursor: 'pointer', color: '#00e676', fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.08)'; }}
              >
                <div style={{ fontSize: 24 }}>▲</div>
                <div style={{ marginTop: 4, fontSize: 10 }}>PIÙ ALTO</div>
              </button>
              <button
                onClick={() => isCpu ? onScegliDirCpu('meno') : pvpScegliDir('meno')}
                style={{ flex: 1, padding: '16px 12px', background: 'rgba(255,61,61,0.08)', border: '1px solid #ff3d3d', borderRadius: 12, cursor: 'pointer', color: '#ff3d3d', fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,61,61,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,61,61,0.08)'; }}
              >
                <div style={{ fontSize: 24 }}>▼</div>
                <div style={{ marginTop: 4, fontSize: 10 }}>PIÙ BASSO</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BANNER FINE ROUND (stile RoundEndBar vs CPU) ── */}
      {(fase === 'roundEnd' || fase === 'pvpAttesaProsegui' || (isCpu && fase === 'roundEnd')) && vincitoreRound && (
        <RoundEndBarMulti
          vincitoreRound={vincitoreRound}
          statScelta={statScelta}
          direzione={direzione}
          carteP={carteP}
          carteC={carteC}
          round={round}
          punteggio={punteggio}
          STATS_BATTAGLIA={STATS_BATTAGLIA}
          isCpu={isCpu}
          nomeAvversario={nomeAvversario}
          coloreAvversario={coloreAvversario}
          pvpHoPremutoProsegui={pvpHoPremutoProsegui}
          onProssimoRound={prossimoRound}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BANNER FINE ROUND — stile identico a RoundEndBar vs CPU
// Gestisce sia il caso CPU (auto-avanza) sia PvP (attende entrambi)
// ════════════════════════════════════════════════════════════════════
function RoundEndBarMulti({ vincitoreRound, statScelta, direzione, carteP, carteC, round, punteggio, STATS_BATTAGLIA, isCpu, nomeAvversario, coloreAvversario, pvpHoPremutoProsegui, onProssimoRound }) {
  const [timer, setTimer] = useState(isCpu ? 30 : null); // timer solo vs CPU
  useEffect(() => {
    if (!isCpu) return;
    if (timer <= 0) { onProssimoRound(); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, isCpu]);

  const colore = vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? '#ff3d3d' : '#ffd666';
  const statInfo = STATS_BATTAGLIA.find(s => s.key === statScelta);
  const eFine = round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3;

  const testoEsito = vincitoreRound === 'player'
    ? '✅ ROUND VINTO!'
    : vincitoreRound === 'cpu'
    ? '❌ ROUND PERSO'
    : '🤝 PAREGGIO';

  const testoPulsante = isCpu
    ? (eFine ? 'FINE PARTITA' : 'PROSSIMO ROUND →')
    : pvpHoPremutoProsegui
    ? `⏳ In attesa di ${nomeAvversario}…`
    : (eFine ? 'FINE PARTITA' : '✅ PROSEGUI TURNO');

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110,
      padding: '10px 16px 74px 16px',
      background: 'rgba(10,7,38,0.96)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${colore}80`,
    }}>
      <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        {/* Esito round */}
        <div style={{ fontSize: 13, fontFamily: "'Unbounded', sans-serif", fontWeight: 700, marginBottom: 4, color: colore }}>
          {testoEsito}
          {isCpu && timer !== null && <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>({timer}s)</span>}
        </div>
        {/* Stat confronto */}
        {statInfo && carteP && carteC && (
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.6)', marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
            {statInfo.icon} {statInfo.label} {direzione === 'piu' ? '▲' : '▼'} — Tu: <strong>{carteP[statScelta]}</strong> vs {nomeAvversario}: <strong>{carteC[statScelta]}</strong>
          </div>
        )}
        {/* Punteggio mini */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 700, color: '#6cf0e0', fontSize: 18 }}>{punteggio.player}</span>
          <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 11, color: 'rgba(238,232,220,0.3)' }}>—</span>
          <span style={{ fontFamily: "'Unbounded', sans-serif", fontWeight: 700, color: coloreAvversario, fontSize: 18 }}>{punteggio.cpu}</span>
        </div>
        {/* Pulsante / stato attesa PvP */}
        {!isCpu && pvpHoPremutoProsegui ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: coloreAvversario, animation: `reb_pulse 1.2s ease-in-out ${i*0.4}s infinite` }} />
              ))}
            </div>
            <style>{`@keyframes reb_pulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron' }}>
              In attesa di {nomeAvversario}…
            </div>
          </div>
        ) : (
          <BtnDecorato variant="primary" size="md" onClick={onProssimoRound}>
            {testoPulsante}
          </BtnDecorato>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAPPA SCROLLABILE MULTI (stessa logica di quella single player)
// ════════════════════════════════════════════════════════════════════
function MappaScrollabileMulti({ territoriUtente, coloreImpero, nomeImpero, territorioSelezionato, onTerritorioClick, mieiTerritori = [], mappaMulti = null, myUid = null }) {
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 0.6, MAX_ZOOM = 2.2, ZOOM_STEP = 0.2;
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))));
  }, []);
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(155,89,255,0.35)', color: '#9b59ff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
        <button onClick={() => setZoom(1)} style={{ width: 28, height: 14, borderRadius: 4, background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(155,89,255,0.2)', color: 'rgba(155,89,255,0.5)', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron' }}>1:1</button>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(155,89,255,0.35)', color: '#9b59ff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>−</button>
      </div>
      <div className="mappa-scroll-container" onWheel={handleWheel} style={{ borderRadius: 10, overflow: 'auto', maxHeight: 'min(60vh, 500px)' }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: zoom > 1 ? `${zoom * 100}%` : '100%' }}>
          <MappaMondoArt
            territoriUtente={territoriUtente}
            coloreImpero={coloreImpero}
            nomeImpero={nomeImpero}
            territorioSelezionato={territorioSelezionato}
            onTerritorioClick={onTerritorioClick}
            mieiTerritori={mieiTerritori}
            mappaMulti={mappaMulti}
            myUid={myUid}
          />
        </div>
      </div>
    </div>
  );
}

// FormImpero estratto in ./multiplayer/FormImpero.jsx

// ════════════════════════════════════════════════════════════════════
// POPUP GAME END — timer locale 5s indipendente per ogni client
// Chiama onProcedi sia al click che allo scadere del timer.
// Il comportamento di un client non influenza l'altro.
// ════════════════════════════════════════════════════════════════════
function PopupGameEnd({ vittoria, pFin, coloreRisultato, testoTerritorio, nomeAvversario, coloreAvversario, onProcedi }) {
  const [timer, setTimer] = useState(5);
  const chiamato = useRef(false);

  const procedi = useCallback(() => {
    if (chiamato.current) return;
    chiamato.current = true;
    onProcedi();
  }, [onProcedi]);

  useEffect(() => {
    if (timer <= 0) { procedi(); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, procedi]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="fade-in" style={{
        background: 'rgba(10,7,38,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${vittoria ? 'rgba(245,197,96,0.5)' : 'rgba(255,133,182,0.35)'}`,
        borderRadius: 20, padding: 32, maxWidth: 360, width: '100%',
        textAlign: 'center',
        boxShadow: vittoria ? '0 0 60px rgba(245,197,96,0.2)' : '0 0 60px rgba(255,133,182,0.15)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{vittoria ? '👑' : '💔'}</div>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, fontWeight: 700, color: vittoria ? '#f5c560' : '#ff85b6', letterSpacing: 2, marginBottom: 6 }}>
          {vittoria ? 'VITTORIA!' : 'SCONFITTA'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.4)', fontFamily: "'Saira Condensed', Saira, sans-serif", marginBottom: 2 }}>TU</div>
            <div style={{ fontSize: 34, fontFamily: "'Unbounded', sans-serif", fontWeight: 800, color: '#6cf0e0' }}>{pFin.player}</div>
          </div>
          <div style={{ fontSize: 16, color: '#444', fontFamily: "'Unbounded', sans-serif" }}>—</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.4)', fontFamily: "'Saira Condensed', Saira, sans-serif", marginBottom: 2 }}>{(nomeAvversario || 'AVVERSARIO').toUpperCase()}</div>
            <div style={{ fontSize: 34, fontFamily: "'Unbounded', sans-serif", fontWeight: 800, color: coloreAvversario }}>{pFin.cpu}</div>
          </div>
        </div>
        <div style={{
          padding: '12px 18px', borderRadius: 10, marginBottom: 20,
          background: vittoria ? 'rgba(245,197,96,0.08)' : 'rgba(255,133,182,0.08)',
          border: `0.8px solid ${vittoria ? 'rgba(245,197,96,0.3)' : 'rgba(255,133,182,0.3)'}`,
          fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          color: vittoria ? '#f5c560' : '#ff85b6', letterSpacing: 0.5,
        }}>
          {testoTerritorio}
        </div>
        <button onClick={procedi} style={{
          width: '100%',
          padding: '12px 24px',
          background: vittoria
            ? 'linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))'
            : 'linear-gradient(rgba(255,133,182,0.2), rgba(255,133,182,0.06))',
          border: vittoria
            ? '0.8px solid rgba(255,233,168,0.6)'
            : '0.8px solid rgba(255,133,182,0.4)',
          borderRadius: 12,
          cursor: 'pointer',
          color: vittoria ? 'rgb(42,31,0)' : '#ff85b6',
          fontFamily: "'Saira Condensed', Saira, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          backdropFilter: 'blur(8px)',
          boxShadow: vittoria ? 'rgba(245,197,96,0.35) 0px 6px 20px 0px' : 'none',
        }}>
          ✓ PROCEDI ({timer}s)
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SPETTATORE VIEW — visualizza la battaglia in real-time
// Legge tutto da partita.battagliaCorrente (già aggiornato dal listener)
// ════════════════════════════════════════════════════════════════════
function SpettatoreView({ partita, giocatori, battaglia, waifuCat, onAspetta, onEsci }) {
  const attUid = battaglia.attaccanteUid;
  const difUid = battaglia.difensoreUid;
  const gAtt = giocatori[attUid] || { nomeImpero: 'Attaccante', coloreImpero: '#ff2d78' };
  const gDif = difUid === 'cpu' ? { nomeImpero: 'CPU', coloreImpero: '#666666' } : (giocatori[difUid] || { nomeImpero: 'Difensore', coloreImpero: '#9b59ff' });
  const terrData = TERRITORI.find(t => t.id === battaglia.territorioId);

  // Quale giocatore sto guardando (le sue carte nel mazzo)
  const [guardoUid, setGuardoUid] = useState(attUid);
  const guardoGiocatore = guardoUid === attUid ? gAtt : gDif;
  const altroUid = guardoUid === attUid ? difUid : attUid;
  const altroGiocatore = guardoUid === attUid ? gDif : gAtt;

  const STATS_BATTAGLIA = [
    { key: 'tette', label: 'Tette', icon: '💗' },
    { key: 'taglia_piedi', label: 'Piedi', icon: '👠' },
    { key: 'eta', label: 'Età', icon: '📅' },
    { key: 'colore_capelli', label: 'Capelli', icon: '💇' },
    { key: 'esperienza', label: 'Esperienza', icon: '⭐' },
  ];

  // Ricostruisce il mazzo di un giocatore dai mazziIds salvati su Firestore
  const getMazzo = (uid) => {
    const ids = battaglia.mazzi?.[uid] || [];
    return ids.map(id => {
      const w = waifuCat.find(x => x.id === id);
      return w || null;
    }).filter(Boolean);
  };

  const mazzoGuardo = getMazzo(guardoUid);
  const mazzoAltro = getMazzo(altroUid);

  // Ricalcola i risultati già giocati
  // IMPORTANTE: un round è "completato" solo quando entrambi i giocatori hanno premuto
  // "prosegui" (proseguiRound[roundKey][attUid] && proseguiRound[roundKey][difUid]).
  // Finché non è così, il round è ancora "in corso" per lo spettatore.
  const pvpRisultato = battaglia.pvpRisultato || {};
  const proseguiRound = battaglia.proseguiRound || {};
  const risWaifu = {}; // waifuId → 'vinta'|'persa'|'pareggio' dal punto di vista di guardoUid
  let playerScore = 0, cpuScore = 0;

  // Determina il round corrente: l'ultimo round il cui risultato esiste
  // ma i giocatori NON hanno ancora entrambi premuto "prosegui", oppure
  // il primo round senza risultato.
  let roundCorrente = 1;
  let roundInSospeso = null; // round con risultato ma prosegui non completato

  for (let r = 1; r <= 5; r++) {
    const rKey = String(r);
    const ris = pvpRisultato[rKey];
    if (!ris) {
      // Questo round non ha ancora risultato → è il round attuale
      roundCorrente = r;
      break;
    }
    // Il round ha un risultato: controlla se entrambi hanno premuto prosegui
    const proseguiDati = proseguiRound[rKey] || {};
    const entrambiProseguiti = proseguiDati[attUid] && proseguiDati[difUid !== 'cpu' ? difUid : attUid];
    if (!entrambiProseguiti) {
      // Risultato presente ma prosegui non completato → siamo ancora qui
      roundCorrente = r;
      roundInSospeso = rKey;
      break;
    }
    // Round completato: accumula punteggio e waifu usate
    const vinceGuardo = ris.vincitoreUid === guardoUid;
    const vincePari = ris.vincitoreUid === 'pareggio';
    if (vinceGuardo) playerScore++;
    else if (!vincePari) cpuScore++;
    const sonoGuardoAtt = ris.attaccanteUid === guardoUid;
    const guardoWId = sonoGuardoAtt ? ris.attaccanteWaifuId : ris.difensoreWaifuId;
    const altroWId = sonoGuardoAtt ? ris.difensoreWaifuId : ris.attaccanteWaifuId;
    const vince = vincePari ? 'pareggio' : vinceGuardo ? 'vinta' : 'persa';
    if (guardoWId) risWaifu[guardoWId] = vince;
    if (altroWId) risWaifu[altroWId] = vince === 'vinta' ? 'persa' : vince === 'persa' ? 'vinta' : 'pareggio';
    // Se siamo arrivati al round 5 senza trovare un round in sospeso, siamo al 5+
    if (r === 5) roundCorrente = 6; // oltre i 5 round → sudden death o fine
  }

  // Sudden death
  const sdRis = pvpRisultato['sd'];
  const sdProsegui = proseguiRound['sd'] || {};
  const sdEntrambi = sdRis && sdProsegui[attUid] && sdProsegui[difUid !== 'cpu' ? difUid : attUid];
  const inSuddenDeath = roundCorrente > 5 || (!sdEntrambi && sdRis);
  if (inSuddenDeath && !roundInSospeso && sdRis) roundInSospeso = 'sd';

  const sceltePvp = battaglia.sceltePvp || {};
  const roundKey = inSuddenDeath ? 'sd' : String(roundCorrente);
  const scelteRound = sceltePvp[roundKey] || {};

  // Carta scelta nel round corrente (o in sospeso)
  const rKeyAttuale = roundInSospeso || roundKey;
  const scelteAttuale = sceltePvp[rKeyAttuale] || {};
  const sceltaGuardo = scelteAttuale[guardoUid];
  const sceltaAltro = scelteAttuale[altroUid];
  const risultatoRound = pvpRisultato[rKeyAttuale];

  const cartaGuardoAttuale = risultatoRound
    ? (() => {
        const sonoAtt = risultatoRound.attaccanteUid === guardoUid;
        const wId = sonoAtt ? risultatoRound.attaccanteWaifuId : risultatoRound.difensoreWaifuId;
        return mazzoGuardo.find(w => w.id === wId) || null;
      })()
    : sceltaGuardo ? (mazzoGuardo.find(w => w.id === sceltaGuardo.waifuId) || null) : null;

  const cartaAltroAttuale = risultatoRound
    ? (() => {
        const sonoAtt = risultatoRound.attaccanteUid === altroUid;
        const wId = sonoAtt ? risultatoRound.attaccanteWaifuId : risultatoRound.difensoreWaifuId;
        return (mazzoAltro.find(w => w.id === wId) || mazzoAltro.find(w => w.id === `opp_${wId}`)) || null;
      })()
    : sceltaAltro ? (mazzoAltro.find(w => w.id === sceltaAltro.waifuId) || null) : null;

  const statKey = risultatoRound?.statKey || sceltaGuardo?.stat || sceltaAltro?.stat || null;
  const direzione = risultatoRound?.dir || sceltaGuardo?.direzione || sceltaAltro?.direzione || null;
  const statInfo = STATS_BATTAGLIA.find(s => s.key === statKey);

  const vincitoreRound = risultatoRound
    ? (risultatoRound.vincitoreUid === 'pareggio' ? 'pareggio' : risultatoRound.vincitoreUid === guardoUid ? 'player' : 'cpu')
    : null;

  const coloreGuardo = guardoGiocatore.coloreImpero || '#ff2d78';
  const coloreAltro = altroGiocatore.coloreImpero || '#9b59ff';

  return (
    <div className="fade-in">
      {/* Header */}
      <PannelloOrnato glow="#ff2d78" style={{ padding: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{gAtt.nomeImpero}</div>
            <div style={{ fontSize: 28, color: gAtt.coloreImpero, fontFamily: 'Orbitron', fontWeight: 700 }}>
              {guardoUid === attUid ? playerScore : cpuScore}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', letterSpacing: 1, fontSize: 9, color: '#ff2d78', marginBottom: 2 }}>
              👁 SPETTATORE
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#ffd666' }}>
              {inSuddenDeath ? '⚡ SUDDEN DEATH' : `ROUND ${Math.min(roundCorrente, 5)}/5`}
            </div>
            {terrData && (
              <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', marginTop: 2 }}>
                ⚔ {terrData.nome}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{gDif.nomeImpero}</div>
            <div style={{ fontSize: 28, color: gDif.coloreImpero, fontFamily: 'Orbitron', fontWeight: 700 }}>
              {guardoUid === attUid ? cpuScore : playerScore}
            </div>
          </div>
        </div>
        {/* Stat usate */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {STATS_BATTAGLIA.map(s => {
            const usata = Object.values(pvpRisultato).some(r => r.statKey === s.key);
            return (
              <div key={s.key} style={{
                padding: '2px 6px', borderRadius: 5, fontSize: 8, fontFamily: 'Orbitron',
                background: usata ? 'rgba(255,61,61,0.08)' : 'rgba(0,230,118,0.10)',
                border: `1px solid ${usata ? '#ff3d3d30' : '#00e67630'}`,
                color: usata ? '#ff3d3d50' : '#00e676',
                textDecoration: usata ? 'line-through' : 'none', opacity: usata ? 0.4 : 0.9,
              }}>
                {s.icon} {s.label}
              </div>
            );
          })}
        </div>
      </PannelloOrnato>

      {/* Campo di battaglia */}
      <PannelloOrnato style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', gap: 8 }}>
          {/* Carta attaccante */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: 1, marginBottom: 4, fontFamily: 'Orbitron', color: gAtt.coloreImpero }}>{gAtt.nomeImpero.toUpperCase()}</div>
            {cartaGuardoAttuale && guardoUid === attUid
              ? <CartaWaifu waifu={cartaGuardoAttuale} dimensione="piccola" evidenziaStat={risultatoRound ? statKey : null} perdente={vincitoreRound === 'cpu'} />
              : cartaAltroAttuale && guardoUid !== attUid
              ? <CartaWaifu waifu={cartaAltroAttuale} dimensione="piccola" evidenziaStat={risultatoRound ? statKey : null} perdente={vincitoreRound === 'player'} />
              : <div style={{ width: 130, height: 195, border: `1px dashed ${gAtt.coloreImpero}40`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${gAtt.coloreImpero}60`, fontFamily: 'Orbitron', fontSize: 9 }}>
                  {sceltaGuardo && guardoUid === attUid || sceltaAltro && guardoUid !== attUid ? '✓' : '?'}
                </div>
            }
          </div>

          {/* Centro VS */}
          <div style={{ textAlign: 'center', minWidth: 90, flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontFamily: 'Orbitron', background: 'linear-gradient(135deg, #ff2d78, #9b59ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>VS</div>
            {risultatoRound && statInfo && (
              <div className="fade-up" style={{ marginTop: 8, padding: 6, background: 'rgba(245,166,35,0.06)', borderRadius: 8, border: '1px solid rgba(245,166,35,0.2)' }}>
                <div style={{ fontSize: 9, color: '#f5a623', fontFamily: 'Orbitron' }}>{statInfo.icon} {statInfo.label}</div>
                <div style={{ fontSize: 10, color: direzione === 'piu' ? '#00e676' : '#ff3d3d', marginTop: 2 }}>{direzione === 'piu' ? '▲ PIÙ' : '▼ MENO'}</div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, marginTop: 6,
                  color: vincitoreRound === 'player' ? gAtt.coloreImpero : vincitoreRound === 'cpu' ? gDif.coloreImpero : '#ffd666' }}>
                  {vincitoreRound === 'player' ? `✅ ${gAtt.nomeImpero}` : vincitoreRound === 'cpu' ? `✅ ${gDif.nomeImpero}` : '🤝 PARI'}
                </div>
                {roundInSospeso && (
                  <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', marginTop: 6, letterSpacing: 1 }}>
                    ⏳ in attesa dei giocatori…
                  </div>
                )}
              </div>
            )}
            {!risultatoRound && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', marginBottom: 4 }}>IN CORSO</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff2d78', animation: `pulse 1.2s ease-in-out ${i*0.4}s infinite` }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Carta difensore */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: 1, marginBottom: 4, fontFamily: 'Orbitron', color: gDif.coloreImpero }}>{gDif.nomeImpero.toUpperCase()}</div>
            {cartaAltroAttuale && guardoUid === attUid
              ? <CartaWaifu waifu={cartaAltroAttuale} dimensione="piccola" evidenziaStat={risultatoRound ? statKey : null} perdente={vincitoreRound === 'player'} censurata={cartaAltroAttuale.hot === true && !profilo?.hardPass} />
              : cartaGuardoAttuale && guardoUid !== attUid
              ? <CartaWaifu waifu={cartaGuardoAttuale} dimensione="piccola" evidenziaStat={risultatoRound ? statKey : null} perdente={vincitoreRound === 'cpu'} censurata={cartaGuardoAttuale.hot === true && !profilo?.hardPass} />
              : <div style={{ width: 130, height: 195, border: `1px dashed ${gDif.coloreImpero}40`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${gDif.coloreImpero}60`, fontFamily: 'Orbitron', fontSize: 9 }}>
                  {sceltaAltro && guardoUid === attUid || sceltaGuardo && guardoUid !== attUid ? '✓' : '?'}
                </div>
            }
          </div>
        </div>
      </PannelloOrnato>

      {/* Toggle: guarda le carte di chi */}
      <PannelloOrnato style={{ padding: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', textAlign: 'center', marginBottom: 8, fontFamily: 'Orbitron' }}>
          CARTE DI
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          <button
            onClick={() => setGuardoUid(attUid)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              background: guardoUid === attUid ? `${gAtt.coloreImpero}25` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${guardoUid === attUid ? gAtt.coloreImpero : 'rgba(255,255,255,0.08)'}`,
              color: guardoUid === attUid ? gAtt.coloreImpero : 'rgba(238,232,220,0.4)',
              fontFamily: 'Orbitron', fontSize: 9, fontWeight: 700, letterSpacing: 1,
              transition: 'all 0.15s',
            }}
          >
            ⚔ {gAtt.nomeImpero}
          </button>
          <button
            onClick={() => setGuardoUid(difUid === 'cpu' ? difUid : difUid)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              background: guardoUid !== attUid ? `${gDif.coloreImpero}25` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${guardoUid !== attUid ? gDif.coloreImpero : 'rgba(255,255,255,0.08)'}`,
              color: guardoUid !== attUid ? gDif.coloreImpero : 'rgba(238,232,220,0.4)',
              fontFamily: 'Orbitron', fontSize: 9, fontWeight: 700, letterSpacing: 1,
              transition: 'all 0.15s',
            }}
          >
            🛡 {gDif.nomeImpero}
          </button>
        </div>
        {/* Mazzo del giocatore selezionato */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {mazzoGuardo.map(w => {
            const r = risWaifu[w.id];
            const usata = !!r;
            const icona = r === 'vinta' ? '✅' : r === 'persa' ? '❌' : r === 'pareggio' ? '🤝' : null;
            const colBordo = !r ? 'rgba(255,255,255,0.08)' : r === 'vinta' ? '#00e676' : r === 'persa' ? '#ff3d3d' : '#ffd666';
            return (
              <div key={w.id} style={{
                position: 'relative',
                opacity: usata ? 0.35 : 1,
                filter: usata ? 'grayscale(0.5)' : 'none',
                transition: 'all 0.2s',
                border: `2px solid ${colBordo}`,
                borderRadius: 12, padding: 2,
              }}>
                <CartaWaifu waifu={w} dimensione="piccola" />
                {usata && icona && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 24, textShadow: '0 0 10px rgba(0,0,0,0.8)',
                    pointerEvents: 'none',
                  }}>
                    {icona}
                  </div>
                )}
              </div>
            );
          })}
          {mazzoGuardo.length === 0 && (
            <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', padding: 16, textAlign: 'center' }}>
              ⏳ In attesa che {guardoGiocatore.nomeImpero} scelga il team…
            </div>
          )}
        </div>
      </PannelloOrnato>

      {/* Azioni spettatore */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onAspetta} style={{ ...btnStyle('#666', true), flex: 1 }}>⏳ ASPETTA</button>
        <button onClick={onEsci} style={{ background: 'none', border: 'none', color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer', letterSpacing: 1 }}>
          💾 ESCI
        </button>
      </div>
    </div>
  );
}

// btnStyle, labelStyle, inputStyle — ora importati da ./multiplayer/sharedStyles
