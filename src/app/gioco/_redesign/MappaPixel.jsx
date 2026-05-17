'use client';
import { useState, useEffect, useCallback } from 'react';
import { C, FF } from './_shared';
import PixelGrid from '@/components/mappa/PixelGrid';
import PixelDetail from '@/components/mappa/PixelDetail';
import MiniLeaderboard from '@/components/mappa/MiniLeaderboard';
import BattleModal from '@/components/mappa/BattleModal';
import RoundViewer from '@/components/mappa/RoundViewer';
import PurchaseModal from '@/components/mappa/PurchaseModal';
import OffersPanel from '@/components/mappa/OffersPanel';
import TutorialOverlay from '@/components/mappa/TutorialOverlay';
import TeamDifesaEditor from '@/components/difesa/TeamDifesaEditor';

export function MappaPixelTab({ user, profilo, setProfilo, collezione, waifuCat }) {
  const [chunks, setChunks] = useState(null);
  const [swapConfig, setSwapConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPixel, setSelectedPixel] = useState(null);
  const [myDefenseMap, setMyDefenseMap] = useState({}); // defense_config dell'utente corrente

  const [showBattle, setShowBattle] = useState(false);
  const [showRound, setShowRound] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDefenseEditor, setShowDefenseEditor] = useState(false);
  const [activeBattle, setActiveBattle] = useState(null);

  const loadChunks = useCallback(async (forceRefresh = false) => {
    const cached = sessionStorage.getItem('pixel_map_chunks');
    const cachedAt = Number(sessionStorage.getItem('pixel_map_chunks_at') || 0);
    const TTL = 30 * 1000;

    if (!forceRefresh && cached && Date.now() - cachedAt < TTL) {
      setChunks(JSON.parse(cached));
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const [chunksRes, configRes] = await Promise.all([
        fetch('/api/mappa/chunks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/swap/config', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const { chunks: data } = await chunksRes.json();
      const config = await configRes.json();
      sessionStorage.setItem('pixel_map_chunks', JSON.stringify(data));
      sessionStorage.setItem('pixel_map_chunks_at', String(Date.now()));
      setChunks(data);
      setSwapConfig(config);
    } catch (e) {
      console.error('Errore caricamento mappa:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Carica defense_config dell'utente corrente una volta sola all'apertura della mappa
  const loadMyDefenseConfig = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/difesa', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMyDefenseMap(data.defenseMap ?? {});
    } catch (e) { /* ignora */ }
  }, [user]);

  useEffect(() => {
    loadChunks();
    loadMyDefenseConfig();
    if ((profilo?.pixelCount ?? 0) === 0) setShowTutorial(true);
  }, []);

  const invalidateAndReload = useCallback(async () => {
    sessionStorage.removeItem('pixel_map_chunks');
    sessionStorage.removeItem('pixel_map_chunks_at');
    await loadChunks(true);
  }, [loadChunks]);

  // ── SELEZIONE PIXEL ──────────────────────────────────────────────────────────
  // Quando si tocca un pixel non-proprio e non-CPU, carichiamo il defenderTeam dal server
  const handlePixelSelect = useCallback(async (pixel) => {
    setSelectedPixel(pixel); // mostra subito il popup con i dati del chunk
    if (pixel.ownerId !== 'CPU' && pixel.ownerId !== user.uid) {
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/mappa/pixel/${pixel.x}/${pixel.y}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.defenderTeam) {
          setSelectedPixel(prev => prev ? { ...prev, defenderTeam: data.defenderTeam } : prev);
        }
      } catch { /* ignora */ }
    }
  }, [user]);

  // ── ATTACCO ──────────────────────────────────────────────────────────────────
  // L'API attack ora ritorna anche cpuDifficulty
  const handleAttack = async (attackerTeam) => {
    try {
      const token = await user.getIdToken();
      const isTutorial = (profilo?.pixelCount ?? 0) === 0;
      const res = await fetch('/api/mappa/attack', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetX: selectedPixel.x, targetY: selectedPixel.y, attackerTeam, isTutorial }),
      });
      const data = await res.json();
      if (!res.ok) { console.error('Attacco fallito:', data.error); return; }
      if (data.battleId) {
        setActiveBattle({
          id: data.battleId,
          attackerTeam,
          defenderTeam: data.defenderTeam || [], // 5 waifuId del difensore, dal server
          cpuDifficulty: data.cpuDifficulty || 'easy',
          attackerWins: 0,
          defenderWins: 0,
          pixelX: selectedPixel.x,
          pixelY: selectedPixel.y,
          defenderUid: selectedPixel.ownerId,
        });
        setShowBattle(false);
        setShowRound(true);
      }
    } catch (e) { console.error(e); }
  };

  // ── RISULTATO ROUND ───────────────────────────────────────────────────────────
  // Chiamata da RoundViewer.onExit SUBITO dopo che l'utente preme "Continua" nel popup.
  // Fix #2: l'API call avviene QUI (in MappaPixel), non in RoundViewer.
  // MappaPixel usa `key` su RoundViewer per rimontarlo tra round (resetta phase a 'pre').
  const handleRoundComplete = useCallback(async (isVictory) => {
    if (!activeBattle?.id) return;
    const roundWinner = isVictory ? 'attacker' : 'defender';
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/mappa/battle/${activeBattle.id}/round`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundWinner }),
      });
      const data = await res.json();

      if (data.status === 'attacker_wins' || data.status === 'defender_wins') {
        // Match finito → chiude RoundViewer e aggiorna la mappa
        setShowRound(false);
        setActiveBattle(null);
        await invalidateAndReload();
        if (data.status === 'attacker_wins') {
          setProfilo(p => ({ ...p, pixelCount: (p.pixelCount ?? 0) + 1 }));
          setShowTutorial(false);
        }
        setSelectedPixel(null);
      } else {
        // Round finito, match in corso → aggiorna win counts in activeBattle.
        // La `key` su RoundViewer cambierà → React rimonta RoundViewer → phase torna a 'pre'.
        setActiveBattle(prev => ({
          ...prev,
          attackerWins: data.attackerWins ?? (prev.attackerWins + (roundWinner === 'attacker' ? 1 : 0)),
          defenderWins: data.defenderWins ?? (prev.defenderWins + (roundWinner === 'defender' ? 1 : 0)),
        }));
      }
    } catch (e) {
      console.error('Errore round API:', e);
      // Fallback: aggiorna localmente i win counts e rimonta RoundViewer
      setActiveBattle(prev => ({
        ...prev,
        attackerWins: prev.attackerWins + (roundWinner === 'attacker' ? 1 : 0),
        defenderWins: prev.defenderWins + (roundWinner === 'defender' ? 1 : 0),
      }));
    }
  }, [activeBattle, user, invalidateAndReload, setProfilo]);

  // ── ACQUISTO ──────────────────────────────────────────────────────────────────
  const handlePurchase = async ({ amount }) => {
    try {
      const token = await user.getIdToken();
      const isCPU = selectedPixel?.ownerId === 'CPU';
      const res = await fetch('/api/mappa/purchase', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetX: selectedPixel.x, targetY: selectedPixel.y, offerAmount: isCPU ? undefined : amount }),
      });
      const data = await res.json();
      if (!res.ok) { console.error('Acquisto fallito:', data.error); return; }
      if (data.success) {
        setShowPurchase(false);
        await invalidateAndReload();
        if (data.type === 'cpu_purchase') {
          setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) - data.price, pixelCount: (p.pixelCount ?? 0) + 1 }));
          setShowTutorial(false);
        }
        setSelectedPixel(null);
      }
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: FF.display, fontSize: 32, color: C.sakura, animation: 'pulse 1.2s ease-in-out infinite' }}>♛</div>
        <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(174,156,255,0.5)', marginTop: 12, textTransform: 'uppercase' }}>
          Caricamento mappa…
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', margin: '-12px -16px' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }}>◆ CONQUISTA</div>
          <div style={{ fontFamily: FF.display, fontSize: 20, color: '#fff', fontWeight: 800 }}>Mappa del Mondo</div>
        </div>
        <button
          onClick={() => setShowOffers(true)}
          style={{
            background: 'rgba(245,197,96,0.1)', border: '1px solid rgba(245,197,96,0.3)',
            borderRadius: 10, color: C.gold, fontFamily: FF.label, fontSize: 10,
            letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 12px', cursor: 'pointer',
          }}
        >💌 Offerte</button>
      </div>

      {/* Canvas mappa */}
      <div style={{ height: 380 }}>
        <PixelGrid
          chunks={chunks}
          userUid={user.uid}
          selectedPixel={selectedPixel}
          onPixelSelect={handlePixelSelect}
        />
      </div>

      {/* Mini leaderboard + passive kisses */}
      <MiniLeaderboard
        chunks={chunks}
        userUid={user.uid}
        profilo={profilo}
        passiveRate={swapConfig?.passiveKissesRate ?? 1}
        user={user}
        onKissesUpdate={(earned) => setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + earned }))}
      />

      {/* Pixel detail popup */}
      {selectedPixel && !showBattle && !showRound && !showPurchase && !showDefenseEditor && (
        <PixelDetail
          pixel={selectedPixel}
          userUid={user.uid}
          waifuCat={waifuCat}
          myDefenseTeam={myDefenseMap[`${selectedPixel.x}_${selectedPixel.y}`] || []}
          onClose={() => setSelectedPixel(null)}
          onAttack={() => setShowBattle(true)}
          onPurchase={() => setShowPurchase(true)}
          onEditDefense={() => setShowDefenseEditor(true)}
        />
      )}

      {/* Tutorial (nuovo utente senza pixel) */}
      {showTutorial && (
        <TutorialOverlay onClose={() => setShowTutorial(false)} />
      )}

      {/* Selezione team offensivo */}
      {showBattle && selectedPixel && (
        <BattleModal
          pixel={selectedPixel}
          collezione={collezione}
          waifuCat={waifuCat}
          onConfirm={handleAttack}
          onClose={() => setShowBattle(false)}
        />
      )}

      {/* Pick phase + Arena di battaglia.
          key = win counts: cambia ad ogni round completato → React rimonta RoundViewer
          così phase torna a 'pre' automaticamente senza logica extra */}
      {showRound && activeBattle && (
        <RoundViewer
          key={`${activeBattle.id}-${activeBattle.attackerWins}-${activeBattle.defenderWins}`}
          battle={activeBattle}
          waifuCat={waifuCat}
          collezione={collezione}
          profilo={profilo}
          onRoundComplete={handleRoundComplete}
          onClose={() => { setShowRound(false); setActiveBattle(null); }}
        />
      )}

      {/* Acquisto pixel */}
      {showPurchase && selectedPixel && (
        <PurchaseModal
          pixel={selectedPixel}
          profilo={profilo}
          onConfirm={handlePurchase}
          onClose={() => setShowPurchase(false)}
        />
      )}

      {/* Lista offerte */}
      {showOffers && (
        <OffersPanel user={user} onClose={() => setShowOffers(false)} />
      )}

      {/* Editor team difensore */}
      {showDefenseEditor && selectedPixel && (
        <TeamDifesaEditor
          pixelKey={`${selectedPixel.x}_${selectedPixel.y}`}
          collezione={collezione}
          waifuCat={waifuCat}
          user={user}
          profilo={profilo}
          currentTeam={myDefenseMap[`${selectedPixel.x}_${selectedPixel.y}`] || []}
          onClose={() => setShowDefenseEditor(false)}
          onSaved={() => { loadMyDefenseConfig(); setShowDefenseEditor(false); }}
        />
      )}
    </div>
  );
}
