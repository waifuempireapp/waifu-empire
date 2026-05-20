'use client';
import { useState, useEffect } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { PIXEL_NAMES } from '@/lib/worldMap';
import KissesIcon from '@/components/KissesIcon';

function pixelPrice(ownerLevel = 1) { return 200 + ownerLevel * 50; }

// Card waifu difensore — più grande, forma carta, layout 3+2
function DefenderCard({ waifu, size = 72, isCpuSlot = false, blurred = false }) {
  const imgSrc = waifu ? (waifu.asset_immagine || waifu.asset_statica || waifu.asset_immersiva) : null;
  return (
    <div style={{
      width: size, flexShrink: 0,
      borderRadius: 10, overflow: 'hidden',
      border: `1px solid ${waifu ? (waifu.hot ? 'rgba(255,133,182,0.4)' : 'rgba(174,156,255,0.25)') : 'rgba(174,156,255,0.1)'}`,
      background: '#12102a', aspectRatio: '3/4',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Immagine */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isCpuSlot ? (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'rgba(136,136,136,0.1)' }}>
            <span style={{ fontSize: 20, opacity: 0.3 }}>?</span>
          </div>
        ) : imgSrc ? (
          <>
            <img src={imgSrc} alt={waifu.nome}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
                filter: blurred ? 'blur(6px)' : 'none' }} />
            {blurred && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'rgba(3,2,12,0.4)',
              }}>
                <span style={{ fontSize: 12 }}>🔥</span>
                <span style={{ fontFamily: "'Saira Condensed',sans-serif", fontSize: 7, color: '#ff85b6', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>HOT{'\n'}Pass Hard</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'rgba(174,156,255,0.05)', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 18, opacity: 0.2 }}>♛</span>
          </div>
        )}
      </div>
      {/* Nome */}
      {waifu && !isCpuSlot && (
        <div style={{
          padding: '2px 4px', background: 'rgba(3,2,12,0.8)',
          fontFamily: FF.body, fontSize: 7, color: 'rgba(241,235,255,0.7)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
        }}>{waifu.nome}</div>
      )}
    </div>
  );
}

function MissionCountdown({ endsAt }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endsAt - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '0 0 14px',
      padding: '8px 12px',
      background: 'rgba(232,121,249,0.08)',
      border: '1px solid rgba(232,121,249,0.3)',
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 14 }}>🎯</span>
      <div>
        <div style={{ fontFamily: "'Saira Condensed',sans-serif", fontSize: 11, color: '#e879f9', fontWeight: 700, letterSpacing: '0.06em' }}>
          Territorio Missione Mappa
        </div>
        <div style={{ fontFamily: "'Saira Condensed',sans-serif", fontSize: 10, color: 'rgba(232,121,249,0.65)', fontVariantNumeric: 'tabular-nums' }}>
          Possiederlo vale +100 💋 · scade tra {label}
        </div>
      </div>
    </div>
  );
}

