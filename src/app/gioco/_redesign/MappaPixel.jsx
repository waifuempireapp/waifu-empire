'use client';
import { useState, useEffect, useCallback } from 'react';
import { C, FF } from './_shared';
import { LAND_SET, PIXEL_NAMES } from '@/lib/worldMap';
import { updateUserProfile } from '@/lib/firestoreService';
import PixelGrid from '@/components/mappa/PixelGrid';
import PixelDetail from '@/components/mappa/PixelDetail';
import MiniLeaderboard from '@/components/mappa/MiniLeaderboard';
import RaidIslandPanel from '@/components/mappa/RaidIslandPanel';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import BattleModal from '@/components/mappa/BattleModal';
import RoundViewer from '@/components/mappa/RoundViewer';
import PurchaseModal from '@/components/mappa/PurchaseModal';
import OffersPanel from '@/components/mappa/OffersPanel';
import TutorialOverlay from '@/components/mappa/TutorialOverlay';
import TeamDifesaEditor from '@/components/difesa/TeamDifesaEditor';
import MappaInfoModal from '@/components/mappa/MappaInfoModal';
import TerritoryConquestAnimation from '@/components/mappa/TerritoryConquestAnimation';

export function MappaPixelTab({ user, profilo, setProfilo, collezione, waifuCat, mosseCat = [], onRaidBattle, raidBattleCtx, onRaidBattleEnd }) {
  const [chunks, setChunks] = useState(null);
  const [swapConfig, setSwapConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPixel, setSelectedPixel] = useState(null);
  const [myDefenseMap, setMyDefenseMap] = useState({}); // defense_config dell'utente corrente

  const [pendingOffersCount, setPendingOffersCount] = useState(0);
  const [attackError, setAttackError] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [conquestAnim, setConquestAnim] = useState(null); // { pixelName, oldColor, newColor, empireName }
  const [showBattle, setShowBattle] = useState(false);
  const [showRound, setShowRound] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDefenseEditor, setShowDefenseEditor] = useState(false);
  const [activeBattle, setActiveBattle] = useState(null);
  const [showRaidPanel, setShowRaidPanel] = useState(false);
  const [raidInfo, setRaidInfo] = useState(null);
  // Raid battle states
  const [showRaidWaifuPick, setShowRaidWaifuPick] = useState(false);
  const [raidArenaActive, setRaidArenaActive] = useState(false);
  const [raidPlayerTeam, setRaidPlayerTeam] = useState([]);
  const [raidEnemyTeam, setRaidEnemyTeam] = useState([]);

  // Quando raidBattleCtx arriva da GiocoPage, apri la selezione waifu
  useEffect(() => {
    if (raidBattleCtx) setShowRaidWaifuPick(true);
  }, [raidBattleCtx]);

  const loadChunks = useCallback(async (forceRefresh = false) => {
    const cached = sessionStorage.getItem('pixel_map_chunks');
    const cachedAt = Number(sessionStorage.getItem('pixel_map_chunks_at') || 0);
    const TTL = 2 * 60 * 1000; // 2 minuti (era 30s) — la mappa cambia solo dopo battaglie/acquisti

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

  // Carica il conteggio delle offerte in entrata in sospeso
  const loadPendingOffers = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/mappa/offers', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setPendingOffersCount((data.incoming || []).filter(o => o.status === 'pending').length);
    } catch { /* ignora */ }
  }, [user]);

  useEffect(() => {
    loadChunks();
    loadMyDefenseConfig();
    loadPendingOffers();
    // Mostra tutorial se pixelCount è 0 o non inizializzato
    const hasNoPixels = (profilo?.pixelCount ?? 0) === 0;
    if (hasNoPixels) setShowTutorial(true);
  }, []);

  const invalidateAndReload = useCallback(async () => {
    sessionStorage.removeItem('pixel_map_chunks');
    sessionStorage.removeItem('pixel_map_chunks_at');
    await loadChunks(true);
  }, [loadChunks]);

  // ── CONTROLLO ADIACENZA CLIENT-SIDE ─────────────────────────────────────────
  // Adiacenza via mare: in ogni direzione (8) si saltano i pixel oceano
  // finché non si trova terra. Se il primo pixel terra trovato è dell'utente → adiacente.
  const checkAdjacentToEmpire = useCallback((tx, ty) => {
    const userPixelCount = profilo?.pixelCount ?? 0;
    if (userPixelCount === 0) return true; // primo pixel → sempre adiacente
    if (!chunks) return false;
    const dirs8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dx, dy] of dirs8) {
      let nx = tx + dx;
      let ny = ty + dy;
      while (nx >= 0 && nx < 50 && ny >= 0 && ny < 50) {
        const key = `${nx}_${ny}`;
        const chunkCol = Math.floor(nx / 10);
        const chunkRow = Math.floor(ny / 10);
        const cid = `chunk_${chunkCol}_${chunkRow}`;
        const pData = chunks[cid]?.pixels?.[key];
        if (pData !== undefined) {
          // Pixel terra trovato in questa direzione
          if (pData.ownerId === user.uid) return true;
          break; // Terra di un altro → blocca questa direzione
        }
        // Pixel oceano → continua nella stessa direzione
        nx += dx;
        ny += dy;
      }
    }
    return false;
  }, [chunks, user.uid, profilo?.pixelCount]);

  // ── SELEZIONE PIXEL ──────────────────────────────────────────────────────────
  const handlePixelSelect = useCallback(async (pixel) => {
    const isAdj = checkAdjacentToEmpire(pixel.x, pixel.y);
    const price  = 200 + ((pixel.ownerLevel ?? 1) * 50);
    // Leggi difficoltà dal chunk
    const chunkCol = Math.floor(pixel.x / 10);
    const chunkRow = Math.floor(pixel.y / 10);
    const chunkId = `chunk_${chunkCol}_${chunkRow}`;
    const chunkDifficulty = chunks?.[chunkId]?.difficulty ?? 'easy';
    const pixelWithName = {
      ...pixel,
      name: PIXEL_NAMES[`${pixel.x}_${pixel.y}`] || null,
      isAdjacentToEmpire: isAdj,
      canAffordBuy: (profilo?.kisses ?? 0) >= price,
      buyPrice: price,
      difficulty: chunkDifficulty,
    };
    setSelectedPixel(pixelWithName);
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
  // checkAdjacentToEmpire incluso nelle deps per evitare stale closure
  }, [user, PIXEL_NAMES, checkAdjacentToEmpire, profilo?.kisses]);

  // ── ATTACCO ──────────────────────────────────────────────────────────────────
  // L'API attack ora ritorna anche cpuDifficulty
  const handleAttack = async (attackerTeam) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/mappa/attack', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetX: selectedPixel.x, targetY: selectedPixel.y, attackerTeam }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Attacco fallito:', data.error);
        // Mostra l'errore all'utente invece di fallire silenziosamente
        setAttackError(data.error || 'Errore nel tentativo di attacco. Riprova.');
        setShowBattle(false); // chiudi BattleModal
        return;
      }
      if (data.battleId) {
        setActiveBattle({
          id: data.battleId,
          attackerTeam,
          defenderTeam: data.defenderTeam || [],
          cpuDifficulty: data.cpuDifficulty || 'easy',
          attackerWins: 0,
          defenderWins: 0,
          pixelX: selectedPixel.x,
          pixelY: selectedPixel.y,
          defenderUid: selectedPixel.ownerId,
          defenderColor: selectedPixel.ownerColor,
          name: selectedPixel.name || null, // nome territorio per l'animazione
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
  // choice: null (match concluso) | 'same' (stessa squadra) | 'switch' (cambia squadra)
  const handleRoundComplete = useCallback(async (isVictory, choice, prevPlayerIds, prevEnemyIds) => {
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
        // Fix 13: chiudi RoundViewer e selectedPixel IMMEDIATAMENTE
        // (prima di invalidateAndReload) per evitare il flash del PixelDetail
        setShowRound(false);
        setSelectedPixel(null);
        setActiveBattle(null);

        if (data.status === 'attacker_wins') {
          // Mostra animazione conquista (non aspetta il reload della mappa)
          const oldColor = activeBattle?.defenderUid === 'CPU' ? '#888888' : (activeBattle?.defenderColor || '#ff85b6');
          const newColor = profilo?.coloreImpero || '#ff85b6';
          setConquestAnim({
            pixelName: activeBattle?.name || `(${activeBattle?.pixelX}, ${activeBattle?.pixelY})`,
            oldColor, newColor, empireName: profilo?.nomeImpero || 'Tu',
          });
          setProfilo(p => ({ ...p, pixelCount: (p.pixelCount ?? 0) + 1, pacchettiSfida: (p.pacchettiSfida ?? 0) + 1 }));
          setShowTutorial(false);
        } else if (data.status === 'defender_wins') {
          setProfilo(p => ({ ...p, energia: Math.max(0, (p.energia ?? 0) - 1) }));
        }
        await invalidateAndReload();
      } else {
        // Round in corso: aggiorna win counts + nextRoundChoice + team precedenti.
        // La `key` cambia → React rimonta RoundViewer con la fase giusta.
        setActiveBattle(prev => ({
          ...prev,
          attackerWins: data.attackerWins ?? (prev.attackerWins + (roundWinner === 'attacker' ? 1 : 0)),
          defenderWins: data.defenderWins ?? (prev.defenderWins + (roundWinner === 'defender' ? 1 : 0)),
          nextRoundChoice: choice,       // 'same' | 'switch' | null
          prevPlayerTeamIds: prevPlayerIds ?? [],
          prevEnemyTeamIds: prevEnemyIds ?? [],
        }));
      }
    } catch (e) {
      console.error('Errore round API:', e);
      setActiveBattle(prev => ({
        ...prev,
        attackerWins: prev.attackerWins + (roundWinner === 'attacker' ? 1 : 0),
        defenderWins: prev.defenderWins + (roundWinner === 'defender' ? 1 : 0),
        nextRoundChoice: choice,
        prevPlayerTeamIds: prevPlayerIds ?? [],
        prevEnemyTeamIds: prevEnemyIds ?? [],
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
          onClick={() => { setShowOffers(true); }}
          style={{
            position: 'relative',
            background: 'rgba(245,197,96,0.1)', border: '1px solid rgba(245,197,96,0.3)',
            borderRadius: 10, color: C.gold, fontFamily: FF.label, fontSize: 10,
            letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 12px', cursor: 'pointer',
          }}
        >
          💌 Offerte
          {pendingOffersCount > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -6,
              background: '#ff5b6c', color: '#fff',
              width: 16, height: 16, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 800,
              border: '1px solid rgba(3,2,12,0.8)',
            }}>{pendingOffersCount}</span>
          )}
        </button>
        <button onClick={() => setShowInfoModal(true)} style={{
          background: 'rgba(174,156,255,0.08)', border: '1px solid rgba(174,156,255,0.25)',
          borderRadius: 10, color: 'rgba(174,156,255,0.8)', fontFamily: FF.label, fontSize: 12,
          fontWeight: 700, padding: '6px 10px', cursor: 'pointer', minWidth: 32,
        }}>?</button>
      </div>

      {/* Raid Island widget — SOPRA la mappa */}
      <div
        onClick={() => setShowRaidPanel(true)}
        style={{
          margin: '0 16px 10px', padding: '10px 16px',
          background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(10,7,38,0.9))',
          border: '1px solid rgba(236,72,153,0.35)', borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
        <div style={{ fontSize: 24 }}>⚔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 12, color: '#ec4899', fontWeight: 800 }}>Raid Island</div>
          <div style={{ fontFamily: "'Saira Condensed',sans-serif", fontSize: 9, color: 'rgba(241,235,255,0.5)', letterSpacing: '0.12em' }}>
            Tocca per il Raid orario cooperativo ⚔
          </div>
        </div>
        <div style={{ fontFamily: "'Saira Condensed',sans-serif", fontSize: 10, color: 'rgba(236,72,153,0.7)' }}>→</div>
      </div>

      {/* Canvas mappa */}
      <div style={{ height: 380 }}>
        <PixelGrid
          chunks={chunks}
          userUid={user.uid}
          selectedPixel={selectedPixel}
          onPixelSelect={handlePixelSelect}
          landSet={LAND_SET}
        />
      </div>

      {/* Raid Island full panel */}
      {showRaidPanel && (
        <RaidIslandPanel
          user={user}
          profilo={profilo}
          onClose={() => setShowRaidPanel(false)}
          onBattle={(raid) => {
            setShowRaidPanel(false);
            onRaidBattle?.(raid); // passa il raid context a page.jsx
          }}
        />
      )}

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
          hasHardPass={profilo?.hardPass === true}
          onClose={() => setSelectedPixel(null)}
          onAttack={() => setShowBattle(true)}
          onPurchase={() => setShowPurchase(true)}
          onEditDefense={() => setShowDefenseEditor(true)}
        />
      )}

      {/* Tutorial (nuovo utente senza pixel) */}
      {attackError && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, maxWidth: 320, width: '90vw',
          background: 'rgba(255,91,108,0.95)', color: '#fff',
          borderRadius: 14, padding: '14px 18px',
          fontFamily: FF.body, fontSize: 13, lineHeight: 1.5, textAlign: 'center',
          boxShadow: '0 8px 32px rgba(255,91,108,0.4)',
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>⚠️ Attacco non riuscito</div>
          <div style={{ opacity: 0.9, fontSize: 12 }}>{attackError}</div>
          <button onClick={() => setAttackError(null)} style={{
            marginTop: 10, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 8, color: '#fff', fontFamily: FF.label, fontSize: 10,
            letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 14px', cursor: 'pointer',
          }}>OK</button>
        </div>
      )}

      {conquestAnim && (
        <TerritoryConquestAnimation
          {...conquestAnim}
          onDone={() => setConquestAnim(null)}
        />
      )}
      {showInfoModal && <MappaInfoModal onClose={() => setShowInfoModal(false)} />}

      {showTutorial && (
        <TutorialOverlay onClose={async () => {
          setShowTutorial(false);
          // Salva pixelCount = 0 → tutorial non riparte alla sessione successiva
          // ma il giocatore può ancora attaccare qualsiasi pixel senza adiacenza
          try {
            await updateUserProfile(user.uid, { pixelCount: 0 });
            setProfilo(p => ({ ...p, pixelCount: 0 }));
          } catch { /* ignora errori di rete */ }
        }} />
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
          key={`${activeBattle.id}-${activeBattle.attackerWins}-${activeBattle.defenderWins}-${activeBattle.nextRoundChoice ?? ''}`}
          battle={activeBattle}
          waifuCat={waifuCat}
          collezione={collezione}
          profilo={profilo}
          hasHardPass={profilo?.hardPass === true}
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
        <OffersPanel
          user={user}
          onClose={() => { setShowOffers(false); loadPendingOffers(); }}
          onKissesUpdate={(amount) => setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + amount }))}
          onMapUpdate={invalidateAndReload}
        />
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

      {/* ── RAID BATTLE FLOW ── */}
      {/* Step 1: selezione 5 waifu (riusa BattleModal con un "pixel raid" fittizio) */}
      {showRaidWaifuPick && raidBattleCtx && (
        <BattleModal
          pixel={{ ownerId: 'CPU', ownerName: 'Raid', name: `Waifu Raid — ${raidBattleCtx.waifuNome ?? ''}`, defenderTeam: (raidBattleCtx.deck || []).slice(0, 5) }}
          collezione={collezione}
          waifuCat={waifuCat}
          onConfirm={(attackerTeam) => {
            // Build battle-ready player team
            const playerTeam = attackerTeam.slice(0, 5).map(wid => {
              const w = waifuCat.find(x => x.id === wid);
              const dati = collezione.waifu?.[wid] ?? {};
              if (!w) return null;
              const speed = dati.velocita ?? w.velocita_base ?? 150;
              const critChance = dati.crit_chance ?? w.crit_chance_base ?? 0.10;
              const bs = w.battleStats || {};
              return { ...w, ...dati, id: w.id, name: w.nome, speed, critChance, hp: bs.maxHp ?? 300, maxHp: bs.maxHp ?? 300, moves: bs.moves ?? [], isKO: false, rarita: w.rarita ?? 'comune', level: dati.livello ?? 1, image: w.asset_statica ?? null };
            }).filter(Boolean);
            // Build CPU team from raid deck
            const enemyTeam = (raidBattleCtx.deck || []).slice(0, 5).map((wid, i) => {
              const cleanId = wid.startsWith('raid_') ? wid.slice(5) : wid;
              const w = waifuCat.find(x => x.id === cleanId) ?? waifuCat[i] ?? waifuCat[0];
              if (!w) return null;
              const bs = w.battleStats || {};
              return { ...w, id: `raid_${w.id ?? i}`, name: w.nome ?? `Raid ${i}`, speed: 200, critChance: 0.15, hp: bs.maxHp ?? 400, maxHp: bs.maxHp ?? 400, moves: bs.moves ?? [], isKO: false, rarita: w.rarita ?? 'comune', level: 5, image: w.asset_statica ?? null };
            }).filter(Boolean);
            setRaidPlayerTeam(playerTeam);
            setRaidEnemyTeam(enemyTeam);
            setShowRaidWaifuPick(false);
            setRaidArenaActive(true);
          }}
          onClose={() => { setShowRaidWaifuPick(false); onRaidBattleEnd?.(); }}
        />
      )}

      {/* Step 2: WaifuBattleArena contro il deck del raid */}
      {raidArenaActive && raidBattleCtx && (
        <WaifuBattleArena
          playerTeam={raidPlayerTeam}
          enemyTeam={raidEnemyTeam}
          waifuCat={waifuCat}
          battleCtx={{ nomeImpero: profilo?.nomeImpero ?? 'Tu', nomeImperoAvversario: `Raid — ${raidBattleCtx.waifuNome ?? ''}`, sonoAttaccante: true }}
          onBattleResult={async (isVictory) => {
            try {
              const token = await user.getIdToken();
              await fetch('/api/raid/join', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: raidBattleCtx.id, won: isVictory }),
              });
            } catch (e) { console.error('[raid/join]', e); }
            setRaidArenaActive(false);
            setRaidPlayerTeam([]);
            setRaidEnemyTeam([]);
            onRaidBattleEnd?.();
            setShowRaidPanel(true); // riapri il pannello raid per vedere HP aggiornati
          }}
          onExit={() => {
            setRaidArenaActive(false);
            onRaidBattleEnd?.();
          }}
        />
      )}
    </div>
  );
}
