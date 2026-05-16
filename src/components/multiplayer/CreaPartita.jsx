/**
 * CreaPartita — schermata per la creazione di una nuova partita multiplayer.
 *
 * SRP: si occupa solo di raccogliere i dati e chiamare il servizio di creazione.
 * DIP: dipende dall'astrazione `creaPartitaMultiplayer` (iniettata via import),
 *      non da un'implementazione concreta accoppiata alla UI.
 */
'use client';
import { useState } from 'react';
import { creaPartitaMultiplayer } from '@/lib/multiplayerService';
import { btnStyle } from './sharedStyles';
import FormImpero from './FormImpero';

// Colore di default per il nuovo impero (primo della palette)
const DEFAULT_COLORE = '#f5a623';

/**
 * Vista per la creazione di una partita multiplayer.
 *
 * @param {Object}   props
 * @param {Object}   props.profilo    - Profilo utente corrente (nomeImpero, coloreImpero).
 * @param {Object}   props.user       - Oggetto Firebase Auth (uid).
 * @param {Function} props.onCreata   - Callback chiamata con `{ codice }` dopo la creazione.
 * @param {Function} props.onAnnulla  - Torna al menu principale.
 */
export default function CreaPartita({ profilo, user, onCreata, onAnnulla }) {
  const [nomeImpero, setNomeImpero] = useState(profilo.nomeImpero || '');
  const [coloreImpero, setColoreImpero] = useState(profilo.coloreImpero || DEFAULT_COLORE);
  const [loading, setLoading] = useState(false);

  /** Crea la partita su Firestore e notifica il padre */
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
        }}>CREA PARTITA</div>
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
      </div>
    </div>
  );
}
