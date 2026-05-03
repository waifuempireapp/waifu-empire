// src/components/MappaMultiplayer.jsx
// Sistema multiplayer per Impero Waifu
// Gestisce: Crea Partita, Unisciti, Carica, Lobby, Partita, Battaglia
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  creaPartitaMultiplayer, uniscitiPartita, avviaPartitaMultiplayer,
  caricaPartita, ascoltaPartita, scegliAttacco,
  registraRisultatoBattaglia, salvaPartita, setGiocatoreInLobby,
  getColoriUsatiLobby, salvaMazzoBattaglia,
  salvaSceltaPvpRound, salvaPrimoTurnoPvp,
  salvaProseguiTurnoRound, registraRisultatoBattagliaPvp,
} from '@/lib/multiplayerService';
import { TERRITORI, NOMI_CONTINENTI, STAT_RANGES_DEFAULT } from '@/lib/constants';
import { applicaAbilitaOutfit, applicaModificatoriOpp } from '@/lib/gameLogic';
import { updateUserProfile } from '@/lib/firestoreService';
import MappaMondoArt from '@/components/MappaMondoArt';
import { CartaWaifu } from '@/components/CartaWaifu';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
} from '@/components/ui/UIKit';

// ── Palette colori selezionabili ─────────────────────────────────────
const PALETTE_COLORI = [
  '#f5a623', '#00e676', '#ff2d78', '#9b59ff', '#00bcd4',
  '#ff6b35', '#c0ca33', '#26c6da', '#ab47bc', '#ef5350',
  '#42a5f5', '#66bb6a', '#ffa726', '#ec407a', '#7e57c2',
];

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ════════════════════════════════════════════════════════════════════
export default function MappaMultiplayer({
  profilo, user, collezione, waifuCat, outfitCat,
  mostraNotif, onEsci, vistaIniziale = 'menu',
}) {
  // Vista corrente: 'menu' | 'crea' | 'unisciti' | 'carica' | 'lobby' | 'partita'
  const [vista, setVista] = useState(vistaIniziale);
  const [partita, setPartita] = useState(null);
  const [codicePartita, setCodicePartita] = useState('');
  // useRef per il listener: evita problemi con setState che chiama la funzione come updater
  const unsubscribeRef = useRef(null);

  // Cleanup al unmount
  useEffect(() => {
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, []);

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
  // Il callback di onSnapshot può essere chiamato sincronicamente da Firestore
  // durante un ciclo di update React, causando React error #300 ("Cannot update
  // a component while rendering a different component").
  // setTimeout(0) garantisce che setPartita venga eseguito in un nuovo task,
  // fuori dal ciclo di rendering corrente.
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

  const handleEsciESalva = async () => {
    if (partita?.codice) {
      await salvaPartita(partita.codice);
      await setGiocatoreInLobby(partita.codice, user.uid, false);
      if (unsubscribeRef.current) unsubscribeRef.current();
    }
    onEsci();
  };

  // ── Render viste ──────────────────────────────────────────────────
  if (vista === 'menu') {
    return (
      <MenuMultiplayer
        onCrea={() => setVista('crea')}
        onUnisciti={() => setVista('unisciti')}
        onCarica={() => setVista('carica')}
        onIndietro={onEsci}
      />
    );
  }

  if (vista === 'crea') {
    return (
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
    );
  }

  if (vista === 'unisciti') {
    return (
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
    );
  }

  if (vista === 'carica') {
    return (
      <CaricaPartita
        user={user}
        onCaricata={async (p) => {
          setPartita(p);
          setCodicePartita(p.codice);
          avviaListener(p.codice);
          // Se la partita è in gioco, check se tutti i giocatori necessari sono presenti
          if (p.stato === 'in_gioco') {
            await setGiocatoreInLobby(p.codice, user.uid, true);
            setVista('partita');
          } else {
            setVista('lobby');
          }
        }}
        onAnnulla={() => setVista('menu')}
      />
    );
  }

  if (vista === 'lobby') {
    return (
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
    );
  }

  if (vista === 'partita') {
    return (
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
    );
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════
// MENU PRINCIPALE MULTIPLAYER
// ════════════════════════════════════════════════════════════════════
function MenuMultiplayer({ onCrea, onUnisciti, onCarica, onIndietro }) {
  return (
    <div className="fade-in">
      <PannelloOrnato glow="#9b59ff" style={{ textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🌐</div>
        <TitoloOrnato livello={1} colore="#9b59ff">MULTIPLAYER</TitoloOrnato>
        <div style={{ color: 'rgba(238,232,220,0.5)', fontSize: 10, letterSpacing: 2, fontFamily: 'Orbitron', marginBottom: 24 }}>
          CONQUISTA IL MONDO CON ALTRI GIOCATORI
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto' }}>
          <button onClick={onCrea} style={btnStyle('#9b59ff')}>
            🏰 CREA PARTITA
          </button>
          <button onClick={onUnisciti} style={btnStyle('#00e676')}>
            🔑 UNISCITI A UNA PARTITA
          </button>
          <button onClick={onCarica} style={btnStyle('#f5a623')}>
            💾 CARICA PARTITA
          </button>
          <button onClick={onIndietro} style={btnStyle('#666', true)}>
            ← INDIETRO
          </button>
        </div>
      </PannelloOrnato>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CREA PARTITA
// ════════════════════════════════════════════════════════════════════
function CreaPartita({ profilo, user, onCreata, onAnnulla }) {
  const [nomeImpero, setNomeImpero] = useState(profilo.nomeImpero || '');
  const [coloreImpero, setColoreImpero] = useState(profilo.coloreImpero || PALETTE_COLORI[0]);
  const [loading, setLoading] = useState(false);

  const handleCrea = async () => {
    if (!nomeImpero.trim()) return;
    setLoading(true);
    try {
      const result = await creaPartitaMultiplayer({
        uid: user.uid,
        nomeImpero: nomeImpero.trim(),
        coloreImpero,
      });
      onCreata(result);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#9b59ff" style={{ padding: 24 }}>
        <TitoloOrnato livello={2} colore="#9b59ff">CREA PARTITA</TitoloOrnato>
        <FormImpero
          nomeImpero={nomeImpero}
          setNomeImpero={setNomeImpero}
          coloreImpero={coloreImpero}
          setColoreImpero={setColoreImpero}
          coloriBloccati={[]}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onAnnulla} style={btnStyle('#666', true)}>ANNULLA</button>
          <button onClick={handleCrea} disabled={loading || !nomeImpero.trim()} style={btnStyle('#9b59ff')}>
            {loading ? '...' : '🏰 CREA'}
          </button>
        </div>
      </PannelloOrnato>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// UNISCITI
// ════════════════════════════════════════════════════════════════════
function UniscitiPartita({ profilo, user, onUnito, onAnnulla }) {
  const [codice, setCodice] = useState('');
  const [nomeImpero, setNomeImpero] = useState(profilo.nomeImpero || '');
  const [coloreImpero, setColoreImpero] = useState(profilo.coloreImpero || PALETTE_COLORI[1]);
  const [coloriBloccati, setColoriBloccati] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('codice'); // 'codice' | 'configura'

  const verificaCodice = async () => {
    if (codice.trim().length < 6) return;
    setLoading(true);
    try {
      const usati = await getColoriUsatiLobby(codice.trim());
      setColoriBloccati(usati);
      // Scegli colore libero di default
      const libero = PALETTE_COLORI.find(c => !usati.includes(c));
      if (libero) setColoreImpero(libero);
      setStep('configura');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnisciti = async () => {
    if (!nomeImpero.trim()) return;
    setLoading(true);
    try {
      await uniscitiPartita({
        codice: codice.trim(),
        uid: user.uid,
        nomeImpero: nomeImpero.trim(),
        coloreImpero,
      });
      onUnito({ codice: codice.trim().toUpperCase() });
    } catch (e) {
      alert(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#00e676" style={{ padding: 24 }}>
        <TitoloOrnato livello={2} colore="#00e676">UNISCITI A UNA PARTITA</TitoloOrnato>

        {step === 'codice' && (
          <>
            <label style={labelStyle}>CODICE PARTITA</label>
            <input
              value={codice}
              onChange={e => setCodice(e.target.value.toUpperCase())}
              placeholder="ES: AB3K7X"
              maxLength={6}
              style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 20, textTransform: 'uppercase' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={onAnnulla} style={btnStyle('#666', true)}>ANNULLA</button>
              <button onClick={verificaCodice} disabled={loading || codice.trim().length < 6} style={btnStyle('#00e676')}>
                {loading ? '...' : 'VERIFICA →'}
              </button>
            </div>
          </>
        )}

        {step === 'configura' && (
          <>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(0,230,118,0.08)', borderRadius: 8, border: '1px solid rgba(0,230,118,0.2)', fontSize: 10, color: '#00e676', fontFamily: 'Orbitron', textAlign: 'center' }}>
              ✅ CODICE: {codice.toUpperCase()}
            </div>
            <FormImpero
              nomeImpero={nomeImpero}
              setNomeImpero={setNomeImpero}
              coloreImpero={coloreImpero}
              setColoreImpero={setColoreImpero}
              coloriBloccati={coloriBloccati}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep('codice')} style={btnStyle('#666', true)}>← INDIETRO</button>
              <button onClick={handleUnisciti} disabled={loading || !nomeImpero.trim()} style={btnStyle('#00e676')}>
                {loading ? '...' : '🔑 ENTRA'}
              </button>
            </div>
          </>
        )}
      </PannelloOrnato>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CARICA PARTITA
// ════════════════════════════════════════════════════════════════════
function CaricaPartita({ user, onCaricata, onAnnulla }) {
  const [codice, setCodice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCarica = async () => {
    if (codice.trim().length < 6) return;
    setLoading(true);
    try {
      const p = await caricaPartita(codice.trim());
      // Verifica che l'utente faccia parte della partita
      if (!p.giocatori?.[user.uid]) throw new Error('Non sei un giocatore di questa partita');
      if (p.stato === 'terminata') throw new Error('Questa partita è già terminata');
      // Se è in_gioco, verifica che il suo impero non sia eliminato
      if (p.stato === 'in_gioco' && p.giocatori[user.uid]?.eliminato) {
        throw new Error('Il tuo impero è stato eliminato da questa partita');
      }
      onCaricata(p);
    } catch (e) {
      alert(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#f5a623" style={{ padding: 24 }}>
        <TitoloOrnato livello={2} colore="#f5a623">CARICA PARTITA</TitoloOrnato>
        <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 16, textAlign: 'center' }}>
          Inserisci il codice della partita salvata
        </div>
        <label style={labelStyle}>CODICE PARTITA</label>
        <input
          value={codice}
          onChange={e => setCodice(e.target.value.toUpperCase())}
          placeholder="ES: AB3K7X"
          maxLength={6}
          style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 20, textTransform: 'uppercase' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onAnnulla} style={btnStyle('#666', true)}>ANNULLA</button>
          <button onClick={handleCarica} disabled={loading || codice.trim().length < 6} style={btnStyle('#f5a623')}>
            {loading ? '...' : '💾 CARICA'}
          </button>
        </div>
      </PannelloOrnato>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LOBBY
// ════════════════════════════════════════════════════════════════════
function Lobby({ partita, codice, user, onAvvia, onEsci, mostraNotif }) {
  const giocatori = Object.values(partita?.giocatori || {});
  const sonoCreatore = partita?.creatore === user.uid;
  const possoAvviare = sonoCreatore && giocatori.length >= 2;

  const copiaLink = () => {
    navigator.clipboard?.writeText(codice);
    mostraNotif('Codice copiato!', '#00e676');
  };

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#9b59ff" style={{ padding: 20 }}>
        <TitoloOrnato livello={2} colore="#9b59ff">LOBBY</TitoloOrnato>

        {/* Codice partita */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 6 }}>
            CODICE PARTITA — condividilo con gli amici
          </div>
          <button onClick={copiaLink} style={{
            background: 'rgba(155,89,255,0.08)', border: '1px solid rgba(155,89,255,0.4)',
            borderRadius: 10, padding: '10px 24px', cursor: 'pointer',
            fontFamily: 'Orbitron', fontSize: 26, fontWeight: 700,
            color: '#9b59ff', letterSpacing: 10,
          }}>
            {codice} <span style={{ fontSize: 12, opacity: 0.5 }}>📋</span>
          </button>
        </div>

        {/* Lista giocatori */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 2, marginBottom: 8 }}>
            GIOCATORI ({giocatori.length}/15)
          </div>
          {giocatori.map(g => (
            <div key={g.uid} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 6,
              border: `1px solid ${g.coloreImpero}30`,
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: g.coloreImpero, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: g.coloreImpero }}>
                  {g.nomeImpero}
                  {g.uid === user.uid && <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 6 }}>(TU)</span>}
                  {g.uid === partita?.creatore && <span style={{ fontSize: 8, color: '#ffd666', marginLeft: 6 }}>👑</span>}
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676' }} title="Connesso" />
            </div>
          ))}
        </div>

        {giocatori.length < 2 && (
          <div style={{ textAlign: 'center', color: 'rgba(238,232,220,0.4)', fontSize: 9, fontFamily: 'Orbitron', marginBottom: 12 }}>
            In attesa di almeno 1 altro giocatore…
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEsci} style={btnStyle('#666', true)}>← ESCI</button>
          {possoAvviare && (
            <button onClick={onAvvia} style={btnStyle('#9b59ff')}>
              ⚔ AVVIA PARTITA ({giocatori.length} giocatori)
            </button>
          )}
          {!sonoCreatore && (
            <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              In attesa che il creatore avvii…
            </div>
          )}
        </div>
      </PannelloOrnato>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SCHERMATA PARTITA
// ════════════════════════════════════════════════════════════════════
function SchermataPartita({
  partita, codice, user, profilo, collezione, waifuCat, outfitCat,
  mostraNotif, onEsciEsalva, onAggiornata,
}) {
  const [terrSel, setTerrSel] = useState(null);
  const [vistaAttiva, setVistaAttiva] = useState('mappa'); // 'mappa' | 'battaglia' | 'fine'
  const [battagliaInfo, setBattagliaInfo] = useState(null);
  const [teamSelezionato, setTeamSelezionato] = useState(null);
  const [waifuSelezionate, setWaifuSelezionate] = useState([]);

  if (!partita) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#f5a623', fontFamily: 'Orbitron' }}>
        Caricamento partita…
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
          background: 'rgba(6,3,15,0.97)', border: `2px solid ${hoVinto ? '#00e676' : '#ff3d3d'}40`,
          borderRadius: 20, padding: 36, textAlign: 'center', maxWidth: 360,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{hoVinto ? '👑' : '💔'}</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: hoVinto ? '#00e676' : '#ff3d3d', letterSpacing: 3, marginBottom: 8 }}>
            {hoVinto ? 'HAI VINTO!' : 'PARTITA FINITA'}
          </div>
          {vincitore && (
            <div style={{ fontSize: 12, color: vincitore.coloreImpero, fontFamily: 'Orbitron', marginBottom: 20 }}>
              🏆 {vincitore.nomeImpero} ha conquistato il mondo!
            </div>
          )}
          <button onClick={onEsciEsalva} style={btnStyle('#f5a623')}>TORNA AL MENU</button>
        </div>
      </div>
    );
  }

  // Verifica se è in attesa di giocatori per riprendere
  const giocatoriNecessari = giocatoriAttivi;
  const giocatoriPresenti = giocatoriNecessari.filter(g => g.inLobby);
  const tuttiPresenti = giocatoriPresenti.length >= giocatoriNecessari.length;

  if (!tuttiPresenti) {
    const assenti = giocatoriNecessari.filter(g => !g.inLobby);
    return (
      <div className="fade-in">
        <PannelloOrnato glow="#f5a623" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
          <TitoloOrnato livello={2} colore="#f5a623">IN ATTESA</TitoloOrnato>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 16 }}>
            In attesa che tutti i giocatori si riconnettano
          </div>
          {assenti.map(g => (
            <div key={g.uid} style={{ fontSize: 11, color: g.coloreImpero, fontFamily: 'Orbitron', marginBottom: 4 }}>
              ⏳ {g.nomeImpero}
            </div>
          ))}
          <div style={{ marginTop: 20 }}>
            <button onClick={onEsciEsalva} style={btnStyle('#666', true)}>💾 SALVA ED ESCI</button>
          </div>
        </PannelloOrnato>
      </div>
    );
  }

  // Battaglia in corso (attivata da un altro giocatore o da me)
  const battaglia = partita.battagliaCorrente;
  const sonoCoinvolto = battaglia && (battaglia.attaccanteUid === myUid || battaglia.difensoreUid === myUid);
  const sonoAttaccante = battaglia?.attaccanteUid === myUid;
  const sonoDifensore = battaglia?.difensoreUid === myUid;

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
      <PannelloOrnato glow="#9b59ff" style={{ padding: '8px 14px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 2 }}>PARTITA MULTIPLAYER</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: myGiocatore?.coloreImpero || '#f5a623' }}>
              {myGiocatore?.nomeImpero}
              {sonoEliminato && <span style={{ color: '#ff3d3d', marginLeft: 6 }}> ELIMINATO</span>}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {isMioTurno && !sonoEliminato ? (
              <div style={{ fontSize: 10, color: '#00e676', fontFamily: 'Orbitron', letterSpacing: 2 }}>⚡ TUO TURNO</div>
            ) : (
              <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron' }}>
                Turno di: <span style={{ color: giocatori[turnoUid]?.coloreImpero || '#f5a623' }}>
                  {giocatori[turnoUid]?.nomeImpero || '…'}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip colore="#9b59ff" size="xs">🏴 {mieiTerritori.length}</Chip>
            <button onClick={onEsciEsalva} style={{
              padding: '4px 10px', background: 'rgba(100,100,100,0.15)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'rgba(238,232,220,0.6)', fontSize: 9, cursor: 'pointer', fontFamily: 'Orbitron',
            }}>💾 ESCI</button>
          </div>
        </div>
      </PannelloOrnato>

      {/* Mappa */}
      <PannelloOrnato glow="#9b59ff" style={{ padding: 8, marginBottom: 10, position: 'relative' }}>
        <MappaScrollabileMulti
          territoriUtente={territoriUtente}
          coloreImpero={myGiocatore?.coloreImpero}
          nomeImpero={myGiocatore?.nomeImpero}
          territorioSelezionato={terrSel?.id}
          onTerritorioClick={handleTerritorioClick}
          mieiTerritori={mieiTerritori}
        />

        {/* Popup territorio */}
        {terrSel && (() => {
          const info = mappaTerritori[terrSel.id] || {};
          const isConfinante = mieiTerritori.length === 0 || (terrSel.conf || []).some(c => mieiTerritori.includes(c));
          return (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'rgba(6,3,15,0.96)', backdropFilter: 'blur(14px)',
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
// ════════════════════════════════════════════════════════════════════
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

  // ── Stato battaglia ────────────────────────────────────────────────
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

  // ── Stato PvP ─────────────────────────────────────────────────────
  // In modalità PvP, le scelte vengono salvate su Firestore e lette dall'altra parte.
  // Fasi PvP per chi ha il turno (sceglie stat+dir):
  //   'pvpScegliWaifu' → 'pvpScegliStat' → 'pvpScegliDir' → 'pvpAttesaAvv'
  // Fasi PvP per chi NON ha il turno (sceglie solo la propria waifu):
  //   'pvpScegliWaifuRispondi' → 'pvpAttesaRisoluzione'
  // Dopo che entrambi hanno scelto, il giocatore con turno risolve localmente
  // e poi entrambi vedono il reveal.
  const [pvpHoScelto, setPvpHoScelto] = useState(false);    // true = ho già inviato la mia scelta
  const [pvpRoundProcessato, setPvpRoundProcessato] = useState(0); // ultimo round già risolto
  const [pvpHoPremutoProsegui, setPvpHoPremutoProsegui] = useState(false); // true = ho premuto "Prosegui turno"
  const proseguiEseguitoRef = useRef(false); // guard doppia chiamata _eseguiProssimoRound

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

  // ── PvP: osserva Firestore per le scelte dell'avversario ──────────
  useEffect(() => {
    if (isCpu || !iniziata) return;
    const sceltePvp = battaglia?.sceltePvp || {};
    const roundKey = inSuddenDeath ? 'sd' : String(round);
    const scelteRound = sceltePvp[roundKey] || {};
    const miaScelta = scelteRound[myUid];
    const sceltaAvv = scelteRound[avversarioUid];

    // Ricezione scelta avversario mentre aspetto
    if (fase === 'pvpAttesaAvv' && sceltaAvv && pvpRoundProcessato < (inSuddenDeath ? 999 : round)) {
      // Ho scelto io, ora è arrivata la scelta dell'avversario → risolvi
      _risolviPvpRound(scelteRound, roundKey);
    }
    if (fase === 'pvpAttesaRisoluzione' && sceltaAvv && miaScelta && pvpRoundProcessato < (inSuddenDeath ? 999 : round)) {
      // L'avversario (chi ha turno) ha già risolto? Guarda se c'è un vincitore nel risultato
      // In realtà entrambi vedranno il reveal quando le scelte sono presenti;
      // il reveal lo triggera chiunque legga per primo entrambe le scelte.
      _risolviPvpRound(scelteRound, roundKey);
    }

    // Avversario ha scelto la propria waifu mentre io sto ancora scegliendo stat/dir
    if ((fase === 'pvpScegliStat' || fase === 'pvpScegliDir') && sceltaAvv) {
      const wAvv = mazzoC.find(w => w.id === sceltaAvv.waifuId || w.id === `opp_${sceltaAvv.waifuId}`);
      if (wAvv) setCarteC(wAvv);
    }

    // Primo turno PvP: leggo chi inizia da Firestore
    if (!primoTurno && battaglia?.primoTurno && iniziata && fase === 'coin') {
      const pt = battaglia.primoTurno === myUid ? 'player' : 'cpu';
      setCoinResult(pt); setPrimoTurno(pt);
      setTimeout(() => {
        setTurno(pt); setTimeLeft(30);
        setFase(pt === 'player' ? 'pvpScegliWaifu' : 'pvpScegliWaifuRispondi');
      }, 1800);
    }

    // PvP: entrambi hanno premuto "Prosegui turno" → passa al round successivo
    if (fase === 'pvpAttesaProsegui') {
      const proseguiRoundData = battaglia?.proseguiRound || {};
      const roundKey = inSuddenDeath ? 'sd' : String(round);
      const proseguiRound = proseguiRoundData[roundKey] || {};
      const entrambiProseguito = proseguiRound[myUid] && proseguiRound[avversarioUid];
      if (entrambiProseguito) {
        _eseguiProssimoRound();
      }
    }
  }, [partita?.battagliaCorrente, fase, iniziata, round, inSuddenDeath]);

  const _risolviPvpRound = (scelteRound, roundKey) => {
    // Evita doppia risoluzione
    const rKey = inSuddenDeath ? 999 : round;
    if (pvpRoundProcessato >= rKey) return;
    setPvpRoundProcessato(rKey);

    const miaScelta = scelteRound[myUid];
    const sceltaAvv = scelteRound[avversarioUid];
    if (!miaScelta || !sceltaAvv) return;

    // Chi ha il turno ha scelto stat e dir; l'altro ha scelto solo waifu
    const sceltaTurno = turno === 'player' ? miaScelta : sceltaAvv;
    const statKey = sceltaTurno.stat;
    const dir = sceltaTurno.direzione;

    const wMyId = miaScelta.waifuId;
    const wAvvId = sceltaAvv.waifuId;
    const wMy = mazzoP.find(w => w.id === wMyId);
    const wAvv = mazzoC.find(w => w.id === wAvvId || w.id === `opp_${wAvvId}`);

    if (!wMy || !wAvv) return;

    setCarteP(wMy);
    setCarteC(wAvv);
    setStatScelta(statKey);
    setDirezione(dir);
    setStatsUsatePartita(prev => prev.includes(statKey) ? prev : [...prev, statKey]);
    setFase('reveal');

    setTimeout(() => {
      const { modOpp: modP } = applicaAbilitaOutfit(wMy, wMy._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
      const { modOpp: modC } = applicaAbilitaOutfit(wAvv, wAvv._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
      const pEff = applicaModificatoriOpp(wMy, modC, STAT_RANGES_DEFAULT);
      const cEff = applicaModificatoriOpp(wAvv, modP, STAT_RANGES_DEFAULT);
      const valP = pEff[statKey]; const valC = cEff[statKey];
      let vince = valP === valC ? 'pareggio' : dir === 'piu' ? (valP > valC ? 'player' : 'cpu') : (valP < valC ? 'player' : 'cpu');
      setVincitoreRound(vince);
      setPunteggio(prev => ({ player: prev.player + (vince === 'player' ? 1 : 0), cpu: prev.cpu + (vince === 'cpu' ? 1 : 0) }));
      setRisultatiWaifu(prev => ({
        ...prev,
        [wMy.id]: vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio',
        [wAvv.id]: vince === 'cpu' ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio',
      }));
      if (inSuddenDeath) {
        if (vince === 'pareggio') setTimeout(() => avviaSuddenDeath(), 2500);
        else setTimeout(() => fineBattaglia(vince === 'player'), 2500);
      } else {
        setFase('roundEnd');
      }
    }, 1500);
  };

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

  // ── Attesa mazzo avversario ────────────────────────────────────────
  const [attesaMazzoAvv, setAttesaMazzoAvv] = useState(false);
  const [mazzoSalvato, setMazzoSalvato] = useState(false);

  useEffect(() => {
    if (!attesaMazzoAvv || isCpu) return;
    const mazziPartita = partita?.battagliaCorrente?.mazzi || {};
    const mazzoAvv = mazziPartita[avversarioUid];
    if (!mazzoAvv || mazzoAvv.length === 0) return;

    const mazzoAvversario = mazzoAvv.map(id => {
      const w = waifuCat.find(x => x.id === id);
      return w ? { ...w, id: `opp_${w.id}`, _outfitEquipIds: [] } : null;
    }).filter(Boolean);
    if (mazzoAvversario.length < 5) return;

    setMazzoC(mazzoAvversario);
    setAttesaMazzoAvv(false);
    setModoBattaglia(false);
    setIniziata(true);
    setPunteggio({ player: 0, cpu: 0 }); setRound(1);
    setRisultatiWaifu({}); setStatsUsatePartita([]);
    setCarteP(null); setCarteC(null); setStatScelta(null);
    setDirezione(null); setVincitoreRound(null);
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setCoinResult(null); setInSuddenDeath(false);
    setPvpHoScelto(false); setPvpRoundProcessato(0); setPvpHoPremutoProsegui(false);
    setFase('coin');

    // Solo l'attaccante scrive primoTurno su Firestore (evita race condition)
    if (sonoAttaccante) {
      // L'attaccante inizia sempre in PvP
      salvaPrimoTurnoPvp(codice, myUid).catch(() => {});
    }
  }, [partita?.battagliaCorrente?.mazzi, attesaMazzoAvv]);

  const confermaEAvvia = async () => {
    let mazzoUtente;
    if (teamSel && teamSel !== 'manuale') {
      const team = teams[teamSel];
      mazzoUtente = team.waifu.map(buildWaifuBattaglia).filter(Boolean);
    } else {
      if (waifuSel.length !== 5) { mostraNotif('Seleziona 5 waifu!', '#ff3d3d'); return; }
      mazzoUtente = waifuSel.map(buildWaifuBattaglia).filter(Boolean);
    }
    if (mazzoUtente.length < 5) { mostraNotif('Team insufficiente!', '#ff3d3d'); return; }

    setMazzoP(mazzoUtente);

    if (!isCpu) {
      // ── Battaglia PvP ──
      const mazzoIds = mazzoUtente.map(w => w.id);
      try {
        await salvaMazzoBattaglia(codice, myUid, mazzoIds);
        setMazzoSalvato(true);
      } catch (e) {
        mostraNotif('Errore salvataggio mazzo', '#ff3d3d');
        return;
      }

      const mazziPartita = partita?.battagliaCorrente?.mazzi || {};
      const mazzoAvv = mazziPartita[avversarioUid];

      if (mazzoAvv && mazzoAvv.length >= 5) {
        const mazzoAvversario = mazzoAvv.map(id => {
          const w = waifuCat.find(x => x.id === id);
          return w ? { ...w, id: `opp_${w.id}`, _outfitEquipIds: [] } : null;
        }).filter(Boolean);

        setMazzoC(mazzoAvversario);
        setModoBattaglia(false); setIniziata(true);
        setPunteggio({ player: 0, cpu: 0 }); setRound(1);
        setRisultatiWaifu({}); setStatsUsatePartita([]);
        setCarteP(null); setCarteC(null); setStatScelta(null);
        setDirezione(null); setVincitoreRound(null);
        setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
        setCoinResult(null); setInSuddenDeath(false);
        setPvpHoScelto(false); setPvpRoundProcessato(0); setPvpHoPremutoProsegui(false);
        setFase('coin');
        if (sonoAttaccante) {
          salvaPrimoTurnoPvp(codice, myUid).catch(() => {});
        }
      } else {
        setAttesaMazzoAvv(true);
      }
      return;
    }

    // ── Battaglia vs CPU ──
    const playerIds = new Set(mazzoUtente.map(w => w.id));
    const cpuPool = waifuCat.filter(w => !playerIds.has(w.id));
    const cpuShuffled = [...cpuPool].sort(() => Math.random() - 0.5).slice(0, 5);
    const mazzoCPU = cpuShuffled.map(w => ({ ...w, _outfitEquipIds: [] }));
    setMazzoC(mazzoCPU);
    setModoBattaglia(false); setIniziata(true);
    setPunteggio({ player: 0, cpu: 0 }); setRound(1);
    setRisultatiWaifu({}); setStatsUsatePartita([]);
    setCarteP(null); setCarteC(null); setStatScelta(null);
    setDirezione(null); setVincitoreRound(null);
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setCoinResult(null); setInSuddenDeath(false);
    setFase('coin');
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'player' : 'cpu';
      setCoinResult(result); setPrimoTurno(result);
      setTimeout(() => {
        setTurno(result); setTimeLeft(30);
        setFase(result === 'player' ? 'playerScegliWaifu' : 'cpuSceglieTutto');
      }, 1800);
    }, 200);
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
      // PvP: scegli casuale e invia
      const pDisp = mazzoP.filter(w => !risultatiWaifu[w.id]);
      if (fase === 'pvpScegliWaifu') {
        const p = pDisp[Math.floor(Math.random() * pDisp.length)];
        if (p) pvpScegliWaifu(p);
      } else if (fase === 'pvpScegliStat') {
        const statsDisp = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));
        const s = statsDisp[Math.floor(Math.random() * statsDisp.length)] || STATS_BATTAGLIA[0];
        pvpScegliStat(s.key);
      } else if (fase === 'pvpScegliDir') {
        pvpScegliDir(Math.random() < 0.5 ? 'piu' : 'meno');
      } else if (fase === 'pvpScegliWaifuRispondi') {
        const p = pDisp[Math.floor(Math.random() * pDisp.length)];
        if (p) pvpRispondiWaifu(p);
      } else if (fase === 'suddenDeathWaifu') {
        const p = pDisp[Math.floor(Math.random() * pDisp.length)];
        if (p) pvpScegliWaifuSD(p);
      } else if (fase === 'pvpAttesaProsegui') {
        // Timer scaduto su "Prosegui turno": prosegui automaticamente
        _pvpPremutoProsegui();
      }
    }
  };

  // ── Handlers CPU ──────────────────────────────────────────────────
  const onScegliWaifuCpu = (w) => { if (fase !== 'playerScegliWaifu') return; setCarteP(w); setTimeLeft(30); setFase('playerScegliStat'); };
  const onScegliStatCpu = (k) => { if (fase !== 'playerScegliStat') return; setStatScelta(k); setStatsUsatePartita(prev => prev.includes(k) ? prev : [...prev, k]); setTimeLeft(30); setFase('playerScegliDir'); };
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
    setStatsUsatePartita(prev => prev.includes(cpuStatPending) ? prev : [...prev, cpuStatPending]);
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
      setPunteggio(prev => ({ player: prev.player + (vince === 'player' ? 1 : 0), cpu: prev.cpu + (vince === 'cpu' ? 1 : 0) }));
      setRisultatiWaifu(prev => ({
        ...prev,
        [waifuP.id]: vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio',
        [waifuC.id]: vince === 'cpu' ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio',
      }));
      setFase('roundEnd');
    }, 1500);
  };

  // ── Handlers PvP ─────────────────────────────────────────────────
  // Chi ha il turno: sceglie waifu → stat → dir → invia tutto
  const pvpScegliWaifu = (w) => {
    if (fase !== 'pvpScegliWaifu') return;
    setCarteP(w);
    setTimeLeft(30);
    setFase('pvpScegliStat');
  };

  const pvpScegliStat = (k) => {
    if (fase !== 'pvpScegliStat') return;
    setStatScelta(k);
    setStatsUsatePartita(prev => prev.includes(k) ? prev : [...prev, k]);
    setTimeLeft(30);
    setFase('pvpScegliDir');
  };

  const pvpScegliDir = async (dir) => {
    if (fase !== 'pvpScegliDir') return;
    setDirezione(dir);
    setFase('pvpAttesaAvv');
    setPvpHoScelto(true);
    const roundKey = inSuddenDeath ? 'sd' : String(round);
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

  // Chi NON ha il turno: sceglie solo la propria waifu e aspetta
  const pvpRispondiWaifu = async (w) => {
    if (fase !== 'pvpScegliWaifuRispondi') return;
    setCarteP(w);
    setFase('pvpAttesaRisoluzione');
    setPvpHoScelto(true);
    const roundKey = inSuddenDeath ? 'sd' : String(round);
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

  // Sudden death PvP: chi NON ha turno sceglie waifu
  const pvpScegliWaifuSD = async (w) => {
    if (fase !== 'suddenDeathWaifu') return;
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
  };

  const prossimoRound = () => {
    if (isCpu) {
      if (round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3) {
        if (punteggio.player === punteggio.cpu) avviaSuddenDeath();
        else fineBattaglia(punteggio.player > punteggio.cpu);
        return;
      }
      const nr = round + 1;
      const ts = primoTurno === 'player' ? (nr % 2 === 1 ? 'player' : 'cpu') : (nr % 2 === 1 ? 'cpu' : 'player');
      setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null); setVincitoreRound(null);
      setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
      setRound(nr); setTurno(ts); setTimeLeft(30);
      setFase(ts === 'player' ? 'playerScegliWaifu' : 'cpuSceglieTutto');
    } else {
      // PvP: il bottone "Prosegui turno" salva su Firestore e porta in attesa
      _pvpPremutoProsegui();
    }
  };

  // PvP: il giocatore preme "Prosegui turno" → salva su Firestore
  const _pvpPremutoProsegui = async () => {
    if (pvpHoPremutoProsegui) return;
    setPvpHoPremutoProsegui(true);
    setFase('pvpAttesaProsegui');
    setTimeLeft(30);
    const roundKey = inSuddenDeath ? 'sd' : String(round);
    try {
      await salvaProseguiTurnoRound(codice, myUid, roundKey);
    } catch (e) {
      mostraNotif('Errore sincronizzazione', '#ff3d3d');
    }
  };

  // Esecuzione effettiva del passaggio al round successivo (PvP)
  const _eseguiProssimoRound = () => {
    if (proseguiEseguitoRef.current) return;
    proseguiEseguitoRef.current = true;
    if (round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3) {
      if (punteggio.player === punteggio.cpu) avviaSuddenDeath();
      else fineBattaglia(punteggio.player > punteggio.cpu);
      return;
    }
    const nr = round + 1;
    // I turni si alternano: chi NON aveva il turno al round precedente ce l'ha ora
    const ptUid = primoTurno === 'player' ? myUid : avversarioUid;
    const turnoUid = nr % 2 === 1 ? ptUid : (ptUid === myUid ? avversarioUid : myUid);
    const nuovoTurno = turnoUid === myUid ? 'player' : 'cpu';
    setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setPvpHoScelto(false);
    setPvpHoPremutoProsegui(false);
    setPvpRoundProcessato(nr - 1);
    proseguiEseguitoRef.current = false;
    setRound(nr); setTurno(nuovoTurno); setTimeLeft(30);
    setFase(nuovoTurno === 'player' ? 'pvpScegliWaifu' : 'pvpScegliWaifuRispondi');
  };

  const avviaSuddenDeath = () => {
    setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setInSuddenDeath(true);
    const pool = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));
    const stat = (pool.length > 0 ? pool : STATS_BATTAGLIA)[Math.floor(Math.random() * (pool.length || STATS_BATTAGLIA.length))];
    const dir = Math.random() < 0.5 ? 'piu' : 'meno';

    if (isCpu) {
      const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
      const cpuW = cpuDisp.length > 0 ? cpuDisp[Math.floor(Math.random() * cpuDisp.length)] : mazzoC[Math.floor(Math.random() * mazzoC.length)];
      setCpuWaifuPending(cpuW); setCpuStatPending(stat.key); setCpuDirPending(dir);
      setCarteC(cpuW); setTimeLeft(30); setFase('suddenDeathWaifu');
    } else {
      // PvP Sudden Death: chi ha il turno (alternato) sceglie stat+dir via Firestore già salvato
      // Usiamo l'attaccante come "chi ha turno in SD" per semplicità
      const turnoSD = sonoAttaccante ? 'player' : 'cpu';
      setTurno(turnoSD);
      setPvpHoScelto(false);
      setPvpRoundProcessato(998);

      if (turnoSD === 'player') {
        // Io ho il turno: scelgo la mia waifu + invio stat/dir automatici (random, annunciato)
        // In SD il chi-ha-turno sceglie waifu e poi invia scelta completa
        setTimeLeft(30);
        // Salvo stat e dir come "pending" locali, verranno inclusi quando scelgo waifu
        setCpuStatPending(stat.key); setCpuDirPending(dir);
        setStatScelta(stat.key); setDirezione(dir);
        setFase('suddenDeathWaifu');
      } else {
        // L'avversario ha il turno: aspetto che scelga e poi scelgo la mia waifu
        // Ma devo mostrare a me la selezione waifu
        setCpuStatPending(stat.key); setCpuDirPending(dir);
        setStatScelta(stat.key); setDirezione(dir);
        setTimeLeft(30);
        setFase('suddenDeathWaifu');
      }
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

  // Sudden death PvP: chi ha turno sceglie waifu e invia tutto
  const pvpScegliWaifuSDTurno = async (w) => {
    if (fase !== 'suddenDeathWaifu' || isCpu) return;
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
  };

  const fineBattaglia = (vittoria) => {
    setFase('gameEnd');
    const vincitoreUid = vittoria ? myUid : avversarioUid;
    // In PvP: il vincitore ottiene un pacchetto sfida, il perdente non perde energia
    // Questo viene gestito tramite onBattagliaFinita che chiama registraRisultatoBattagliaPvp
    // Il pacchetto sfida al vincitore viene assegnato lato server/Firestore dal chiamante
    onBattagliaFinita(vincitoreUid);
  };

  const getStatoWaifu = (id) => {
    if (inSuddenDeath) { if (carteP?.id === id && !vincitoreRound) return 'inUso'; return 'disponibile'; }
    if (carteP?.id === id && !vincitoreRound) return 'inUso';
    if (risultatiWaifu[id]) return risultatiWaifu[id];
    return 'disponibile';
  };
  const getColoreBordo = (stato) => ({ vinta: '#00e676', persa: '#ff3d3d', pareggio: '#ffd666', inUso: '#9b59ff' }[stato] || 'rgba(245,166,35,0.2)');

  const nomeAvversario = isCpu ? 'CPU' : (avversario?.nomeImpero || 'Avversario');
  const coloreAvversario = isCpu ? '#666' : (avversario?.coloreImpero || '#ff3d3d');

  // ── Selezione team ────────────────────────────────────────────────
  if (modoBattaglia) {
    if (attesaMazzoAvv) {
      return (
        <div className="fade-in">
          <PannelloOrnato glow="#ff2d78" style={{ padding: 28, textAlign: 'center' }}>
            <TitoloOrnato livello={2} colore="#ff2d78">BATTAGLIA PER {terrData?.nome}</TitoloOrnato>
            <div style={{ fontSize: 36, margin: '20px 0' }}>⏳</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#ffd666', letterSpacing: 2, marginBottom: 8 }}>
              MAZZO INVIATO!
            </div>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 20 }}>
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
          </PannelloOrnato>
        </div>
      );
    }

    const canConfirm = teamSel && teamSel !== 'manuale' ? !!teams[teamSel] : waifuSel.length === 5;
    return (
      <div className="fade-in">
        <PannelloOrnato glow="#ff2d78" style={{ padding: 20 }}>
          <TitoloOrnato livello={2} colore="#ff2d78">BATTAGLIA PER {terrData?.nome}</TitoloOrnato>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron' }}>
              vs <span style={{ color: coloreAvversario }}>{nomeAvversario}</span>
              {!isCpu && (
                <span style={{ display: 'block', marginTop: 4, color: '#ffd666', fontSize: 9 }}>
                  ⚡ SFIDA CONTRO GIOCATORE REALE
                </span>
              )}
            </div>
          </div>
          {Object.keys(teams).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#00e676', letterSpacing: 2, marginBottom: 6, textAlign: 'center', fontFamily: 'Orbitron' }}>TEAM SALVATI</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Object.entries(teams).map(([id, team]) => (
                  <button key={id} onClick={() => { setTeamSel(id); setWaifuSel([]); }} style={{
                    padding: '8px 16px', background: teamSel === id ? 'linear-gradient(135deg, #00e676, #00e67680)' : 'rgba(255,255,255,0.03)',
                    color: teamSel === id ? '#000' : '#eee8dc', border: `1px solid ${teamSel === id ? 'transparent' : 'rgba(0,230,118,0.2)'}`,
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'Orbitron', fontSize: 10, fontWeight: 600,
                  }}>{team.nome} ({team.waifu.length})</button>
                ))}
                <button onClick={() => setTeamSel('manuale')} style={{
                  padding: '8px 16px', background: teamSel === 'manuale' ? 'linear-gradient(135deg, #f5a623, #f5a62380)' : 'rgba(255,255,255,0.03)',
                  color: teamSel === 'manuale' ? '#000' : '#eee8dc', border: `1px solid ${teamSel === 'manuale' ? 'transparent' : 'rgba(245,166,35,0.2)'}`,
                  borderRadius: 8, cursor: 'pointer', fontFamily: 'Orbitron', fontSize: 10, fontWeight: 600,
                }}>✋ MANUALE</button>
              </div>
            </div>
          )}
          {(teamSel === 'manuale' || Object.keys(teams).length === 0) && (
            <div>
              <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', textAlign: 'center', marginBottom: 8 }}>SCEGLI 5 WAIFU</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                {waifuDisponibili.map(w => {
                  const sel = waifuSel.includes(w.id);
                  return (
                    <div key={w.id} onClick={() => {
                      if (sel) setWaifuSel(waifuSel.filter(x => x !== w.id));
                      else if (waifuSel.length < 5) setWaifuSel([...waifuSel, w.id]);
                    }} style={{ cursor: 'pointer', opacity: sel ? 1 : 0.5, border: sel ? '2px solid #00e676' : '2px solid transparent', borderRadius: 8 }}>
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
        </PannelloOrnato>
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
  if (fase === 'gameEnd') {
    const vittoria = punteggio.player > punteggio.cpu;
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ background: 'rgba(6,3,15,0.97)', border: `2px solid ${vittoria ? '#00e676' : '#ff3d3d'}40`, borderRadius: 20, padding: 36, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>{vittoria ? '👑' : '💔'}</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: vittoria ? '#00e676' : '#ff3d3d', letterSpacing: 3 }}>
            {vittoria ? 'VITTORIA!' : 'SCONFITTA'}
          </div>
          <div style={{ fontSize: 28, fontFamily: 'Orbitron', fontWeight: 700, marginTop: 8 }}>
            <span style={{ color: '#00e676' }}>{punteggio.player}</span>
            <span style={{ color: '#444', margin: '0 8px' }}>—</span>
            <span style={{ color: '#ff3d3d' }}>{punteggio.cpu}</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron' }}>
            {vittoria ? `${terrData?.nome} conquistato!` : `${nomeAvversario} ha resistito!`}
          </div>
          <div style={{ marginTop: 20, fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron' }}>
            Aggiornamento mappa in corso…
          </div>
        </div>
      </div>
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

  const labelFase = () => {
    if (!isCpu) {
      if (fase === 'pvpScegliWaifu') return '👇 Scegli la tua waifu';
      if (fase === 'pvpScegliStat') return '🎯 Scegli la statistica';
      if (fase === 'pvpScegliDir') return '📊 Scegli la direzione';
      if (fase === 'pvpAttesaAvv') return `⏳ In attesa di ${nomeAvversario}…`;
      if (fase === 'pvpScegliWaifuRispondi') return '👇 Scegli la tua waifu';
      if (fase === 'pvpAttesaRisoluzione') return `⏳ In attesa di ${nomeAvversario}…`;
      if (fase === 'roundEnd') return '🏁 Risultato round';
      if (fase === 'pvpAttesaProsegui') return `⏳ In attesa che ${nomeAvversario} prosegua…`;
      if (fase === 'suddenDeathWaifu') return turno === 'player' ? '⚡ SUDDEN DEATH — Scegli waifu!' : '⚡ SUDDEN DEATH — Scegli waifu!';
    }
    if (fase === 'playerScegliWaifu') return '👇 Scegli la tua waifu';
    if (fase === 'playerScegliStat') return '🎯 Scegli la statistica';
    if (fase === 'playerScegliDir') return '📊 Scegli la direzione';
    if (fase === 'cpuRispondeWaifu') return `🎴 ${nomeAvversario} sceglie...`;
    if (fase === 'cpuSceglieTutto') return `🎴 ${nomeAvversario} sta decidendo...`;
    if (fase === 'playerScegliWaifuVsCPU') return '👇 Scegli la tua waifu';
    if (fase === 'reveal') return '⚡ Risoluzione...';
    if (fase === 'suddenDeathWaifu') return '⚡ SUDDEN DEATH — Scegli!';
    if (fase === 'suddenDeathReveal') return '⚡ Risoluzione Sudden Death...';
    return '';
  };

  // Determine se mostrare il timer (solo nelle fasi interattive per questo giocatore)
  const showTimer = FASI_TIMER_ACTIVE.includes(fase);

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#ff2d78" style={{ padding: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{profilo.nomeImpero}</div>
            <div style={{ fontSize: 28, color: '#00e676', fontFamily: 'Orbitron', fontWeight: 700 }}>{punteggio.player}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 10, color: '#ff2d78' }}>
              {inSuddenDeath ? '⚡ SUDDEN DEATH' : `ROUND ${round}/5`}
            </div>
            <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: 'Orbitron' }}>
              {turno === 'player' ? 'TUO TURNO' : `TURNO ${nomeAvversario.toUpperCase()}`}
            </div>
            {showTimer && (
              <div style={{ fontSize: 20, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginTop: 2 }}>
                ⏱ {timeLeft}s
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{nomeAvversario}</div>
            <div style={{ fontSize: 28, color: coloreAvversario, fontFamily: 'Orbitron', fontWeight: 700 }}>{punteggio.cpu}</div>
          </div>
        </div>
        {labelFase() && (
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: '#ffd666', fontFamily: 'Orbitron' }}>
            {labelFase()}
          </div>
        )}
      </PannelloOrnato>

      {/* Territorio in gioco */}
      {terrData && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <Chip colore="#ff2d78" size="sm">⚔ {terrData.nome} — {NOMI_CONTINENTI[terrData.cont]}</Chip>
        </div>
      )}

      {/* ── Selezione waifu (chi ha il turno) ── */}
      {(fase === 'playerScegliWaifu' || fase === 'pvpScegliWaifu') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {waifuPDisp.map(w => (
            <div key={w.id} onClick={() => isCpu ? onScegliWaifuCpu(w) : pvpScegliWaifu(w)}
              style={{ cursor: 'pointer', transform: 'scale(1)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <CartaWaifu waifu={w} dimensione="piccola" />
            </div>
          ))}
        </div>
      )}

      {/* ── Selezione waifu (chi risponde - PvP) ── */}
      {fase === 'pvpScegliWaifuRispondi' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 9, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron' }}>
            {nomeAvversario} sta scegliendo stat e direzione…
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            {waifuPDisp.map(w => (
              <div key={w.id} onClick={() => pvpRispondiWaifu(w)}
                style={{ cursor: 'pointer', transform: 'scale(1)', transition: 'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <CartaWaifu waifu={w} dimensione="piccola" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Selezione waifu vs CPU (risposta) ── */}
      {fase === 'playerScegliWaifuVsCPU' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {waifuPDisp.map(w => (
            <div key={w.id} onClick={() => onScegliWaifuVsCpu(w)}
              style={{ cursor: 'pointer', transform: 'scale(1)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <CartaWaifu waifu={w} dimensione="piccola" />
            </div>
          ))}
        </div>
      )}

      {/* ── Sudden Death selezione waifu ── */}
      {fase === 'suddenDeathWaifu' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {waifuPDisp.map(w => (
            <div key={w.id} onClick={() => {
              if (isCpu) onScegliWaifuSD(w);
              else if (turno === 'player') pvpScegliWaifuSDTurno(w);
              else pvpScegliWaifuSD(w);
            }}
              style={{ cursor: 'pointer', transform: 'scale(1)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <CartaWaifu waifu={w} dimensione="piccola" />
            </div>
          ))}
        </div>
      )}

      {/* ── Selezione stat ── */}
      {(fase === 'playerScegliStat' || fase === 'pvpScegliStat') && carteP && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <CartaWaifu waifu={carteP} dimensione="piccola" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {statsDisp.map(s => (
              <button key={s.key} onClick={() => isCpu ? onScegliStatCpu(s.key) : pvpScegliStat(s.key)} style={{
                padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(245,166,35,0.3)',
                background: 'rgba(245,166,35,0.08)', color: '#ffd666', fontFamily: 'Orbitron', fontSize: 11,
                cursor: 'pointer', letterSpacing: 1,
              }}>{s.icon} {s.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selezione direzione ── */}
      {(fase === 'playerScegliDir' || fase === 'pvpScegliDir') && statInfo && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <Chip colore="#ffd666">{statInfo.icon} {statInfo.label}</Chip>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => isCpu ? onScegliDirCpu('piu') : pvpScegliDir('piu')} style={{ ...btnStyle('#00e676'), flex: 1, maxWidth: 140 }}>↑ PIÙ ALTA</button>
            <button onClick={() => isCpu ? onScegliDirCpu('meno') : pvpScegliDir('meno')} style={{ ...btnStyle('#ff3d3d'), flex: 1, maxWidth: 140 }}>↓ PIÙ BASSA</button>
          </div>
        </div>
      )}

      {/* ── Attesa avversario PvP ── */}
      {(fase === 'pvpAttesaAvv' || fase === 'pvpAttesaRisoluzione') && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          {carteP && <div style={{ marginBottom: 10 }}><CartaWaifu waifu={carteP} dimensione="piccola" /></div>}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: coloreAvversario, animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron' }}>
            In attesa di {nomeAvversario}…
          </div>
        </div>
      )}

      {/* ── Reveal ── */}
      {(fase === 'reveal' || fase === 'roundEnd' || fase === 'pvpAttesaProsegui' || fase === 'cpuRispondeWaifu' || fase === 'suddenDeathReveal') && carteP && carteC && statScelta && (
        <div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'Orbitron', color: '#00e676', marginBottom: 4 }}>TU</div>
              <CartaWaifu waifu={carteP} dimensione="piccola" />
              <div style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#ffd666', marginTop: 4 }}>
                {carteP[statScelta]}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 24 }}>⚔</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontFamily: 'Orbitron', color: coloreAvversario, marginBottom: 4 }}>{nomeAvversario.toUpperCase()}</div>
              <CartaWaifu waifu={{ ...carteC, nome: (fase === 'cpuRispondeWaifu' ? '?' : carteC.nome) }} dimensione="piccola" />
              <div style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#ffd666', marginTop: 4 }}>
                {['reveal', 'roundEnd', 'pvpAttesaProsegui', 'suddenDeathReveal'].includes(fase) ? carteC[statScelta] : '?'}
              </div>
            </div>
          </div>
          {(fase === 'roundEnd' || fase === 'pvpAttesaProsegui') && vincitoreRound && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 20, fontFamily: 'Orbitron', fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? coloreAvversario : '#ffd666' }}>
                {vincitoreRound === 'player' ? '✅ HAI VINTO IL ROUND' : vincitoreRound === 'cpu' ? `❌ ${nomeAvversario.toUpperCase()} HA VINTO` : '🤝 PAREGGIO'}
              </div>
            </div>
          )}
          {fase === 'roundEnd' && (
            <div style={{ textAlign: 'center' }}>
              {isCpu ? (
                <button onClick={prossimoRound} style={btnStyle('#ff2d78')}>PROSSIMO ROUND →</button>
              ) : (
                <button onClick={prossimoRound} style={btnStyle('#ff2d78')}>✅ PROSEGUI TURNO</button>
              )}
            </div>
          )}
          {!isCpu && fase === 'pvpAttesaProsegui' && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: coloreAvversario, animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron' }}>
                In attesa di {nomeAvversario}…
              </div>
              <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAPPA SCROLLABILE MULTI (stessa logica di quella single player)
// ════════════════════════════════════════════════════════════════════
function MappaScrollabileMulti({ territoriUtente, coloreImpero, nomeImpero, territorioSelezionato, onTerritorioClick, mieiTerritori = [] }) {
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
          />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// FORM SELEZIONE IMPERO (nome + colore)
// ════════════════════════════════════════════════════════════════════
function FormImpero({ nomeImpero, setNomeImpero, coloreImpero, setColoreImpero, coloriBloccati = [] }) {
  return (
    <div>
      <label style={labelStyle}>NOME IMPERO</label>
      <input
        value={nomeImpero}
        onChange={e => setNomeImpero(e.target.value)}
        placeholder="Es: Drago Dorato"
        maxLength={30}
        style={inputStyle}
      />
      <label style={{ ...labelStyle, marginTop: 14 }}>COLORE IMPERO</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {PALETTE_COLORI.map(c => {
          const bloccato = coloriBloccati.includes(c);
          return (
            <button
              key={c}
              disabled={bloccato}
              onClick={() => !bloccato && setColoreImpero(c)}
              title={bloccato ? 'Già in uso' : c}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: c,
                border: coloreImpero === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.1)',
                cursor: bloccato ? 'not-allowed' : 'pointer',
                opacity: bloccato ? 0.25 : 1,
                boxShadow: coloreImpero === c ? `0 0 12px ${c}` : 'none',
                transition: 'all 0.15s',
              }}
            />
          );
        })}
      </div>
      {/* Preview */}
      <div style={{ marginTop: 14, padding: '8px 14px', borderRadius: 8, background: `${coloreImpero}15`, border: `1px solid ${coloreImpero}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: coloreImpero }} />
        <span style={{ fontFamily: 'Orbitron', fontSize: 12, color: coloreImpero }}>{nomeImpero || 'Il tuo Impero'}</span>
      </div>
    </div>
  );
}

// ─── Stili helper ────────────────────────────────────────────────────
const btnStyle = (color, secondary = false) => ({
  flex: secondary ? undefined : 1,
  padding: '12px 18px',
  background: secondary ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
  border: `1px solid ${secondary ? 'rgba(255,255,255,0.1)' : color + '60'}`,
  borderRadius: 10,
  cursor: 'pointer',
  color: secondary ? 'rgba(238,232,220,0.6)' : '#fff',
  fontFamily: 'Orbitron',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  textAlign: 'center',
  transition: 'all 0.15s',
});

const labelStyle = {
  display: 'block',
  fontSize: 9,
  color: 'rgba(238,232,220,0.4)',
  fontFamily: 'Orbitron',
  letterSpacing: 2,
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#eee8dc',
  fontFamily: 'Orbitron',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};
