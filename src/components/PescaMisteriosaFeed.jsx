'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import PescaPackCard from './PescaPackCard';
import PescaRevealAnimation from './PescaRevealAnimation';
import KissesIcon from './KissesIcon';
import KissesShortageModal from './KissesShortageModal';

const KISSES_COST = 10;

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Retro della carta — design tematico per la selezione alla cieca
function CardBack({ selected, onClick, size = 'md' }) {
  const w = size === 'md' ? 72 : 56;
  const h = size === 'md' ? 100 : 78;
  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(145deg, #120825, #0d0618)',
        border: `2px solid ${selected ? '#ff4d9e' : 'rgba(245,166,35,0.35)'}`,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
        boxShadow: selected
          ? '0 0 20px rgba(255,77,158,0.6), 0 0 8px rgba(255,77,158,0.3)'
          : '0 2px 12px rgba(0,0,0,0.5)',
        transform: selected ? 'scale(1.1) translateY(-6px)' : 'scale(1)',
        transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        position: 'relative', overflow: 'hidden', userSelect: 'none',
      }}
    >
      <div style={{ position: 'absolute', inset: 4, border: `1px solid ${selected ? 'rgba(255,77,158,0.4)' : 'rgba(245,166,35,0.15)'}`, borderRadius: 5, transition: 'border-color 0.2s' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(245,166,35,0.03) 6px, rgba(245,166,35,0.03) 7px)' }} />
      <span style={{ fontSize: size === 'md' ? 26 : 20, color: selected ? '#ff4d9e' : 'rgba(245,166,35,0.55)', filter: selected ? 'drop-shadow(0 0 10px rgba(255,77,158,0.9))' : 'none', transition: 'all 0.2s', zIndex: 1 }}>♛</span>
      {selected && <div style={{ fontSize: 7, fontFamily: 'Orbitron', letterSpacing: 1, color: '#ff4d9e', zIndex: 1 }}>SCELTA</div>}
    </div>
  );
}

