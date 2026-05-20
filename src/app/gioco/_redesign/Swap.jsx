'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { C, FF } from './_shared';
import SwapCard from '@/components/swap/SwapCard';
import SwapRewardToast from '@/components/swap/SwapRewardToast';
import SwapMilestoneModal from '@/components/swap/SwapMilestoneModal';
import AdSlot from '@/components/swap/AdSlot';
import KissesIcon from '@/components/KissesIcon';

export function SwapTab({ user, profilo, setProfilo, setTab }) {
  const [queue, setQueue]       = useState([]); // waifu in coda da mostrare
  const [currentIdx, setCurrentIdx] = useState(0);
  const [swapConfig, setSwapConfig] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [showAd, setShowAd]     = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [howExpanded, setHowExpanded] = useState(false);
  const [swapStatus, setSwapStatus] = useState(null); // { hasSwapPass, dailyVotes, dailyLimit, votesRemaining }

  const swipeCountRef = useRef(0);
  // Tiene traccia di tutti gli ID già visti in questa sessione
  const seenIdsRef = useRef(new Set());
  const loadingBatchRef = useRef(false);

  // ── Carica un batch di 10 waifu non ancora viste ───────────────────────────
  const loadBatch = useCallback(async () => {
    if (loadingBatchRef.current) return;
    loadingBatchRef.current = true;
    try {
      const token = await user.getIdToken();
      const exclude = Array.from(seenIdsRef.current).join(',');
      const params = exclude ? `?exclude=${encodeURIComponent(exclude)}` : '';
      const res = await fetch(`/api/swap/batch${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      let waifu = data.waifu || [];
      if (data.exhausted || waifu.length === 0) {
        setExhausted(true);
        return;
      }
      // Filtra waifu hot se no Pass Hard
      if (!profilo?.hardPass) waifu = waifu.filter(w => !w.hot);
      setQueue(prev => [...prev, ...waifu]);
      if (data.exhausted) setExhausted(true);
    } catch (e) { console.error(e); }
    finally { loadingBatchRef.current = false; }
  }, [user, profilo?.hardPass]);

  const loadConfig = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/swap/config', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSwapConfig(data);
    } catch { /* usa defaults */ }
  }, [user]);

  useEffect(() => {
    // Carica batch, config e stato voti giornalieri in parallelo
    const loadStatus = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/swap/status', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setSwapStatus(await res.json());
      } catch (_) {}
    };
    Promise.all([loadBatch(), loadConfig(), loadStatus()]).finally(() => setLoading(false));
  }, []);

  // Carica il prossimo batch quando restano < 3 waifu in coda E non sta già caricando
  useEffect(() => {
    const remaining = queue.length - currentIdx;
    if (remaining < 3 && !exhausted && !loadingBatchRef.current) {
      loadBatch();
    }
  }, [currentIdx, queue.length, exhausted, loadBatch]);

  const handleVote = async (direction) => {
    const waifu = queue[currentIdx];
    if (!waifu) return;

    // Segna come vista
    seenIdsRef.current.add(waifu.id);

    swipeCountRef.current += 1;

    setCurrentIdx(i => i + 1);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/swap/vote', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ waifuId: waifu.id, vote: direction === 'like' ? 'like' : 'dislike' }),
      });
      if (res.status === 429) {
        const data = await res.json();
        const resetTime = data.resetAt ? new Date(data.resetAt) : null;
        const resetHH = resetTime ? `${String(resetTime.getHours()).padStart(2,'0')}:${String(resetTime.getMinutes()).padStart(2,'0')}` : '00:00';
        setToast({ type: 'limit', message: `Limite giornaliero raggiunto (${data.dailyLimit} voti). Riprova alle ${resetHH}.` });
        return;
      }
      const data = await res.json();

      if (data.kissesEarned > 0) {
        setToast({ amount: data.kissesEarned, streakDays: data.streakDays, multiplier: data.multiplier });
        setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + data.kissesEarned }));
      }
      if (data.milestoneHit && data.milestoneEarned > 0) {
        setMilestone({ milestone: data.milestoneHit, amount: data.milestoneEarned });
        setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + data.milestoneEarned }));
      }
      // Pubblicità ogni 5 voti (solo senza Swap Pass) — una volta sola dopo il voto
      if (data.showAd) {
        setShowAd(true);
        loadBatch(); // precarica il prossimo batch durante la pubblicità
      }
    } catch (e) { console.error(e); }
  };

  const currentWaifu = queue[currentIdx];
  const remaining = queue.length - currentIdx;

  // Badge stato waifu: 'owned' | 'seen' | 'new'
  // 'owned' = in collezione | 'seen' = ha un voto in swap_votes | 'new' = mai vista
  const getOwnershipBadge = (w) => {
    if (!w) return null;
    if (profilo && swapStatus) {
      // Controlliamo se la waifu è in collezione (passiamo collezione come prop)
      // Fallback: usiamo il campo _owned iniettato nel batch dalla API swap/batch
      if (w._owned) return 'owned';
      if (w._seen)  return 'seen';
    }
    return 'new';
  };
  const ownershipBadge = getOwnershipBadge(currentWaifu);
  const BADGE_STYLE = {
    owned: { bg: 'rgba(6,214,160,0.2)', border: 'rgba(6,214,160,0.5)', color: '#06d6a0', label: '✓ Già tua' },
    seen:  { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#f59e0b', label: '👁 Già vista' },
    new:   { bg: 'rgba(174,156,255,0.12)', border: 'rgba(174,156,255,0.3)', color: '#a78bfa', label: '✨ Nuova!' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FF.display, fontSize: 40, color: C.sakura, animation: 'pulse 1.2s ease-in-out infinite' }}>🩷</div>
        <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(174,156,255,0.5)', marginTop: 12, textTransform: 'uppercase' }}>Caricamento…</div>
      </div>
    );
  }

  // Schermata limite voti raggiunto
  const isLimitReached = swapStatus && !swapStatus.hasSwapPass && (swapStatus.votesRemaining === 0);
  if (isLimitReached) {
    const msToMidnight = (() => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      return midnight - now;
    })();
    const h = Math.floor(msToMidnight / 3600000);
    const m = Math.floor((msToMidnight % 3600000) / 60000);
    const s = Math.floor((msToMidnight % 60000) / 1000);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 20 }}>
        <div style={{ fontSize: 56 }}>🚫</div>
        <div style={{ fontFamily: FF.display, fontSize: 20, color: C.sakura, fontWeight: 800 }}>Limite voti raggiunto</div>
        <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.6)', lineHeight: 1.6, maxWidth: 320 }}>
          Hai usato tutti i 50 voti giornalieri. Il contatore si azzera a mezzanotte (UTC).
        </div>
        <div style={{ fontFamily: FF.mono, fontSize: 28, color: C.gold, fontWeight: 700 }}>
          {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('impero:apri-negozio'))}
          style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #ec4899, #a855f7)', border: 'none', borderRadius: 14, color: '#fff', fontFamily: FF.label, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em' }}>
          💋 Acquista Swap Pass — Voti illimitati
        </button>
        <button onClick={() => setTab?.('home')} style={{ background: 'transparent', border: 'none', color: 'rgba(241,235,255,0.4)', fontFamily: FF.label, fontSize: 10, cursor: 'pointer' }}>← Torna alla Home</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KissesIcon size={16} />
            <span style={{ fontFamily: FF.display, fontSize: 16, color: C.gold, fontWeight: 700 }}>{profilo?.kisses ?? 0}</span>
          </div>
          {swapStatus && (
            <div style={{ fontFamily: FF.label, fontSize: 9, color: swapStatus.hasSwapPass ? 'rgba(6,214,160,0.8)' : 'rgba(241,235,255,0.4)', letterSpacing: '0.1em' }}>
              {swapStatus.hasSwapPass ? '∞ voti illimitati' : `${swapStatus.dailyVotes}/${swapStatus.dailyLimit} voti oggi`}
            </div>
          )}
        </div>
      </div>

      {/* Banner "Come funziona" — collassabile, default chiuso */}
      <div style={{
        marginBottom: 14, borderRadius: 14, overflow: 'hidden',
        border: '1px solid rgba(255,133,182,0.15)',
        background: 'linear-gradient(135deg, rgba(255,133,182,0.07), rgba(167,139,250,0.05))',
      }}>
        <button onClick={() => setHowExpanded(v => !v)} style={{
          width: '100%', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>ℹ️</span>
            <span style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.2em', color: C.sakura, textTransform: 'uppercase' }}>Come funziona</span>
          </div>
          <span style={{
            fontFamily: FF.label, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'rgba(241,235,255,0.45)', display: 'inline-block',
            transition: 'transform 0.2s', transform: howExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>▼</span>
        </button>
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
            #{seenIdsRef.current.size + 1} — swipa per votare
            {remaining <= 3 && !exhausted && (
              <span style={{ color: 'rgba(108,240,224,0.5)', marginLeft: 8 }}>⟳ caricamento…</span>
            )}
          </div>
          {/* Badge stato waifu sopra la carta */}
          {ownershipBadge && BADGE_STYLE[ownershipBadge] && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div style={{
                background: BADGE_STYLE[ownershipBadge].bg,
                border: `1px solid ${BADGE_STYLE[ownershipBadge].border}`,
                color: BADGE_STYLE[ownershipBadge].color,
                borderRadius: 999, padding: '4px 14px',
                fontFamily: FF.label, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              }}>{BADGE_STYLE[ownershipBadge].label}</div>
            </div>
          )}
          <SwapCard
            key={currentWaifu?.id ?? currentIdx}
            waifu={currentWaifu}
            onVote={handleVote}
            expansionName={currentWaifu?.espansione_nome ?? null}
          />
        </div>
      ) : exhausted ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 56 }}>✨</div>
          <div style={{ fontFamily: FF.body, fontSize: 15, color: 'rgba(241,235,255,0.5)', textAlign: 'center' }}>
            Hai visto tutte le waifu disponibili!<br/>Torna presto per nuove aggiunte.
          </div>
          <button onClick={() => { setQueue([]); setCurrentIdx(0); seenIdsRef.current = new Set(); setExhausted(false); loadBatch(); }} style={{
            padding: '12px 24px', background: 'rgba(255,133,182,0.12)',
            border: '1px solid rgba(255,133,182,0.3)', borderRadius: 12,
            color: C.sakura, fontFamily: FF.label, fontSize: 11,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>↺ Ricarica</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(174,156,255,0.4)', textTransform: 'uppercase' }}>
            Caricamento waifu…
          </div>
        </div>
      )}

      {/* Overlays */}
      {toast && <SwapRewardToast {...toast} onDone={() => setToast(null)} />}
      {milestone && <SwapMilestoneModal {...milestone} onClose={() => setMilestone(null)} />}
      {showAd && <AdSlot onClose={() => setShowAd(false)} />}
    </div>
  );
}
