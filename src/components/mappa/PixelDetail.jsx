'use client';
import { C, FF } from '@/app/gioco/_redesign/_shared';

// Calcolo prezzo pixel (deve combaciare con la formula server-side)
function pixelPrice(ownerLevel = 1) {
  return 200 + ownerLevel * 50;
}

export default function PixelDetail({ pixel, userUid, waifuCat, onAttack, onPurchase, onEditDefense, onClose }) {
  if (!pixel) return null;

  const isOwn    = pixel.ownerId === userUid;
  const isCPU    = pixel.ownerId === 'CPU';
  const price    = pixelPrice(pixel.ownerLevel ?? 1);

  const defenseTeam   = pixel.defenseTeam || [];
  const defenseWaifu  = defenseTeam
    .map(id => waifuCat?.find(w => w.id === id))
    .filter(Boolean);

  return (
    <>
      {/* Overlay scuro cliccabile per chiudere */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(3,2,12,0.6)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal centrato sopra la navbar */}
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
        padding: '24px 22px',
        boxShadow: '0 24px 60px rgba(3,2,12,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset',
        animation: 'fadeUp 0.22s ease-out',
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>

        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          background: 'none', border: 'none',
          color: 'rgba(241,235,255,0.35)', fontSize: 20, cursor: 'pointer', padding: 0,
        }}>✕</button>

        {/* Proprietario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: pixel.ownerColor || '#888888',
            border: '2px solid rgba(255,255,255,0.15)',
          }} />
          <div>
            <div style={{ fontFamily: FF.label, fontSize: 13, letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase', fontWeight: 700 }}>
              {pixel.ownerName || 'CPU'}
            </div>
            <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
              pixel ({pixel.x}, {pixel.y}) {isOwn && '· tuo territorio'}
            </div>
          </div>
        </div>

        {/* Team difensore */}
        {defenseWaifu.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(174,156,255,0.55)', textTransform: 'uppercase', marginBottom: 8 }}>
              Team difensore
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {defenseWaifu.map((w, i) => (
                <div key={i} style={{
                  width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                  border: '1px solid rgba(174,156,255,0.2)',
                  background: 'rgba(255,255,255,0.04)',
                }}>
                  {w.asset_immagine && (
                    <img src={w.asset_immagine} alt={w.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, 5 - defenseWaifu.length) }).map((_, i) => (
                <div key={`e-${i}`} style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(174,156,255,0.12)',
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 10 }}>
          {isOwn ? (
            <button onClick={onEditDefense} style={actionBtn(C.violet, 'rgba(167,139,250,0.12)')}>
              ⚔ Modifica Difesa
            </button>
          ) : (
            <>
              <button onClick={onAttack} style={actionBtn(C.sakura, 'rgba(255,133,182,0.12)')}>
                ⚔ Attacca
              </button>
              <button onClick={() => onPurchase?.({ price })} style={actionBtn(C.gold, 'rgba(245,197,96,0.12)')}>
                💋 {isCPU ? `${price}K` : 'Offri'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function actionBtn(color, bg) {
  return {
    flex: 1, padding: '13px 8px',
    background: bg, border: `1px solid ${color}55`,
    borderRadius: 12, color, fontFamily: FF.label,
    fontSize: 12, letterSpacing: '0.18em',
    textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
  };
}
