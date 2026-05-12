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

function MiniCartaSelezionabile({ carta, selected, onClick }) {
  const colore = RARITA_COLORI[carta?.rarita] || '#9e9e9e';
  return (
    <div
      onClick={onClick}
      style={{
        width: 64, height: 88, borderRadius: 8, flexShrink: 0,
        border: `2px solid ${selected ? colore : 'rgba(255,255,255,0.15)'}`,
        background: selected ? `linear-gradient(135deg, ${colore}22, ${colore}11)` : 'rgba(6,3,15,0.9)',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.1) translateY(-4px)' : 'scale(1)',
        boxShadow: selected ? `0 0 16px ${colore}70` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {carta?.immagine ? (
        <img src={carta.immagine} alt={carta.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
      ) : (
        <div style={{ fontSize: 22, color: colore }}>{carta?.tipo === 'waifu' ? '◈' : carta?.tipo === 'outfit' ? '✦' : '✿'}</div>
      )}
    </div>
  );
}

export default function PescaMisteriosaFeed({ user, profilo, onKissesSpent }) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [risultato, setRisultato] = useState(null); // { allCards, chosenIndex }
  const [notif, setNotif] = useState(null);

  const caricaFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/pesca/feed', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento feed');
      setPacks(data.packs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { caricaFeed(); }, [caricaFeed]);

  const mostraNotif = (testo, colore = '#ff4d9e') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2500);
  };

  const apriModale = (pack) => {
    setSelectedPack(pack);
    setSelectedCardIndex(null);
  };

  const confermaScelta = async () => {
    if (selectedCardIndex === null || !selectedPack || busy) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const body = {
        snapshotId: selectedPack.id,
        chosenCardIndex: selectedCardIndex,
      };
      if (selectedPack.isGhost) body.ghostCards = selectedPack.cards;
      const res = await fetch('/api/pesca/fish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore pesca');
      setSelectedPack(null);
      setRisultato({ allCards: data.allCards, chosenIndex: selectedCardIndex });
      onKissesSpent?.(KISSES_COST);
    } catch (e) {
      mostraNotif(e.message, '#ff4d4d');
    } finally {
      setBusy(false);
    }
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
          boxShadow: `0 0 24px ${notif.colore}40`,
        }}>{notif.testo}</div>
      )}

      {risultato && (
        <PescaRevealAnimation
          allCards={risultato.allCards}
          chosenIndex={risultato.chosenIndex}
          onComplete={onRivelazioneFine}
        />
      )}

      {/* Modale selezione carta */}
      {selectedPack && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(6,3,15,0.96)', backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 20, gap: 20,
        }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 12, letterSpacing: 3, color: '#ff4d9e' }}>
            SCEGLI UNA CARTA
          </div>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.5)', fontFamily: 'Fredoka' }}>
            Di {selectedPack.ownerName}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(selectedPack.cards || []).map((carta, i) => (
              <MiniCartaSelezionabile
                key={i}
                carta={carta}
                selected={selectedCardIndex === i}
                onClick={() => setSelectedCardIndex(selectedCardIndex === i ? null : i)}
              />
            ))}
          </div>
          {selectedCardIndex !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: '#eedcd4', marginBottom: 8 }}>
                {selectedPack.cards[selectedCardIndex]?.nome}
                <span style={{ fontSize: 10, color: RARITA_COLORI[selectedPack.cards[selectedCardIndex]?.rarita], marginLeft: 8 }}>
                  [{selectedPack.cards[selectedCardIndex]?.rarita}]
                </span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setSelectedPack(null); setSelectedCardIndex(null); }}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, color: 'rgba(238,232,220,0.5)',
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
              }}
            >
              <KissesIcon size={13} />
              {busy ? 'PESCA IN CORSO…' : `PESCA (${KISSES_COST} Kisses)`}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 900, color: '#ff4d9e', letterSpacing: 2 }}>
          🎣 PESCA MISTERIOSA
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ff4d9e', fontFamily: 'Orbitron' }}>
          <KissesIcon size={12} />
          {kissesAttuali}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', fontSize: 10 }}>
          Caricamento…
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 20, color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 10 }}>
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
            onPesca={apriModale}
          />
        ))}
      </div>
    </div>
  );
}
