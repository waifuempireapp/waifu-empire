'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const PAGES = [
  {
    title: 'Benvenuto nella Mappa Mondo',
    emoji: '🗺️',
    body: `La mappa è divisa in ${1312} territori conquistabili distribuiti su tutti i continenti. Ogni territorio ha un nome geografico univoco.

I territori grigi appartengono alla CPU — sono disponibili per essere conquistati. I territori colorati appartengono ai giocatori.

🔵 Il tuo impero è evidenziato con un bordo dorato interno. I territori che puoi conquistare pulsano con un bagliore dorato.`,
  },
  {
    title: 'Come conquistare un territorio',
    emoji: '⚔️',
    body: `Premi su qualsiasi territorio adiacente al tuo (incluse le diagonali e attraverso il mare).

Nel popup che appare scegli cosa fare:
⚔ Attacca → seleziona 5 waifu, scegli le 3 migliori e combatti al meglio di 3 round.
💋 Compra → paga in Kisses per averlo subito senza combattere.

🏆 Se vinci, conquisti il territorio e ottieni 1 pacchetto sfida.
💔 Se perdi, perdi 1 energia.`,
  },
  {
    title: 'Team difensore',
    emoji: '🛡️',
    body: `Ogni territorio che conquisti può avere un team difensore di 5 waifu.

Premi su un tuo territorio → "Modifica Difesa" per impostare il team.

Puoi impostare team diversi per territori diversi, oppure usare "Imposta per tutti" per applicare lo stesso team a tutto il tuo impero.

Se non imposti un team, verrà usato il tuo Preset 1 di default.`,
  },
  {
    title: 'Kisses Passivi & Economia',
    emoji: '💋',
    body: `Ogni territorio che possiedi genera Kisses passivi ogni ora.

Nella sezione "Classifica Territori" sotto la mappa vedi quanti Kisses hai accumulato e quando arriverà il prossimo.

Premi "Claim" per riscuotere i Kisses accumulati.

Puoi anche fare offerte in Kisses ai giocatori avversari per comprare i loro territori senza combattere — usa il bottone 💌 Offerte in alto.`,
  },
  {
    title: 'Legenda & Interfaccia',
    emoji: '📋',
    body: `🗺️ Canvas mappa → trascina per fare pan, pizzica con 2 dita per zoomare.
◎ Il mio impero → centra la mappa sul tuo territorio.
💌 Offerte → vedi le offerte in entrata e in uscita per i tuoi territori.

📊 Classifica Territori → mostra tutti i giocatori ordinati per numero di territori, con i Kisses passivi in cima.

? nei quadratini del team → il team della CPU è nascosto: sfidala per scoprirlo!

🔥 Badge HOT → waifu visibile solo con il Pass Hard.`,
  },
];

export default function MappaInfoModal({ onClose }) {
  const [page, setPage] = useState(0);
  const p = PAGES[page];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(3,2,12,0.7)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 260, width: 'min(92vw, 380px)',
        background: 'rgba(10,7,38,0.99)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(174,156,255,0.25)', borderRadius: 20,
        padding: '24px 22px', boxShadow: '0 24px 60px rgba(3,2,12,0.9)',
        animation: 'fadeUp 0.22s ease-out',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <style>{`@keyframes fadeUp { from{opacity:0;transform:translate(-50%,calc(-50%+12px))} to{opacity:1;transform:translate(-50%,-50%)} }`}</style>

        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'rgba(241,235,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0 }}>✕</button>

        {/* Paginazione top */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 18, justifyContent: 'center' }}>
          {PAGES.map((_, i) => (
            <div key={i} onClick={() => setPage(i)} style={{
              width: i === page ? 20 : 6, height: 6, borderRadius: 3, cursor: 'pointer',
              background: i === page ? C.sakura : 'rgba(174,156,255,0.2)', transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Contenuto */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>{p.emoji}</div>
          <div style={{ fontFamily: FF.display, fontSize: 17, color: '#fff', fontWeight: 800, marginBottom: 14, textAlign: 'center' }}>{p.title}</div>
          <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{p.body}</div>
        </div>

        {/* Navigazione */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={navBtn(page === 0)}>← Prec</button>
          {page < PAGES.length - 1 ? (
            <button onClick={() => setPage(p => p + 1)} style={navBtn(false, true)}>Succ →</button>
          ) : (
            <button onClick={onClose} style={navBtn(false, true)}>✓ Capito!</button>
          )}
        </div>
      </div>
    </>
  );
}

function navBtn(disabled, primary = false) {
  return {
    flex: 1, padding: '11px',
    background: primary ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.05)',
    border: primary ? 'none' : '1px solid rgba(174,156,255,0.2)',
    borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'rgba(241,235,255,0.2)' : primary ? '#fff' : 'rgba(241,235,255,0.6)',
    fontFamily: "'Saira Condensed', sans-serif", fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase',
    opacity: disabled ? 0.5 : 1,
  };
}
