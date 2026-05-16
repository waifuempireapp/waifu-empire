/**
 * ModaleNomePartita — modale per assegnare un nome alla partita prima del salvataggio.
 *
 * SRP: responsabile esclusivamente della raccolta del nome da parte dell'utente.
 * ISP: riceve solo le callback necessarie (onConferma, onAnnulla) senza dipendenze superflue.
 */
'use client';
import { useState } from 'react';
import { btnStyle, inputStyle } from './sharedStyles';

/**
 * Modale sovrapposto a tutto che chiede un nome per la partita da salvare.
 *
 * @param {Object}   props
 * @param {string}   props.nomeDefault  - Valore pre-compilato (codice partita o nome precedente).
 * @param {Function} props.onConferma   - Chiamato con il nome scelto dall'utente.
 * @param {Function} props.onAnnulla    - Chiamato se l'utente annulla.
 */
export default function ModaleNomePartita({ nomeDefault, onConferma, onAnnulla }) {
  const [nome, setNome] = useState(nomeDefault || '');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'rgba(10,7,38,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '0.8px solid rgba(167,139,250,0.3)',
        borderRadius: 20,
        padding: 28,
        maxWidth: 360,
        width: '100%',
        boxShadow: '0 0 40px rgba(167,139,250,0.15)',
      }}>
        <div style={{
          fontFamily: "'Unbounded', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: '#f1ebff',
          letterSpacing: 1,
          marginBottom: 6,
          textAlign: 'center',
        }}>💾 SALVA PARTITA</div>
        <div style={{
          fontSize: 11,
          color: 'rgba(167,139,250,0.6)',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 16,
          textAlign: 'center',
        }}>
          Dai un nome a questa partita — lo vedrai solo tu nella lista delle partite salvate
        </div>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Es. Partita con Marco e Sara"
          maxLength={40}
          autoFocus
          style={{
            ...inputStyle,
            marginBottom: 16,
          }}
          // Conferma rapida con Enter se il nome non è vuoto
          onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) onConferma(nome.trim()); }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onAnnulla} style={btnStyle('#666', true)}>ANNULLA</button>
          <button
            onClick={() => onConferma(nome.trim() || nomeDefault)}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))',
              border: '0.8px solid rgba(255,233,168,0.6)',
              borderRadius: 12,
              cursor: 'pointer',
              color: 'rgb(42,31,0)',
              fontFamily: "'Saira Condensed', Saira, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: 'rgba(245,197,96,0.35) 0px 6px 20px 0px',
            }}
          >💾 SALVA ED ESCI</button>
        </div>
      </div>
    </div>
  );
}
