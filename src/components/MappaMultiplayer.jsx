// src/components/MappaMultiplayer.jsx
// Sistema multiplayer per Impero Waifu
// Gestisce: Crea Partita, Unisciti, Carica, Lobby, Partita, Battaglia
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  creaPartitaMultiplayer, uniscitiPartita, avviaPartitaMultiplayer,
  caricaPartita, ascoltaPartita, scegliAttacco,
  registraRisultatoBattaglia, salvaPartitaConNome, setGiocatoreInLobby,
  getColoriUsatiLobby, salvaMazzoBattaglia,
  salvaSceltaPvpRound, salvaPrimoTurnoPvp,
  salvaProseguiTurnoRound, registraRisultatoBattagliaPvp,
  salvaRisultatoPvpRound, getPartiteSalvateUtente,
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

// ════════════════════════════════════════════════════════════════════
// MODALE NOME PARTITA
// Chiede all'utente di dare un nome alla partita prima di salvarla.
// ════════════════════════════════════════════════════════════════════
function ModaleNomePartita({ nomeDefault, onConferma, onAnnulla }) {
  const [nome, setNome] = useState(nomeDefault || '');
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d0820, #06030f)',
        border: '1px solid rgba(245,166,35,0.4)',
        borderRadius: 16, padding: 28, maxWidth: 360, width: '100%',
        boxShadow: '0 0 40px rgba(245,166,35,0.15)',
      }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, color: '#f5a623', letterSpacing: 2, marginBottom: 6, textAlign: 'center' }}>
          💾 SALVA PARTITA
        </div>
        <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 16, textAlign: 'center' }}>
          Dai un nome a questa partita — lo vedrai solo tu nella lista delle partite salvate
        </div>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Es. Partita con Marco e Sara"
          maxLength={40}
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, color: '#eee8dc',
            fontFamily: 'Orbitron', fontSize: 11, outline: 'none', boxSizing: 'border-box',
            marginBottom: 16,
          }}
          onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) onConferma(nome.trim()); }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onAnnulla} style={btnStyle('#666', true)}>ANNULLA</button>
          <button
            onClick={() => onConferma(nome.trim() || nomeDefault)}
            style={btnStyle('#f5a623')}
          >
            💾 SALVA ED ESCI
          </button>
        </div>
      </div>
    </div>
  );
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
// CARICA PARTITA — mostra lista partite salvate dell'utente
// ════════════════════════════════════════════════════════════════════
function CaricaPartita({ user, onCaricata, onAnnulla }) {
  const [partiteSalvate, setPartiteSalvate] = useState(null); // null = caricamento
  const [errore, setErrore] = useState('');
  const [loadingCodice, setLoadingCodice] = useState(''); // codice in caricamento
  // Fallback manuale: se l'utente ha un codice "vecchio" non indicizzato
  const [mostraFallback, setMostraFallback] = useState(false);
  const [codiceFallback, setCodiceFallback] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);

  useEffect(() => {
    let attivo = true;
    getPartiteSalvateUtente(user.uid)
      .then(lista => { if (attivo) setPartiteSalvate(lista); })
      .catch(() => { if (attivo) { setPartiteSalvate([]); setErrore('Errore nel caricamento della lista.'); } });
    return () => { attivo = false; };
  }, [user.uid]);

  const entraInPartita = async (codice) => {
    setLoadingCodice(codice);
    try {
      const p = await caricaPartita(codice);
      if (!p.giocatori?.[user.uid]) throw new Error('Non sei un giocatore di questa partita');
      if (p.stato === 'terminata') throw new Error('Questa partita è già terminata');
      if (p.stato === 'in_gioco' && p.giocatori[user.uid]?.eliminato) throw new Error('Il tuo impero è stato eliminato');
      onCaricata(p);
    } catch (e) {
      setErrore(e.message);
      setLoadingCodice('');
    }
  };

  const handleFallback = async () => {
    if (codiceFallback.trim().length < 6) return;
    setLoadingFallback(true);
    await entraInPartita(codiceFallback.trim().toUpperCase());
    setLoadingFallback(false);
  };

  const formatData = (ts) => {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : ts * 1000);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#f5a623" style={{ padding: 20 }}>
        <TitoloOrnato livello={2} colore="#f5a623">CARICA PARTITA</TitoloOrnato>

        {partiteSalvate === null && (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 10 }}>
            ⏳ Caricamento partite…
          </div>
        )}

        {partiteSalvate !== null && partiteSalvate.length === 0 && !errore && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 10, marginBottom: 16 }}>
              Nessuna partita salvata trovata
            </div>
          </div>
        )}

        {partiteSalvate !== null && partiteSalvate.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {partiteSalvate.map(p => {
              const nomePersonale = p.nomiPartita?.[user.uid] || p.codice;
              const numGiocatori = Object.keys(p.giocatori || {}).filter(k => k !== 'cpu').length;
              const mieiTerritori = Object.values(p.mappaTerritori || {}).filter(t => t?.uid === user.uid).length;
              const totTerritori = Object.keys(p.mappaTerritori || {}).length;
              const isLoading = loadingCodice === p.codice;
              return (
                <div key={p.codice} style={{
                  background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)',
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#f5a623', fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nomePersonale}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>🏴 {mieiTerritori}/{totTerritori}</span>
                      <span>👥 {numGiocatori} giocatori</span>
                      <span style={{ color: p.stato === 'in_gioco' ? '#00e676' : '#9b59ff' }}>
                        {p.stato === 'in_gioco' ? '▶ In gioco' : '⏸ In lobby'}
                      </span>
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.25)', fontFamily: 'Orbitron', marginTop: 2 }}>
                      {formatData(p.aggiornato)} · {p.codice}
                    </div>
                  </div>
                  <button
                    onClick={() => entraInPartita(p.codice)}
                    disabled={!!loadingCodice}
                    style={btnStyle('#f5a623')}
                  >
                    {isLoading ? '⏳' : '▶ ENTRA'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {errore && (
          <div style={{ color: '#ff3d3d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 12 }}>
            ⚠ {errore}
          </div>
        )}

        {/* Fallback manuale con codice */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 4 }}>
          <button
            onClick={() => setMostraFallback(v => !v)}
            style={{ background: 'none', border: 'none', color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer', letterSpacing: 1, width: '100%', textAlign: 'center' }}
          >
            {mostraFallback ? '▲ Nascondi' : '▼ Hai un codice partita? Inseriscilo manualmente'}
          </button>
          {mostraFallback && (
            <div style={{ marginTop: 10 }}>
              <input
                value={codiceFallback}
                onChange={e => setCodiceFallback(e.target.value.toUpperCase())}
                placeholder="ES: AB3K7X"
                maxLength={6}
                style={{ ...inputStyle, letterSpacing: 8, textAlign: 'center', fontSize: 18, textTransform: 'uppercase' }}
              />
              <button onClick={handleFallback} disabled={loadingFallback || codiceFallback.trim().length < 6} style={{ ...btnStyle('#f5a623'), marginTop: 8, width: '100%' }}>
                {loadingFallback ? '⏳' : '💾 CARICA CON CODICE'}
              </button>
            </div>
          )}
        </div>

        <button onClick={onAnnulla} style={{ ...btnStyle('#666', true), marginTop: 14, width: '100%' }}>← ANNULLA</button>
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

  // NOTA: questo useEffect deve stare PRIMA di qualsiasi early return
  // per rispettare la regola dei hook (stesso numero di hook per ogni render).
  const _ordine = partita?.ordineGiocatori || [];
  const _turnoUid = _ordine[partita?.turnoCorrente ?? 0];
  const _isMioTurno = _turnoUid === user?.uid;
  useEffect(() => {
    if (!_isMioTurno) setTerrSel(null);
  }, [_isMioTurno]);

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
          mappaMulti={mappaTerritori}
          myUid={myUid}
        />

        {/* ── Overlay "non è il tuo turno" ── */}
        {!isMioTurno && !sonoEliminato && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            background: 'rgba(6,3,15,0.72)', backdropFilter: 'blur(3px)',
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
    setVincitoreRound(vince);
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

    setTimeout(() => {
      if (inSuddenDeathRef.current) {
        if (vince === 'pareggio') setTimeout(() => avviaSuddenDeath(), 2500);
        else setTimeout(() => fineBattaglia(vince === 'player'), 2500);
      } else {
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
      else if (fase === 'suddenDeathWaifu') { const p = pDisp[Math.floor(Math.random() * pDisp.length)]; if (p) pvpScegliWaifuSD(p); }
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
    setFase('gameEnd');
    const vincitoreUid = vittoria ? myUid : avversarioUid;
    onBattagliaFinita(vincitoreUid);
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

    _avviaBattaglia(mazzoAvversario, sonoAttaccante);
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
    mazzoPRef.current = mazzoUtente;

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
        mazzoCRef.current = mazzoAvversario;
        _avviaBattaglia(mazzoAvversario, sonoAttaccante);
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
    mazzoCRef.current = mazzoCPU;
    setModoBattaglia(false); setIniziata(true);
    setPunteggio({ player: 0, cpu: 0 }); punteggioRef.current = { player: 0, cpu: 0 };
    setRound(1); roundRef.current = 1;
    setRisultatiWaifu({}); setStatsUsatePartita([]); statsUsateRef.current = [];
    setCarteP(null); setCarteC(null); setStatScelta(null);
    setDirezione(null); setVincitoreRound(null);
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setCoinResult(null); setInSuddenDeath(false); inSuddenDeathRef.current = false;
    setFase('coin');
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'player' : 'cpu';
      setCoinResult(result);
      setPrimoTurno(result); primoTurnoRef.current = result;
      setTimeout(() => {
        setTurno(result); turnoRef.current = result;
        setTimeLeft(30);
        setFase(result === 'player' ? 'playerScegliWaifu' : 'cpuSceglieTutto');
      }, 1800);
    }, 200);
  };

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
    const coloreRisultato = vittoria ? '#00e676' : '#ff3d3d';
    const testoTerritori = vittoria
      ? `🏴 ${terrData?.nome} conquistato!`
      : `❌ Hai perso ${terrData?.nome}`;
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{
          background: 'rgba(6,3,15,0.97)',
          border: `2px solid ${coloreRisultato}40`,
          borderRadius: 20, padding: 36, textAlign: 'center', maxWidth: 360,
          boxShadow: `0 0 40px ${coloreRisultato}20`,
        }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>{vittoria ? '👑' : '💔'}</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: coloreRisultato, letterSpacing: 3, marginBottom: 8 }}>
            {vittoria ? 'VITTORIA!' : 'SCONFITTA'}
          </div>
          {/* Punteggio */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', marginBottom: 2 }}>TU</div>
              <div style={{ fontSize: 32, fontFamily: 'Orbitron', fontWeight: 800, color: '#00e676' }}>{punteggio.player}</div>
            </div>
            <div style={{ fontSize: 16, color: '#444', fontFamily: 'Orbitron' }}>—</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', marginBottom: 2 }}>{nomeAvversario.toUpperCase()}</div>
              <div style={{ fontSize: 32, fontFamily: 'Orbitron', fontWeight: 800, color: coloreAvversario }}>{punteggio.cpu}</div>
            </div>
          </div>
          {/* Territorio */}
          <div style={{
            padding: '10px 18px', borderRadius: 10,
            background: `${coloreRisultato}12`,
            border: `1px solid ${coloreRisultato}30`,
            fontSize: 11, fontFamily: 'Orbitron', fontWeight: 700,
            color: coloreRisultato, letterSpacing: 1,
          }}>
            {testoTerritori}
          </div>
          <div style={{ marginTop: 14, fontSize: 9, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron' }}>
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
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: '#ffd666', fontFamily: 'Orbitron', letterSpacing: 1 }}>
            {labelFase()}
          </div>
        )}
        {/* HUD stat usate */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {STATS_BATTAGLIA.map(s => {
            const usata = statsUsatePartita.includes(s.key);
            return (
              <div key={s.key} style={{
                padding: '2px 7px', borderRadius: 5, fontSize: 8, fontFamily: 'Orbitron',
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
      </PannelloOrnato>

      {/* Territorio in gioco */}
      {terrData && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <Chip colore="#ff2d78" size="sm">⚔ {terrData.nome} — {NOMI_CONTINENTI[terrData.cont]}</Chip>
        </div>
      )}

      {/* ── Campo di battaglia: carte ── */}
      <PannelloOrnato style={{ padding: 14, marginBottom: 10 }}>
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
            {(fase === 'roundEnd' || fase === 'pvpAttesaProsegui') && vincitoreRound && (
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
                      perdente={fase === 'roundEnd' && vincitoreRound === 'player'} /></div>
                  : <div style={{ width: 130, height: 195, background: `linear-gradient(160deg, rgba(${parseInt(coloreAvversario.slice(1,3),16)},${parseInt(coloreAvversario.slice(3,5),16)},${parseInt(coloreAvversario.slice(5,7),16)},0.05), #06030f)`, border: `1px solid ${coloreAvversario}40`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: `${coloreAvversario}80` }}>?</div>
                )
              : <div style={{ width: 130, height: 195, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'Orbitron' }}>ATTESA</div>
            }
          </div>
        </div>
      </PannelloOrnato>

      {/* ── Mazzo del player (sempre visibile con stati) ── */}
      <PannelloOrnato style={{ padding: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: '#ff2d78', textAlign: 'center', marginBottom: 8, fontFamily: 'Orbitron' }}>
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
              cliccabile = pvpDeveScegliereWaifu && !usata && (!inSuddenDeath || w.id !== carteP?.id);
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
              cliccabile = playerDeveScegliereWaifu && !usata;
              handler = () => {
                if (!cliccabile) return;
                if (fase === 'playerScegliWaifu') onScegliWaifuCpu(w);
                else if (fase === 'playerScegliWaifuVsCPU') onScegliWaifuVsCpu(w);
                else if (fase === 'suddenDeathWaifu') onScegliWaifuSD(w);
              };
            }
            return (
              <div key={w.id} onClick={handler} style={{
                position: 'relative', cursor: cliccabile ? 'pointer' : 'default',
                opacity: usata ? 0.35 : 1, filter: usata ? 'grayscale(0.5)' : 'none',
                transition: 'all 0.2s',
                border: `2px solid ${getColoreBordo(stato)}`, borderRadius: 12, padding: 2,
              }}
              onMouseEnter={e => { if (cliccabile) e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                <CartaWaifu waifu={w} dimensione="piccola" />
                {usata && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 24, textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>{getIconaStato(stato)}</div>}
              </div>
            );
          })}
        </div>
      </PannelloOrnato>

      {/* ── MODAL: Scelta statistica ── */}
      {(fase === 'playerScegliStat' || fase === 'pvpScegliStat') && carteP && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="fade-up" style={{ background: 'rgba(12,6,24,0.96)', border: '1px solid rgba(255,45,120,0.3)', borderRadius: 16, padding: 22, maxWidth: 380, width: '100%', boxShadow: '0 0 50px rgba(255,45,120,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 3, color: '#ff2d78', fontFamily: 'Orbitron' }}>🎯 SCEGLI STATISTICA</div>
              <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginTop: 4 }}>⏱ {timeLeft}s</div>
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
          <div className="fade-up" style={{ background: 'rgba(12,6,24,0.96)', border: '1px solid rgba(255,45,120,0.3)', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 0 50px rgba(255,45,120,0.2)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{statInfo?.icon}</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#ff2d78', letterSpacing: 2, marginBottom: 4 }}>
              {statInfo?.label}: <strong>{carteP?.[statScelta]}</strong>
            </div>
            <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginBottom: 16 }}>⏱ {timeLeft}s</div>
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
      background: 'rgba(6,3,15,0.96)',
      borderTop: `2px solid ${colore}`,
    }}>
      <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        {/* Esito round */}
        <div style={{ fontSize: 13, fontFamily: 'Orbitron', fontWeight: 700, marginBottom: 4, color: colore }}>
          {testoEsito}
          {isCpu && timer !== null && <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>({timer}s)</span>}
        </div>
        {/* Stat confronto */}
        {statInfo && carteP && carteC && (
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.6)', marginBottom: 8 }}>
            {statInfo.icon} {statInfo.label} {direzione === 'piu' ? '▲' : '▼'} — Tu: <strong>{carteP[statScelta]}</strong> vs {nomeAvversario}: <strong>{carteC[statScelta]}</strong>
          </div>
        )}
        {/* Punteggio mini */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ fontFamily: 'Orbitron', fontWeight: 700, color: '#00e676', fontSize: 18 }}>{punteggio.player}</span>
          <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: 'rgba(238,232,220,0.3)' }}>—</span>
          <span style={{ fontFamily: 'Orbitron', fontWeight: 700, color: coloreAvversario, fontSize: 18 }}>{punteggio.cpu}</span>
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
