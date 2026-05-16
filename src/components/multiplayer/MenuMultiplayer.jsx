/**
 * MenuMultiplayer — schermata di ingresso alla sezione Multiplayer.
 *
 * SRP: responsabile esclusivamente della navigazione iniziale (Crea / Unisciti / Carica / Indietro).
 * OCP: nuove voci di menu si aggiungono senza modificare la logica esistente.
 */
'use client';
import { btnStyle } from './sharedStyles';

/**
 * Menu principale multiplayer con i quattro pulsanti di navigazione.
 *
 * @param {Object} props
 * @param {() => void} props.onCrea      - Naviga alla vista "Crea Partita".
 * @param {() => void} props.onUnisciti  - Naviga alla vista "Unisciti".
 * @param {() => void} props.onCarica    - Naviga alla vista "Carica Partita".
 * @param {() => void} props.onIndietro  - Esce dalla sezione Multiplayer.
 */
export default function MenuMultiplayer({ onCrea, onUnisciti, onCarica, onIndietro }) {
  return (
    <div className="fade-in">
      <div style={{
        background: 'rgba(10,7,38,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '0.8px solid rgba(167,139,250,0.2)',
        borderRadius: 20,
        padding: 28,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🌐</div>
        <div style={{
          fontFamily: "'Unbounded', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          color: '#a78bfa',
          letterSpacing: 2,
          marginBottom: 8,
        }}>MULTIPLAYER</div>
        <div style={{
          color: 'rgba(167,139,250,0.5)',
          fontSize: 10,
          letterSpacing: 2,
          fontFamily: "'Saira Condensed', Saira, sans-serif",
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          CONQUISTA IL MONDO CON ALTRI GIOCATORI
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto' }}>
          {/* CREA PARTITA — gold */}
          <button onClick={onCrea} style={{
            padding: '12px 18px',
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
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: 'rgba(245,197,96,0.35) 0px 8px 24px 0px',
          }}>🏰 CREA PARTITA</button>

          {/* UNISCITI — aqua */}
          <button onClick={onUnisciti} style={{
            padding: '12px 18px',
            background: 'linear-gradient(rgba(108,240,224,0.15), rgba(108,240,224,0.04))',
            border: '0.8px solid rgba(108,240,224,0.35)',
            borderRadius: 12,
            cursor: 'pointer',
            color: '#6cf0e0',
            fontFamily: "'Saira Condensed', Saira, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>🔑 UNISCITI A UNA PARTITA</button>

          {/* CARICA — crystal */}
          <button onClick={onCarica} style={{
            padding: '12px 18px',
            background: 'linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
            border: '0.8px solid rgba(255,255,255,0.16)',
            borderRadius: 12,
            cursor: 'pointer',
            color: '#f1ebff',
            fontFamily: "'Saira Condensed', Saira, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>💾 CARICA PARTITA</button>

          {/* INDIETRO — secondary */}
          <button onClick={onIndietro} style={btnStyle('#666', true)}>
            ← INDIETRO
          </button>
        </div>
      </div>
    </div>
  );
}
