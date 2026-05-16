/**
 * UniscitiPartita — flusso in due step per entrare in una partita esistente.
 *
 * Step 1 ("codice"): verifica il codice e recupera i colori già in uso in lobby.
 * Step 2 ("configura"): l'utente sceglie nome e colore del proprio impero.
 *
 * SRP: gestisce solo il join; non sa nulla di mappa o battaglia.
 * OCP: i due step sono separati logicamente e visivamente — aggiungerne uno
 *      non richiede modifiche agli step esistenti.
 */
'use client';
import { useState } from 'react';
import { uniscitiPartita, getColoriUsatiLobby } from '@/lib/multiplayerService';
import { btnStyle, inputStyle, labelStyle } from './sharedStyles';
import FormImpero from './FormImpero';

// Palette colori (identica a quella centralizzata nel progetto)
const PALETTE_COLORI = [
  '#f5a623', '#00e676', '#ff2d78', '#9b59ff', '#00bcd4',
  '#ff6b35', '#c0ca33', '#26c6da', '#ab47bc', '#ef5350',
  '#42a5f5', '#66bb6a', '#ffa726', '#ec407a', '#7e57c2',
];

/**
 * Vista per unirsi a una partita multiplayer esistente.
 *
 * @param {Object}   props
 * @param {Object}   props.profilo    - Profilo utente (nomeImpero, coloreImpero pre-compilati).
 * @param {Object}   props.user       - Oggetto Firebase Auth (uid).
 * @param {Function} props.onUnito    - Callback con `{ codice }` dopo il join riuscito.
 * @param {Function} props.onAnnulla  - Torna al menu principale.
 */
export default function UniscitiPartita({ profilo, user, onUnito, onAnnulla }) {
  const [codice, setCodice] = useState('');
  const [nomeImpero, setNomeImpero] = useState(profilo.nomeImpero || '');
  const [coloreImpero, setColoreImpero] = useState(profilo.coloreImpero || PALETTE_COLORI[1]);
  const [coloriBloccati, setColoriBloccati] = useState([]);
  const [loading, setLoading] = useState(false);
  // Flusso a due step: 'codice' → 'configura'
  const [step, setStep] = useState('codice');

  /** Step 1: verifica il codice e recupera i colori già occupati in lobby */
  const verificaCodice = async () => {
    if (codice.trim().length < 6) return;
    setLoading(true);
    try {
      const usati = await getColoriUsatiLobby(codice.trim());
      setColoriBloccati(usati);
      // Pre-seleziona il primo colore libero disponibile
      const libero = PALETTE_COLORI.find(c => !usati.includes(c));
      if (libero) setColoreImpero(libero);
      setStep('configura');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  /** Step 2: entra nella partita con nome e colore scelti */
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
      <div style={{
        background: 'rgba(10,7,38,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '0.8px solid rgba(167,139,250,0.2)',
        borderRadius: 20,
        padding: 24,
      }}>
        <div style={{
          fontFamily: "'Unbounded', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#a78bfa',
          marginBottom: 16,
        }}>UNISCITI A UNA PARTITA</div>

        {/* ── Step 1: inserimento codice ── */}
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

        {/* ── Step 2: configurazione nome/colore ── */}
        {step === 'configura' && (
          <>
            {/* Badge di conferma codice */}
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(108,240,224,0.08)', borderRadius: 8, border: '0.8px solid rgba(108,240,224,0.35)', fontSize: 10, color: '#6cf0e0', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>
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
      </div>
    </div>
  );
}
