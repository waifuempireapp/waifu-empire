/**
 * Lobby — sala d'attesa prima dell'avvio della partita.
 *
 * SRP: mostra lo stato della lobby (giocatori connessi, codice) e
 *      delega l'avvio/uscita al componente padre tramite callback.
 * ISP: riceve solo le prop necessarie, senza conoscere la logica di
 *      salvataggio o il listener Firestore.
 */
'use client';
import { btnStyle } from './sharedStyles';

/**
 * Sala d'attesa multiplayer con codice partita e lista giocatori.
 *
 * @param {Object}   props
 * @param {Object|null} props.partita       - Documento partita (può essere null durante il caricamento).
 * @param {string}   props.codice           - Codice a 6 caratteri della partita.
 * @param {Object}   props.user             - Oggetto Firebase Auth (uid).
 * @param {Function} props.onAvvia          - Avvia la partita (solo per il creatore).
 * @param {Function} props.onEsci           - Esce dalla lobby con salvataggio.
 * @param {Function} props.mostraNotif      - Mostra una notifica temporanea.
 */
export default function Lobby({ partita, codice, user, onAvvia, onEsci, mostraNotif }) {
  const giocatori = Object.values(partita?.giocatori || {});
  const sonoCreatore = partita?.creatore === user.uid;
  // L'avvio richiede almeno 2 giocatori ed essere il creatore
  const possoAvviare = sonoCreatore && giocatori.length >= 2;

  /** Copia il codice negli appunti e mostra conferma */
  const copiaLink = () => {
    navigator.clipboard?.writeText(codice);
    mostraNotif('Codice copiato!', '#00e676');
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
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 700, color: '#a78bfa', marginBottom: 16 }}>LOBBY</div>

        {/* Codice partita — cliccabile per copiare */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', marginBottom: 6 }}>
            CODICE PARTITA — condividilo con gli amici
          </div>
          <button onClick={copiaLink} style={{
            background: 'linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))',
            border: '0.8px solid rgba(255,233,168,0.6)',
            borderRadius: 12,
            padding: '12px 28px',
            cursor: 'pointer',
            fontFamily: "'Unbounded', sans-serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#f1ebff',
            letterSpacing: 8,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: 'rgba(245,197,96,0.25) 0px 6px 20px 0px',
          }}>
            {codice} <span style={{ fontSize: 12, opacity: 0.5 }}>📋</span>
          </button>
        </div>

        {/* Lista giocatori connessi */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 2, marginBottom: 8 }}>
            GIOCATORI ({giocatori.length}/15)
          </div>
          {giocatori.map(g => (
            <div key={g.uid} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'rgba(167,139,250,0.05)', borderRadius: 10, marginBottom: 6,
              border: `0.8px solid rgba(167,139,250,0.12)`,
              borderLeft: `3px solid ${g.coloreImpero}`, // colore impero come accent laterale
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: g.coloreImpero, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: g.coloreImpero }}>
                  {g.nomeImpero}
                  {g.uid === user.uid && <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 6 }}>(TU)</span>}
                  {g.uid === partita?.creatore && <span style={{ fontSize: 8, color: '#ffd666', marginLeft: 6 }}>👑</span>}
                </div>
              </div>
              {/* Indicatore di connessione (sempre verde in lobby: chi è qui è connesso) */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6cf0e0' }} title="Connesso" />
            </div>
          ))}
        </div>

        {/* Avviso minimo giocatori */}
        {giocatori.length < 2 && (
          <div style={{ textAlign: 'center', color: 'rgba(238,232,220,0.4)', fontSize: 9, fontFamily: 'Orbitron', marginBottom: 12 }}>
            In attesa di almeno 1 altro giocatore…
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEsci} style={btnStyle('#666', true)}>← ESCI</button>
          {/* Pulsante avvio: visibile solo al creatore con abbastanza giocatori */}
          {possoAvviare && (
            <button onClick={onAvvia} style={{
              flex: 1,
              padding: '12px 18px',
              background: 'linear-gradient(rgba(167,139,250,0.35), rgba(167,139,250,0.1))',
              border: '0.8px solid rgba(167,139,250,0.5)',
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
              boxShadow: 'rgba(167,139,250,0.3) 0px 6px 20px 0px',
            }}>
              ⚔ AVVIA PARTITA ({giocatori.length} giocatori)
            </button>
          )}
          {/* Messaggio per i non-creatori */}
          {!sonoCreatore && (
            <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              In attesa che il creatore avvii…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