export default function PixelDetail({
  pixel, userUid, waifuCat,
  myDefenseTeam,
  hasHardPass,       // profilo?.hardPass — per blur waifu hot
  missionEndsAt,     // ms timestamp se questo pixel è nella missione mappa corrente
  onAttack, onPurchase, onEditDefense, onClose,
}) {
  if (!pixel) return null;

  const isOwn   = pixel.ownerId === userUid;
  const isCPU   = pixel.ownerId === 'CPU';
  const price   = pixel.buyPrice ?? pixelPrice(pixel.ownerLevel ?? 1);
  const pixelKey = `${pixel.x}_${pixel.y}`;
  const pixelName = pixel.name || PIXEL_NAMES[pixelKey] || `(${pixel.x}, ${pixel.y})`;

  const isAdj    = pixel.isAdjacentToEmpire !== false;
  const canAfford = pixel.canAffordBuy !== false;
  let attackBlockReason = null;
  if (!isAdj) attackBlockReason = 'Non adiacente al tuo impero';
  let buyBlockReason = null;
  if (!isAdj) buyBlockReason = 'Non adiacente al tuo impero';
  else if (!canAfford) buyBlockReason = `Kisses insufficienti (servono ${price})`;

  const defIds = isOwn
    ? (myDefenseTeam || [])
    : (pixel.defenderTeam || []);
  const defenseWaifu = defIds.map(id => waifuCat?.find(w => w.id === id)).filter(Boolean);

  // Funzione per decidere se una waifu va blurrata (hot + no pass hard)
  const shouldBlur = (w) => w?.hot === true && !hasHardPass;

  // Layout card 3+2: prima riga 3 waifu, seconda riga 2 centrate
  const cardSize = 62;
  const row1 = isCPU ? [null,null,null] : (defenseWaifu.length > 0 ? defenseWaifu.slice(0,3) : []);
  const row2 = isCPU ? [null,null] : (defenseWaifu.length > 0 ? defenseWaifu.slice(3,5) : []);
  // Riempi con slot vuoti
  while (row1.length < 3) row1.push(undefined);
  while (row2.length < 2) row2.push(undefined);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(3,2,12,0.6)', backdropFilter: 'blur(4px)',
      }} />

      <div style={{
        position: 'fixed', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 120,
        width: 'min(92vw, 380px)',
        background: 'rgba(13,10,38,0.98)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(174,156,255,0.25)', borderRadius: 20,
        padding: '22px 20px',
        boxShadow: '0 24px 60px rgba(3,2,12,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset',
        animation: 'fadeUp 0.22s ease-out', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>

        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          background: 'none', border: 'none', color: 'rgba(241,235,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0,
        }}>✕</button>

        {/* Proprietario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: pixel.ownerColor || '#888888', border: '2px solid rgba(255,255,255,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: FF.label, fontSize: 13, letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase', fontWeight: 700 }}>
                {pixel.ownerName || 'CPU'}
                {isOwn && <span style={{ color: C.aqua, marginLeft: 8, fontSize: 10 }}>· tuo</span>}
              </div>
              {pixel.difficulty && (() => {
                const diffStyle = { easy: ['#06d6a0','Easy'], medium: ['#f59e0b','Medium'], hard: ['#ef4444','Hard'], extreme: ['#a855f7','Extreme'] }[pixel.difficulty] ?? ['#9b59ff','?'];
                return (
                  <div style={{ background: `${diffStyle[0]}20`, border: `1px solid ${diffStyle[0]}60`, borderRadius: 6, padding: '2px 8px', fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: diffStyle[0], fontWeight: 700 }}>
                    {diffStyle[1]}
                  </div>
                );
              })()}
            </div>
            <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>{pixelName}</div>
          </div>
        </div>

        {/* Badge missione mappa */}
        {missionEndsAt && <MissionCountdown endsAt={missionEndsAt} />}

        {/* Team difensore — layout 3+2 card */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(174,156,255,0.55)', textTransform: 'uppercase', marginBottom: 8 }}>
            {isCPU ? 'Team difensore CPU' : isOwn ? 'Il tuo team difensore' : 'Team difensore'}
          </div>

          {/* Nota CPU: team nascosto */}
          {isCPU && (
            <div style={{
              marginBottom: 10, padding: '7px 10px',
              background: 'rgba(174,156,255,0.06)', border: '1px solid rgba(174,156,255,0.15)',
              borderRadius: 8, fontFamily: FF.body, fontSize: 11, color: 'rgba(174,156,255,0.7)', lineHeight: 1.4,
            }}>
              🔍 Il team è nascosto! Sfida la CPU per scoprire quali waifu ti aspettano.
            </div>
          )}

          {(isCPU || defenseWaifu.length > 0) ? (
            <>
              {/* Riga 1: 3 card */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
                {row1.map((w, i) => (
                  <DefenderCard key={i} waifu={w || null} size={cardSize} isCpuSlot={isCPU} blurred={!isCPU && !!w && shouldBlur(w)} />
                ))}
              </div>
              {/* Riga 2: 2 card centrate */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {row2.map((w, i) => (
                  <DefenderCard key={i} waifu={w || null} size={cardSize} isCpuSlot={isCPU} blurred={!isCPU && !!w && shouldBlur(w)} />
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.3)', paddingTop: 4 }}>
              {isOwn ? 'Nessun team difensore impostato' : 'Caricamento team…'}
            </div>
          )}
        </div>

        {/* Titolo sezione azioni */}
        {!isOwn && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: FF.label, fontSize: 11, letterSpacing: '0.2em', color: 'rgba(241,235,255,0.7)', textTransform: 'uppercase', marginBottom: 4 }}>
              Cosa vuoi fare con questo territorio?
            </div>
            <div style={{ fontFamily: FF.body, fontSize: 11, color: 'rgba(241,235,255,0.45)', lineHeight: 1.5 }}>
              {isCPU
                ? <>⚔ Attacca per conquistarlo con le tue waifu<br/>🩷 Compra pagando Kisses per averlo subito</>
                : <>⚔ Sfida il team difensore in una lotta alla meglio di 3<br/>🩷 Fai un'offerta in Kisses al proprietario</>}
            </div>
          </div>
        )}

        {/* Blocco motivo */}
        {!isOwn && (attackBlockReason || buyBlockReason) && (
          <div style={{
            marginBottom: 12, padding: '8px 12px',
            background: 'rgba(255,91,108,0.08)', border: '1px solid rgba(255,91,108,0.2)',
            borderRadius: 10, fontFamily: FF.body, fontSize: 11, color: 'rgba(255,91,108,0.9)', lineHeight: 1.4,
          }}>
            ⚠️ {attackBlockReason || buyBlockReason}
          </div>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 10 }}>
          {isOwn ? (
            <button onClick={onEditDefense} style={actionBtn(C.violet, 'rgba(167,139,250,0.12)', false)}>
              ⚔ Modifica Difesa
            </button>
          ) : (
            <>
              <button
                onClick={!attackBlockReason ? onAttack : undefined}
                disabled={!!attackBlockReason}
                style={actionBtn(C.sakura, 'rgba(255,133,182,0.12)', !!attackBlockReason)}
              >⚔ Attacca</button>
              <button
                onClick={!buyBlockReason ? () => onPurchase?.({ price }) : undefined}
                disabled={!!buyBlockReason}
                style={actionBtn(C.gold, 'rgba(245,197,96,0.12)', !!buyBlockReason)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                  <KissesIcon size={14} />
                  {isCPU ? `Compra ${price}` : 'Offri'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function actionBtn(color, bg, disabled = false) {
  return {
    flex: 1, padding: '13px 8px',
    background: disabled ? 'rgba(255,255,255,0.04)' : bg,
    border: `1px solid ${disabled ? 'rgba(174,156,255,0.1)' : color + '55'}`,
    borderRadius: 12, color: disabled ? 'rgba(241,235,255,0.25)' : color,
    fontFamily: FF.label, fontSize: 12, letterSpacing: '0.18em',
    textTransform: 'uppercase', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