export default function PescaMisteriosaFeed({ user, profilo, collezione, waifuCat, initialPacks, onKissesSpent, onCollectionRefresh }) {
  const [packs, setPacks]               = useState(initialPacks || []);
  const [loading, setLoading]           = useState(initialPacks === null);
  const lastFishedRef                   = useRef(null);
  const [error, setError]               = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);
  const [shuffledOrder, setShuffledOrder]         = useState([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [busy, setBusy]                 = useState(false);
  const [risultato, setRisultato]       = useState(null);
  const [notif, setNotif]               = useState(null);
  const [kissesShortage, setKissesShortage]       = useState(null);

  const caricaFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/pesca/feed', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento feed');
      setPacks(data.packs || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [user]);

  // Carica il feed solo se non sono stati passati initialPacks
  useEffect(() => { if (initialPacks === null) caricaFeed(); }, [caricaFeed]);

  const mostraNotif = (testo, colore = '#ff4d9e') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2500);
  };

  const aprePack = (pack) => {
    const indices = Array.from({ length: (pack.cards || []).length }, (_, i) => i);
    setShuffledOrder(fisherYates(indices));
    setSelectedPack(pack);
    setSelectedCardIndex(null);
  };

  const confermaScelta = async () => {
    if (selectedCardIndex === null || !selectedPack || busy) return;
    setBusy(true);
    try {
      const realIndex = shuffledOrder[selectedCardIndex];
      const token = await user.getIdToken();
      // Ghost pack ora in Firestore: non serve più ghostCards nel body
      const body = { snapshotId: selectedPack.id, chosenCardIndex: realIndex };
      const res = await fetch('/api/pesca/fish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore pesca');

      lastFishedRef.current = { id: selectedPack.id, isGhost: selectedPack.isGhost };
      setSelectedPack(null);
      setSelectedCardIndex(null);
      setShuffledOrder([]);

      const shuffledCards = shuffledOrder.map(i => selectedPack.cards[i]);
      const isNewArr = shuffledCards.map(c => {
        if (!collezione) return false;
        if (c.tipo === 'waifu')  return !collezione.waifu?.[c.id];
        if (c.tipo === 'outfit') return !collezione.outfit?.[c.id];
        if (c.tipo === 'posa')   return !collezione.pose?.[c.id];
        return false;
      });
      setRisultato({ allCards: shuffledCards, chosenIndex: selectedCardIndex, isNewArr });
      onKissesSpent?.(KISSES_COST);
    } catch (e) {
      mostraNotif(e.message, '#ff4d4d');
    } finally { setBusy(false); }
  };

  const onRivelazioneFine = async () => {
    setRisultato(null);
    const fished = lastFishedRef.current;
    if (fished) {
      // Marca il pack come pescato in local state — il server lo ha già salvato in fishing_attempts
      // Al prossimo fetch (rientro nella sezione) il server restituirà alreadyFished: true
      setPacks(prev => prev.map(p => p.id === fished.id ? { ...p, alreadyFished: true } : p));
      lastFishedRef.current = null;
    }
    mostraNotif('Carta aggiunta alla collezione!', '#00e676');
    onCollectionRefresh?.();
  };

  const kissesAttuali = profilo?.kisses ?? 0;

  return (
    <div style={{ position: 'relative' }}>
      {notif && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(12px)',
          border: `1px solid ${notif.colore}80`, color: notif.colore,
          padding: '10px 24px', borderRadius: 10, fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 11, zIndex: 500,
        }}>{notif.testo}</div>
      )}

      {/* Modale Kisses insufficienti */}
      {kissesShortage && (
        <KissesShortageModal
          missingKisses={KISSES_COST - kissesAttuali}
          currentKisses={kissesAttuali}
          user={user}
          onSuccess={(newKisses) => {
            onKissesSpent?.(0);
            const pack = kissesShortage.pendingPack;
            setKissesShortage(null);
            setTimeout(() => aprePack(pack), 200);
          }}
          onCancel={() => setKissesShortage(null)}
        />
      )}

      {/* Animazione rivelazione */}
      {risultato && (
        <PescaRevealAnimation
          allCards={risultato.allCards}
          chosenIndex={risultato.chosenIndex}
          isNewArr={risultato.isNewArr}
          waifuCat={waifuCat}
          onComplete={onRivelazioneFine}
        />
      )}

      {/* Modale selezione alla cieca — full-viewport, layout colonna 3+2 */}
      {selectedPack && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          paddingInline: 16,
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', flexShrink: 0, paddingBottom: 12 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 12, letterSpacing: 3, color: '#ff4d9e', marginBottom: 4 }}>
              PESCA ALLA CIECA
            </div>
            <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.45)', fontFamily: 'Fredoka' }}>
              Di {selectedPack.ownerName} — Scegli una carta senza sapere cosa c'è dentro
            </div>
          </div>

          {/* Carte in griglia 3+2 — uguale al feed */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {/* Riga 1: 3 carte (indici 0,1,2) */}
              <div style={{ display: 'flex', gap: 10 }}>
                {[0, 1, 2].map(uiIdx => (
                  <CardBack
                    key={uiIdx}
                    selected={selectedCardIndex === uiIdx}
                    onClick={() => setSelectedCardIndex(selectedCardIndex === uiIdx ? null : uiIdx)}
                    size="md"
                  />
                ))}
              </div>
              {/* Riga 2: 2 carte (indici 3,4) */}
              <div style={{ display: 'flex', gap: 10 }}>
                {[3, 4].map(uiIdx => (
                  <CardBack
                    key={uiIdx}
                    selected={selectedCardIndex === uiIdx}
                    onClick={() => setSelectedCardIndex(selectedCardIndex === uiIdx ? null : uiIdx)}
                    size="md"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer fisso */}
          <div style={{ flexShrink: 0, paddingTop: 12 }}>
            {selectedCardIndex !== null && (
              <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: '#ff4d9e', opacity: 0.8, textAlign: 'center', marginBottom: 10 }}>
                Carta {selectedCardIndex + 1} selezionata
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => { setSelectedPack(null); setSelectedCardIndex(null); setShuffledOrder([]); }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', fontSize: 9, padding: '12px 18px', cursor: 'pointer' }}
              >ANNULLA</button>
              <button
                onClick={confermaScelta}
                disabled={selectedCardIndex === null || busy}
                style={{
                  background: selectedCardIndex !== null ? 'rgba(255,77,158,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedCardIndex !== null ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 24, color: selectedCardIndex !== null ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
                  fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 1,
                  padding: '13px 22px', cursor: selectedCardIndex !== null && !busy ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                }}
              >
                <KissesIcon size={14} />
                {busy ? 'PESCA IN CORSO…' : `PESCA (${KISSES_COST} Kisses)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2 }}>
          CARICAMENTO…
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 16, color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {packs.map(pack => (
          <PescaPackCard
            key={pack.id}
            pack={pack}
            kissesCost={KISSES_COST}
            userKisses={kissesAttuali}
            collezione={collezione}
            onPesca={(p) => {
              if (p.alreadyFished) return;
              if (kissesAttuali < KISSES_COST) {
                setKissesShortage({ pendingPack: p });
              } else {
                aprePack(p);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
