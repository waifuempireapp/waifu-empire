'use client';
import { useState, useEffect, useCallback } from 'react';
import PescaPackCard from './PescaPackCard';
import PescaRevealAnimation from './PescaRevealAnimation';
import KissesIcon from './KissesIcon';

const KISSES_COST = 10;

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 4,
        boxShadow: selected
          ? '0 0 20px rgba(255,77,158,0.6), 0 0 8px rgba(255,77,158,0.3)'
          : '0 2px 12px rgba(0,0,0,0.5)',
        transform: selected ? 'scale(1.1) translateY(-6px)' : 'scale(1)',
        transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        position: 'relative', overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Bordo interno decorativo */}
      <div style={{
        position: 'absolute', inset: 4,
        border: `1px solid ${selected ? 'rgba(255,77,158,0.4)' : 'rgba(245,166,35,0.15)'}`,
        borderRadius: 5,
        transition: 'border-color 0.2s',
      }} />
      {/* Pattern diagonale */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(245,166,35,0.03) 6px, rgba(245,166,35,0.03) 7px)',
      }} />
      {/* Simbolo centrale */}
      <span style={{
        fontSize: size === 'md' ? 26 : 20,
        color: selected ? '#ff4d9e' : 'rgba(245,166,35,0.55)',
        filter: selected ? 'drop-shadow(0 0 10px rgba(255,77,158,0.9))' : 'none',
        transition: 'all 0.2s', zIndex: 1,
      }}>♛</span>
      {selected && (
        <div style={{
          fontSize: 7, fontFamily: 'Orbitron', letterSpacing: 1,
          color: '#ff4d9e', zIndex: 1,
        }}>SCELTA</div>
      )}
    </div>
  );
}

// Carta recto (usata nella PescaRevealAnimation)
function CardFront({ carta }) {
  const colore = RARITA_COLORI[carta?.rarita] || '#9e9e9e';
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(135deg, ${colore}22, rgba(6,3,15,0.95))`,
      border: `2px solid ${colore}`,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {carta?.immagine ? (
        <img src={carta.immagine} alt={carta.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: 22, color: colore }}>
          {carta?.tipo === 'waifu' ? '◈' : carta?.tipo === 'outfit' ? '✦' : '✿'}
        </span>
      )}
    </div>
  );
}

export default function PescaMisteriosaFeed({ user, profilo, onKissesSpent }) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);  // pack aperto nel modale
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [risultato, setRisultato] = useState(null); // { allCards, chosenIndex }
  const [notif, setNotif] = useState(null);

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

  useEffect(() => { caricaFeed(); }, [caricaFeed]);

  const mostraNotif = (testo, colore = '#ff4d9e') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2500);
  };

  const confermaScelta = async () => {
    if (selectedCardIndex === null || !selectedPack || busy) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const body = { snapshotId: selectedPack.id, chosenCardIndex: selectedCardIndex };
      if (selectedPack.isGhost) body.ghostCards = selectedPack.cards;
      const res = await fetch('/api/pesca/fish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore pesca');
      const pack = selectedPack;
      setSelectedPack(null);
      setSelectedCardIndex(null);
      setRisultato({ allCards: data.allCards, chosenIndex: selectedCardIndex });
      onKissesSpent?.(KISSES_COST);
    } catch (e) {
      mostraNotif(e.message, '#ff4d4d');
    } finally { setBusy(false); }
  };

  const onRivelazioneFine = () => {
    setRisultato(null);
    caricaFeed();
    mostraNotif('Carta aggiunta alla collezione!', '#00e676');
  };

  const kissesAttuali = profilo?.kisses ?? 0;

  return (
    <div style={{ position: 'relative' }}>
      {notif && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(12px)',
          border: `1px solid ${notif.colore}80`, color: notif.colore,
          padding: '10px 24px', borderRadius: 10,
          fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 11, zIndex: 500,
        }}>{notif.testo}</div>
      )}

      {/* Animazione rivelazione */}
      {risultato && (
        <PescaRevealAnimation
          allCards={risultato.allCards}
          chosenIndex={risultato.chosenIndex}
          onComplete={onRivelazioneFine}
        />
      )}

      {/* Modale selezione alla cieca */}
      {selectedPack && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 20, gap: 20,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 13, letterSpacing: 3, color: '#ff4d9e', marginBottom: 6 }}>
              PESCA ALLA CIECA
            </div>
            <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.45)', fontFamily: 'Fredoka' }}>
              Di {selectedPack.ownerName} — Scegli una carta senza sapere cosa c'è dentro
            </div>
          </div>

          {/* 5 carte a faccia in giù */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(selectedPack.cards || []).map((_, i) => (
              <CardBack
                key={i}
                selected={selectedCardIndex === i}
                onClick={() => setSelectedCardIndex(selectedCardIndex === i ? null : i)}
                size="md"
              />
            ))}
          </div>

          {selectedCardIndex !== null && (
            <div style={{
              fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2,
              color: '#ff4d9e', opacity: 0.8,
            }}>
              Carta {selectedCardIndex + 1} selezionata
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setSelectedPack(null); setSelectedCardIndex(null); }}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, color: 'rgba(238,232,220,0.45)',
                fontFamily: 'Orbitron', fontSize: 9, padding: '10px 18px', cursor: 'pointer',
              }}
            >ANNULLA</button>
            <button
              onClick={confermaScelta}
              disabled={selectedCardIndex === null || busy}
              style={{
                background: selectedCardIndex !== null ? 'rgba(255,77,158,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedCardIndex !== null ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8,
                color: selectedCardIndex !== null ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
                fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 1,
                padding: '10px 18px', cursor: selectedCardIndex !== null && !busy ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <KissesIcon size={13} />
              {busy ? 'PESCA IN CORSO…' : `PESCA (${KISSES_COST} Kisses)`}
            </button>
          </div>
        </div>
      )}

      {/* Header feed */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 900, color: '#ff4d9e', letterSpacing: 2 }}>
          🎣 PESCA MISTERIOSA
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ff4d9e', fontFamily: 'Orbitron' }}>
          <KissesIcon size={12} /> {kissesAttuali}
        </div>
      </div>

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
            onPesca={(p) => { setSelectedPack(p); setSelectedCardIndex(null); }}
          />
        ))}
      </div>
    </div>
  );
}
