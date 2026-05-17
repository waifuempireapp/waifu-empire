'use client';
import { useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const STEPS = [
  { icon: '🗺️', title: 'Benvenuto nell\'Impero!', body: 'La mappa è divisa in pixel. Ogni pixel è un territorio che puoi conquistare o acquistare.' },
  { icon: '⚔️', title: 'Come conquistare', body: 'Seleziona qualsiasi pixel grigio (CPU) e sfida la CPU con il tuo team di 5 Waifu in un match Bo3.' },
  { icon: '💋', title: 'Kisses passivi', body: 'Ogni pixel che possiedi genera Kisses passivi ogni ora. Più pixel conquisti, più guadagni!' },
  { icon: '🏰', title: 'Scegli il tuo primo pixel', body: 'Puoi iniziare ovunque sulla mappa. Clicca "Scegli pixel" e seleziona il tuo territorio di partenza.' },
];

export default function TutorialOverlay({ onSelectPixel, onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 6, height: 6, borderRadius: 3,
            background: i === step ? C.sakura : 'rgba(174,156,255,0.2)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ textAlign: 'center', maxWidth: 320, marginBottom: 48 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>{current.icon}</div>
        <div style={{ fontFamily: FF.display, fontSize: 22, color: '#fff', fontWeight: 800, marginBottom: 14 }}>
          {current.title}
        </div>
        <div style={{ fontFamily: FF.body, fontSize: 14, color: 'rgba(241,235,255,0.65)', lineHeight: 1.6 }}>
          {current.body}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={ghostBtn}>← Indietro</button>
        )}
        {!isLast ? (
          <button onClick={() => setStep(s => s + 1)} style={primaryBtn}>Avanti →</button>
        ) : (
          <button
            onClick={() => {/* Let user pick any pixel */}}
            style={{ ...primaryBtn, background: 'linear-gradient(135deg, #c54a86, #ff85b6)' }}
          >
            🗺️ Scegli pixel
          </button>
        )}
      </div>

      <button onClick={onClose} style={{
        marginTop: 20, background: 'none', border: 'none',
        color: 'rgba(241,235,255,0.3)', fontFamily: FF.label,
        fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
        cursor: 'pointer',
      }}>Salta tutorial</button>
    </div>
  );
}

const ghostBtn = {
  flex: 1, padding: '13px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(174,156,255,0.2)', borderRadius: 14,
  color: 'rgba(241,235,255,0.6)',
  fontFamily: "'Saira Condensed', sans-serif", fontSize: 12,
  letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
};

const primaryBtn = {
  flex: 2, padding: '13px',
  background: 'linear-gradient(135deg, #1aa899, #6cf0e0)',
  border: 'none', borderRadius: 14, color: '#07051a',
  fontFamily: "'Saira Condensed', sans-serif", fontSize: 13,
  letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 700, cursor: 'pointer',
};
