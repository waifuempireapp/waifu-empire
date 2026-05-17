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

  // Modal states
  const [showBattle, setShowBattle] = useState(false);
  const [showRound, setShowRound] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDefenseEditor, setShowDefenseEditor] = useState(false);
  const [activeBattle, setActiveBattle] = useState(null);

  const loadChunks = useCallback(async () => {
    const cached = sessionStorage.getItem('pixel_map_chunks');
    const cachedAt = Number(sessionStorage.getItem('pixel_map_chunks_at') || 0);
    const TTL = 30 * 1000; // 30s cache

    if (cached && Date.now() - cachedAt < TTL) {
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

  useEffect(() => {
    loadChunks();
    // Mostra tutorial se l'utente non ha pixel
    if ((profilo?.pixelCount ?? 0) === 0) {
      setShowTutorial(true);
    }
  }, []);

  const invalidateCache = () => {
    sessionStorage.removeItem('pixel_map_chunks');
    sessionStorage.removeItem('pixel_map_chunks_at');
  };

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
      if (data.battleId) {
        setActiveBattle({ id: data.battleId, attackerTeam, defenderTeam: selectedPixel.defenseTeam || [], cpuDifficulty: 'easy', attackerWins: 0, defenderWins: 0, pixelX: selectedPixel.x, pixelY: selectedPixel.y });
        setShowBattle(false);
        setShowRound(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleRoundEnd = async (roundWinner) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/mappa/battle/${activeBattle.id}/round`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundWinner }),
      });
      const data = await res.json();
      const updatedBattle = { ...activeBattle, attackerWins: data.attackerWins, defenderWins: data.defenderWins, status: data.status };
      setActiveBattle(updatedBattle);

      if (data.status !== 'in_progress') {
        setShowRound(false);
        invalidateCache();
        await loadChunks();
        if (data.matchWinner === 'attacker') {
          setProfilo(p => ({ ...p, pixelCount: (p.pixelCount ?? 0) + 1 }));
          setShowTutorial(false);
        }
        setSelectedPixel(null);
      } else {
        setShowRound(false); // torna alla schermata pre-round
      }
    } catch (e) { console.error(e); }
  };

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
      if (data.success) {
        setShowPurchase(false);
        invalidateCache();
        await loadChunks();
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
      {/* Header sezione */}
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
        >
          💌 Offerte
        </button>
      </div>

      {/* Canvas mappa */}
      <div style={{ height: 380 }}>
        <PixelGrid
          chunks={chunks}
          userUid={user.uid}
          selectedPixel={selectedPixel}
          onPixelSelect={setSelectedPixel}
        />
      </div>

      {/* Mini leaderboard */}
      <MiniLeaderboard
        chunks={chunks}
        userUid={user.uid}
        profilo={profilo}
        passiveRate={swapConfig?.passiveKissesRate ?? 1}
        user={user}
        onKissesUpdate={(earned) => setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + earned }))}
      />

      {/* Pixel detail bottom sheet */}
      {selectedPixel && !showBattle && !showRound && !showPurchase && !showDefenseEditor && (
        <PixelDetail
          pixel={selectedPixel}
          userUid={user.uid}
          waifuCat={waifuCat}
          onClose={() => setSelectedPixel(null)}
          onAttack={() => setShowBattle(true)}
          onPurchase={() => setShowPurchase(true)}
          onEditDefense={() => setShowDefenseEditor(true)}
        />
      )}

      {/* Modals */}
      {showTutorial && (
        <TutorialOverlay
          onSelectPixel={(x, y) => { setSelectedPixel({ x, y, ownerId: 'CPU', ownerColor: '#888888', ownerName: 'CPU' }); setShowTutorial(false); setShowBattle(true); }}
          onClose={() => setShowTutorial(false)}
        />
      )}
      {showBattle && selectedPixel && (
        <BattleModal
          pixel={selectedPixel}
          collezione={collezione}
          waifuCat={waifuCat}
          onConfirm={handleAttack}
          onClose={() => setShowBattle(false)}
        />
      )}
      {showRound && activeBattle && (
        <RoundViewer
          battle={activeBattle}
          waifuCat={waifuCat}
          collezione={collezione}
          onRoundEnd={handleRoundEnd}
          onClose={() => setShowRound(false)}
        />
      )}
      {showPurchase && selectedPixel && (
        <PurchaseModal
          pixel={selectedPixel}
          profilo={profilo}
          onConfirm={handlePurchase}
          onClose={() => setShowPurchase(false)}
        />
      )}
      {showOffers && (
        <OffersPanel user={user} onClose={() => setShowOffers(false)} />
      )}
      {showDefenseEditor && selectedPixel && (
        <TeamDifesaEditor
          pixelKey={`${selectedPixel.x}_${selectedPixel.y}`}
          collezione={collezione}
          waifuCat={waifuCat}
          user={user}
          profilo={profilo}
          onClose={() => setShowDefenseEditor(false)}
        />
      )}
    </div>
  );
}
