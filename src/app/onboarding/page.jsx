// src/app/onboarding/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { createUserProfile, getUserProfile, listWaifu, listOutfit, listPose, getDropAttivo, setCollezione } from '@/lib/firestoreService';
import { generaPacchetto } from '@/lib/gameLogic';

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [nomeImpero, setNomeImpero] = useState('');
  const [coloreImpero, setColoreImpero] = useState('#f59e0b');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [pacchettiBenvenuto, setPacchettiBenvenuto] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    (async () => {
      const p = await getUserProfile(user.uid);
      if (p) router.replace('/gioco');
    })();
  }, [user, loading]);

  const conferma = async () => {
    if (!nomeImpero.trim()) return;
    setBusy(true);
    try {
      // 1) Profilo utente
      await createUserProfile(user.uid, {
        nomeImpero: nomeImpero.trim(),
        coloreImpero,
        email: user.email,
        displayName: user.displayName || nomeImpero.trim(),
        energia: 10,
        pacchetti: 0,
        pacchettiBenvenutoRimasti: 5,
      });

      // 2) Genera 5 pacchetti benvenuto SENZA doppioni waifu
      const drop = await getDropAttivo();
      const allWaifu = await listWaifu();
      const allOutfit = await listOutfit();
      const allPose = await listPose();

      const waifuPool = drop && drop.waifuIds ? allWaifu.filter(w => drop.waifuIds.includes(w.id)) : allWaifu;
      const outfitPool = drop && drop.outfitIds ? allOutfit.filter(o => drop.outfitIds.includes(o.id)) : allOutfit;
      const posePool = drop && drop.poseIds ? allPose.filter(p => drop.poseIds.includes(p.id)) : allPose;

      const collezione = { waifu: {}, outfit: {}, pose: {}, equipaggiamento: {}, preset: {} };
      const idsWaifuOttenute = [];
      const tuttiPacchetti = [];

      for (let i = 0; i < 5; i++) {
        const pkt = generaPacchetto({
          waifuPool, outfitPool, posePool,
          escludiDoppioniWaifu: true,
          waifuPossedute: idsWaifuOttenute,
        });
        tuttiPacchetti.push(pkt);
        // Aggiungi alla collezione + tracking ids
        pkt.forEach(carta => {
          if (carta.tipo === 'waifu') {
            const id = carta.data.id;
            idsWaifuOttenute.push(id);
            if (collezione.waifu[id]) collezione.waifu[id].copie++;
            else collezione.waifu[id] = { copie: 1, livello: 1, stat_bonus: {} };
          } else if (carta.tipo === 'outfit') {
            const id = carta.data.id;
            collezione.outfit[id] = { quantita: (collezione.outfit[id]?.quantita || 0) + 1 };
          } else if (carta.tipo === 'posa') {
            const id = carta.data.id;
            collezione.pose[id] = { quantita: (collezione.pose[id]?.quantita || 0) + 1 };
          }
        });
      }

      await setCollezione(user.uid, collezione);
      setPacchettiBenvenuto(tuttiPacchetti);
      setStep(2);
    } finally { setBusy(false); }
  };

  if (loading || !user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {step === 1 && (
        <div className="fade-up" style={card}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div className="glow-pulse" style={{ fontSize: 50, color: '#f59e0b' }}>♛</div>
            <h2 style={titolo}>FONDA IL TUO IMPERO</h2>
            <p style={{ color: '#d4c5b9', fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
              Benvenuta/o nell'Impero delle Waifu. Inizia scegliendo il nome del tuo dominio
              e riceverai <strong style={{ color: '#f59e0b' }}>5 pacchetti di benvenuto</strong> senza doppioni.
            </p>
          </div>
          <label style={{ fontSize: 11, letterSpacing: 2, color: '#a855f7', fontFamily: 'Cinzel, serif' }}>
            NOME IMPERO
          </label>
          <input value={nomeImpero} onChange={e => setNomeImpero(e.target.value)} maxLength={30}
                 placeholder="Es. Impero del Sol Levante" style={inputStyle} />
          <label style={{ fontSize: 11, letterSpacing: 2, color: '#a855f7', fontFamily: 'Cinzel, serif', marginTop: 8, display: 'block' }}>
            COLORE BANDIERA
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {['#f59e0b', '#ec4899', '#a855f7', '#06d6a0', '#3b82f6', '#ef4444', '#10b981', '#fbbf24'].map(c => (
              <button key={c} onClick={() => setColoreImpero(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: c, border: coloreImpero === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', boxShadow: `0 0 12px ${c}80`,
                }} />
            ))}
          </div>
          <button onClick={conferma} disabled={!nomeImpero.trim() || busy} style={{ ...btnPrimario, marginTop: 20, opacity: !nomeImpero.trim() ? 0.4 : 1 }}>
            {busy ? 'CREAZIONE...' : 'FONDA L\'IMPERO'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="fade-up" style={{ ...card, maxWidth: 600 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="pulse" style={{ fontSize: 60 }}>🎁</div>
            <h2 style={titolo}>5 PACCHETTI RICEVUTI</h2>
            <p style={{ color: '#d4c5b9', lineHeight: 1.7, marginTop: 12 }}>
              I tuoi 5 pacchetti di benvenuto sono stati distribuiti — senza doppioni di waifu.
              <br />Tutto è già nella tua collezione.
            </p>
            <div style={{ margin: '20px 0', padding: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 2, fontFamily: 'Cinzel, serif', marginBottom: 8 }}>RIEPILOGO</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {pacchettiBenvenuto.flat().reduce((acc, c) => {
                  acc[c.tipo] = (acc[c.tipo] || 0) + 1;
                  return acc;
                }, {}) && Object.entries(pacchettiBenvenuto.flat().reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] || 0) + 1; return acc; }, {})).map(([k, v]) => (
                  <div key={k}>· {v} {k}</div>
                ))}
              </div>
            </div>
            <button onClick={() => router.replace('/gioco')} style={btnPrimario}>
              ENTRA NELL'IMPERO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const card = {
  width: '100%', maxWidth: 460,
  background: 'rgba(15,10,30,0.7)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 16, padding: 28,
  boxShadow: '0 0 40px rgba(168,85,247,0.2)',
};

const titolo = {
  fontFamily: 'Cinzel, serif', letterSpacing: 4,
  background: 'linear-gradient(135deg, #f59e0b, #ec4899, #a855f7)',
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  fontSize: 22, margin: '8px 0 0',
};

const inputStyle = {
  width: '100%', padding: 12, marginTop: 6,
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 8, color: '#f5e6d3', fontFamily: 'inherit', fontSize: 14,
  boxSizing: 'border-box',
};

const btnPrimario = {
  width: '100%', padding: 12,
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none', color: '#000', fontWeight: 600,
  fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: 3,
  borderRadius: 8, cursor: 'pointer',
};
