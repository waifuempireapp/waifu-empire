'use client';
import { useState, useEffect, useRef } from 'react';
import { C, FF } from './_shared';
import SwapCard from '@/components/swap/SwapCard';
import SwapRewardToast from '@/components/swap/SwapRewardToast';
import SwapMilestoneModal from '@/components/swap/SwapMilestoneModal';
import AdSlot from '@/components/swap/AdSlot';
import KissesIcon from '@/components/KissesIcon';

export function SwapTab({ user, profilo, setProfilo, setTab }) {
  const [batch, setBatch] = useState([]);
  const [howExpanded, setHowExpanded] = useState(false); // default collassato, reset ad ogni mount
  const [currentIdx, setCurrentIdx] = useState(0);
  const [swapConfig, setSwapConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [showAd, setShowAd] = useState(false);
  const swipeCountRef = useRef(0);

  const loadBatch = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/swap/batch', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      let waifu = data.waifu || [];
      // Se non ho il Pass Hard, escludo le waifu Hot dalla coda Swap
      if (!profilo?.hardPass) {
        waifu = waifu.filter(w => !w.hot);
      }
      setBatch(prev => [...prev, ...waifu]);
    } catch (e) { console.error(e); }
  };

  const loadConfig = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/swap/config', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSwapConfig(data);
    } catch (e) { /* defaults */ }
  };

  useEffect(() => {
    Promise.all([loadBatch(), loadConfig()]).finally(() => setLoading(false));
  }, []);

  // Prefetch next batch when close to end
  useEffect(() => {
    if (batch.length > 0 && currentIdx >= batch.length - 5) {
      loadBatch();
    }
  }, [currentIdx, batch.length]);

  const handleVote = async (direction) => {
    const waifu = batch[currentIdx];
    if (!waifu) return;

    swipeCountRef.current += 1;
    const adInterval = swapConfig?.adInterval ?? 10;

    // Show ad every N swipes
    if (swipeCountRef.current % adInterval === 0) {
      setShowAd(true);
    }

    setCurrentIdx(i => i + 1);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/swap/vote', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ waifuId: waifu.id, vote: direction === 'like' ? 'like' : 'dislike' }),
      });
      const data = await res.json();

      if (data.kissesEarned > 0) {
        setToast({ amount: data.kissesEarned, streakDays: data.streakDays, multiplier: data.multiplier });
        setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + data.kissesEarned }));
      }
      if (data.milestoneHit && data.milestoneEarned > 0) {
        setMilestone({ milestone: data.milestoneHit, amount: data.milestoneEarned });
        setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + data.milestoneEarned }));
      }
    } catch (e) { console.error(e); }
  };

  const currentWaifu = batch[currentIdx];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FF.display, fontSize: 40, color: C.sakura, animation: 'pulse 1.2s ease-in-out infinite' }}>💋</div>
        <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(174,156,255,0.5)', marginTop: 12, textTransform: 'uppercase' }}>
          Caricamento…
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Back button */}
          <button onClick={() => setTab?.('home')} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(174,156,255,0.2)',
            borderRadius: 10, color: 'rgba(241,235,255,0.7)', padding: '7px 12px',
            fontFamily: FF.label, fontSize: 11, letterSpacing: '0.15em',
            textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
          }}>← Home</button>
          <div>
            <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }}>🩷 SWAP</div>
            <div style={{ fontFamily: FF.display, fontSize: 20, color: '#fff', fontWeight: 800 }}>Waifu Swap</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <KissesIcon size={16} />
          <span style={{ fontFamily: FF.display, fontSize: 16, color: C.gold, fontWeight: 700 }}>{profilo?.kisses ?? 0}</span>
        </div>
      </div>

      {/* Banner informativo "Come funziona" — collassabile, default chiuso (reset ad ogni mount) */}
      <div style={{
            marginBottom: 14, borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(255,133,182,0.15)',
            background: 'linear-gradient(135deg, rgba(255,133,182,0.07), rgba(167,139,250,0.05))',
          }}>
            {/* Header sempre visibile — click per espandere/collassare */}
            <button
              onClick={() => setHowExpanded(v => !v)}
              style={{
                width: '100%', padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>ℹ️</span>
                <span style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.2em', color: C.sakura, textTransform: 'uppercase' }}>
                  Come funziona
                </span>
              </div>
              <span style={{
                fontFamily: FF.label, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: 'rgba(241,235,255,0.45)',
                transition: 'transform 0.2s',
                display: 'inline-block',
                transform: howExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>▼</span>
            </button>

            {/* Contenuto collassabile */}
            {howExpanded && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '👆', text: 'Scorri le carte e vota le waifu che ti piacciono con ♥ o ✕' },
                  { icon: '🩷', text: 'Ogni 10 voti guadagni Kisses, la valuta del gioco' },
                  { icon: '🔥', text: 'Più giorni consecutivi voti, più alto è il moltiplicatore dei Kisses' },
                  { icon: '🏆', text: 'Le waifu più votate scalano la classifica settimanale: chi le possiede riceve bonus Kisses ogni domenica' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontFamily: FF.body, fontSize: 11, color: 'rgba(241,235,255,0.65)', lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

      {/* Streak indicator */}
      {(profilo?.streakDays ?? 0) > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'rgba(108,240,224,0.08)', border: '1px solid rgba(108,240,224,0.2)',
          borderRadius: 10, padding: '6px 12px', alignSelf: 'flex-start',
        }}>
          <span style={{ fontSize: 14 }}>🔥</span>
          <span style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.15em', color: C.aqua, textTransform: 'uppercase' }}>
            {profilo.streakDays} giorni di streak · ×{Math.min(1 + (profilo.streakDays - 1) * 0.1, 3).toFixed(1)}
          </span>
        </div>
      )}

      {/* Swap card */}
      {currentWaifu ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.3)', marginBottom: 12 }}>
            #{currentIdx + 1} — swipa per votare
          </div>
          {/* key=id forza rimount per ogni nuova waifu, elimina il flash della foto precedente */}
          <SwapCard key={currentWaifu?.id ?? currentIdx} waifu={currentWaifu} onVote={handleVote} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 56 }}>✨</div>
          <div style={{ fontFamily: FF.body, fontSize: 15, color: 'rgba(241,235,255,0.5)', textAlign: 'center' }}>
            Hai visto tutte le waifu disponibili!<br/>Torna presto per nuove aggiunte.
          </div>
          <button onClick={() => { setBatch([]); setCurrentIdx(0); loadBatch(); }} style={{
            padding: '12px 24px', background: 'rgba(255,133,182,0.12)',
            border: '1px solid rgba(255,133,182,0.3)', borderRadius: 12,
            color: C.sakura, fontFamily: FF.label, fontSize: 11,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            ↺ Ricarica
          </button>
        </div>
      )}

      {/* Overlays */}
      {toast && <SwapRewardToast {...toast} onDone={() => setToast(null)} />}
      {milestone && <SwapMilestoneModal {...milestone} onClose={() => setMilestone(null)} />}
      {showAd && <AdSlot onClose={() => setShowAd(false)} />}
    </div>
  );
}
