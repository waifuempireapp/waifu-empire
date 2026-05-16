/**
 * CaricaPartita — lista le partite salvate dell'utente e permette di riprenderne una.
 *
 * SRP: responsabile solo del recupero e della selezione di una partita salvata.
 * OCP: la logica di ingresso (check stato, check uid) è isolata in `entraInPartita`
 *      e non richiede modifiche alla UI per nuovi tipi di errore.
 */
'use client';
import { useState, useEffect } from 'react';
import { caricaPartita, getPartiteSalvateUtente } from '@/lib/multiplayerService';
import { btnStyle, inputStyle } from './sharedStyles';

/**
 * Vista per caricare una partita multiplayer salvata.
 *
 * @param {Object}   props
 * @param {Object}   props.user        - Oggetto Firebase Auth (uid).
 * @param {Function} props.onCaricata  - Callback con l'oggetto partita dopo il caricamento.
 * @param {Function} props.onAnnulla   - Torna al menu principale.
 */
export default function CaricaPartita({ user, onCaricata, onAnnulla }) {
  // null = caricamento in corso, [] = lista vuota, [...] = lista partite
  const [partiteSalvate, setPartiteSalvate] = useState(null);
  const [errore, setErrore] = useState('');
  // Codice della partita che sta caricando (per mostrare lo spinner sul pulsante corretto)
  const [loadingCodice, setLoadingCodice] = useState('');
  // Fallback manuale: se l'utente ha un codice vecchio non indicizzato
  const [mostraFallback, setMostraFallback] = useState(false);
  const [codiceFallback, setCodiceFallback] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);

  // Carica la lista all'avvio — cleanup con flag `attivo` per evitare setState su componente smontato
  useEffect(() => {
    let attivo = true;
    getPartiteSalvateUtente(user.uid)
      .then(lista => { if (attivo) setPartiteSalvate(lista); })
      .catch(() => { if (attivo) { setPartiteSalvate([]); setErrore('Errore nel caricamento della lista.'); } });
    return () => { attivo = false; };
  }, [user.uid]);

  /** Verifica accesso e stato della partita, poi invoca onCaricata */
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

  /** Fallback: ingresso tramite codice digitato manualmente */
  const handleFallback = async () => {
    if (codiceFallback.trim().length < 6) return;
    setLoadingFallback(true);
    await entraInPartita(codiceFallback.trim().toUpperCase());
    setLoadingFallback(false);
  };

  /** Formatta un timestamp (ms o secondi) in data leggibile */
  const formatData = (ts) => {
    if (!ts) return '';
    const d = new Date(typeof ts === 'number' ? ts : ts * 1000);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fade-in">
      <div style={{
        background: 'rgba(10,7,38,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '0.8px solid rgba(167,139,250,0.2)',
        borderRadius: 20,
        padding: 20,
      }}>
        <div style={{
          fontFamily: "'Unbounded', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#a78bfa',
          marginBottom: 16,
        }}>CARICA PARTITA</div>

        {/* Stato: caricamento lista */}
        {partiteSalvate === null && (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 10 }}>
            ⏳ Caricamento partite…
          </div>
        )}

        {/* Stato: lista vuota */}
        {partiteSalvate !== null && partiteSalvate.length === 0 && !errore && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 10, marginBottom: 16 }}>
              Nessuna partita salvata trovata
            </div>
          </div>
        )}

        {/* Lista partite salvate */}
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
                  background: 'rgba(167,139,250,0.06)', border: '0.8px solid rgba(167,139,250,0.15)',
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 12, color: '#f1ebff', fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nomePersonale}
                    </div>
                    <div style={{ fontSize: 9, color: '#b6aed6', fontFamily: "'DM Sans', sans-serif", display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>🏴 {mieiTerritori}/{totTerritori}</span>
                      <span>👥 {numGiocatori} giocatori</span>
                      <span style={{ color: p.stato === 'in_gioco' ? '#00e676' : '#9b59ff' }}>
                        {p.stato === 'in_gioco' ? '▶ In gioco' : '⏸ In lobby'}
                      </span>
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(167,139,250,0.4)', fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
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

        {/* Messaggio errore */}
        {errore && (
          <div style={{ color: '#ff3d3d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 12 }}>
            ⚠ {errore}
          </div>
        )}

        {/* Fallback manuale con codice */}
        <div style={{ borderTop: '1px solid rgba(167,139,250,0.1)', paddingTop: 14, marginTop: 4 }}>
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
      </div>
    </div>
  );
}
