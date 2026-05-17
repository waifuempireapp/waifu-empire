'use client';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import { PIXEL_NAMES } from '@/lib/worldMap';

function pixelPrice(ownerLevel = 1) {
  return 200 + ownerLevel * 50;
}

// Mini-icona waifu per il team difensore
function MiniDefenderIcon({ waifu, size = 40 }) {
  if (!waifu) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(174,156,255,0.12)',
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      overflow: 'hidden', border: '1px solid rgba(174,156,255,0.2)',
      background: '#12102a',
    }}>
      {waifu.asset_immagine && (
        <img src={waifu.asset_immagine} alt={waifu.nome}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
      )}
    </div>
  );
}

export default function PixelDetail({
  pixel, userUid, waifuCat,
  myDefenseTeam,     // array di 5 waifuId (propri, da defense_config)
  onAttack, onPurchase, onEditDefense, onClose,
}) {
  if (!pixel) return null;

  const isOwn   = pixel.ownerId === userUid;
  const isCPU   = pixel.ownerId === 'CPU';
  const price    = pixel.buyPrice ?? pixelPrice(pixel.ownerLevel ?? 1);
  const pixelKey = `${pixel.x}_${pixel.y}`;
  const pixelName = pixel.name || PIXEL_NAMES[pixelKey] || `(${pixel.x}, ${pixel.y})`;

  // Motivi per cui non si può attaccare/comprare
  const isAdj = pixel.isAdjacentToEmpire !== false; // default true se non calcolato
  const canAfford = pixel.canAffordBuy !== false;
  let attackBlockReason = null;
  if (!isAdj) attackBlockReason = 'Non adiacente al tuo impero';
  let buyBlockReason = null;
  if (!isAdj) buyBlockReason = 'Non adiacente al tuo impero';
  else if (!canAfford) buyBlockReason = `Kisses insufficienti (servono ${price})`;

  // Team difensore da visualizzare:
  // - proprio pixel → myDefenseTeam (già caricato da MappaPixel)
  // - pixel avversario → pixel.defenderTeam (caricato async da handlePixelSelect)
  const defIds = isOwn
    ? (myDefenseTeam || [])
    : (pixel.defenderTeam || []);

  const defenseWaifu = defIds
    .map(id => waifuCat?.find(w => w.id === id))
    .filter(Boolean);

  const iconSize = 38;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(3,2,12,0.6)', backdropFilter: 'blur(4px)',
      }} />

      {/* Modal centrato */}
      <div style={{
        position: 'fixed',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 120,
        width: 'min(92vw, 380px)',
        background: 'rgba(13,10,38,0.98)',
        backdropFilter: 'blur(20px)',
        border: `1px solid rgba(174,156,255,0.25)`,
        borderRadius: 20,
        padding: '22px 20px',
        boxShadow: '0 24px 60px rgba(3,2,12,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset',
        animation: 'fadeUp 0.22s ease-out',
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>

        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          background: 'none', border: 'none',
          color: 'rgba(241,235,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0,
        }}>✕</button>

        {/* Proprietario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: pixel.ownerColor || '#888888',
            border: '2px solid rgba(255,255,255,0.15)',
          }} />
          <div>
            <div style={{ fontFamily: FF.label, fontSize: 13, letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase', fontWeight: 700 }}>
              {pixel.ownerName || 'CPU'}
              {isOwn && <span style={{ color: C.aqua, marginLeft: 8, fontSize: 10 }}>· tuo</span>}
            </div>
            <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
              {pixelName}
            </div>
          </div>
        </div>

        {/* Team difensore */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(174,156,255,0.55)', textTransform: 'uppercase', marginBottom: 8 }}>
            {isCPU ? 'Difensore' : isOwn ? 'Il tuo team difensore' : 'Team difensore'}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {isCPU ? (
              // CPU: icone segnaposto
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  width: iconSize, height: iconSize, borderRadius: 8,
                  background: 'rgba(136,136,136,0.15)', border: '1px solid rgba(136,136,136,0.2)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <span style={{ fontSize: 16, opacity: 0.3 }}>?</span>
                </div>
              ))
            ) : defenseWaifu.length > 0 ? (
              <>
                {defenseWaifu.map((w, i) => (
                  <MiniDefenderIcon key={i} waifu={w} size={iconSize} />
                ))}
                {Array.from({ length: Math.max(0, 5 - defenseWaifu.length) }).map((_, i) => (
                  <MiniDefenderIcon key={`e${i}`} waifu={null} size={iconSize} />
                ))}
              </>
            ) : (
              // Nessun team configurato (in caricamento o non impostato)
              <div style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.3)', paddingTop: 4 }}>
                {isOwn ? 'Nessun team difensore impostato' : 'Caricamento team…'}
              </div>
            )}
          </div>
        </div>

        {/* Messaggi di blocco */}
        {!isOwn && (attackBlockReason || buyBlockReason) && (
          <div style={{
            marginBottom: 12, padding: '8px 12px',
            background: 'rgba(255,91,108,0.08)', border: '1px solid rgba(255,91,108,0.2)',
            borderRadius: 10, fontFamily: FF.body, fontSize: 11, color: 'rgba(255,91,108,0.9)',
            lineHeight: 1.4,
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
              >
                ⚔ Attacca
              </button>
              <button
                onClick={!buyBlockReason ? () => onPurchase?.({ price }) : undefined}
                disabled={!!buyBlockReason}
                style={actionBtn(C.gold, 'rgba(245,197,96,0.12)', !!buyBlockReason)}
              >
                💋 {isCPU ? `${price}K` : 'Offri'}
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
    borderRadius: 12,
    color: disabled ? 'rgba(241,235,255,0.25)' : color,
    fontFamily: FF.label, fontSize: 12, letterSpacing: '0.18em',
    textTransform: 'uppercase', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
