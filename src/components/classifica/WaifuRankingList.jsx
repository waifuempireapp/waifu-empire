'use client';
import { useEffect, useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';
import { getCollezione } from '@/lib/firestoreService';

const RARITY_COLORS = {
  comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff',
  leggendario: '#ffc861', immersivo: '#ff7eb6',
};

function countdown(ms) {
  if (ms <= 0) return 'ora!';
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}g ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

const MEDAL = ['👑','🥈','🥉'];
const PRIZE_COLORS = ['#ffc861','#b0bec5','#cd7f32','#ec4899','#a855f7','#6cf0e0','#58e0a3','#f59e0b','#3b82f6','#ef4444'];
const PAGE_SIZE = 10;

export default function WaifuRankingList({ user }) {
  const [ranking, setRanking]     = useState(null);
  const [paused, setPaused]       = useState([]);
  const [subTab, setSubTab]       = useState('top5');
  const [collezione, setCollezione] = useState(null);
  const [hasHardPass, setHasHardPass] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(0); // paginazione top 50
  const now = Date.now();

  useEffect(() => {
    const load = async () => {
      try {
        const token = await user.getIdToken();
        const [rankRes, collData] = await Promise.all([
          fetch('/api/waifu-ranking/current', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          getCollezione(user.uid),
        ]);
        setRanking(rankRes.ranking);
        setPaused(rankRes.paused || []);
        setCollezione(collData);
        setHasHardPass(!!rankRes.hasHardPass);
        setIsLive(!!rankRes.isLive);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const owns = (waifuId) => !!(collezione?.waifu?.[waifuId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ height: 80, borderRadius: 14, background: 'rgba(255,255,255,0.04)', animation: `pulse 1.2s ease-in-out ${i*0.1}s infinite` }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tab */}
      <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 3, marginBottom: 16 }}>
        {[{ id: 'top5', label: '🏆 Top 50' }, { id: 'pausa', label: '⏸ In pausa' }].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: subTab === t.id ? 'rgba(255,133,182,0.2)' : 'transparent',
            color: subTab === t.id ? C.sakura : 'rgba(241,235,255,0.45)',
            fontFamily: FF.label, fontSize: 11, letterSpacing: '0.15em',
            fontWeight: subTab === t.id ? 700 : 500, textTransform: 'uppercase',
            transition: 'all 0.18s',
            boxShadow: subTab === t.id ? `0 0 12px rgba(255,133,182,0.15)` : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === 'top5' && (
        <>
          {!ranking ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 16,
              border: '1px dashed rgba(174,156,255,0.15)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🏆</div>
              <div style={{ fontFamily: FF.display, fontSize: 14, color: 'rgba(241,235,255,0.5)' }}>
                Classifica non ancora disponibile
              </div>
              <div style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.3)', marginTop: 6 }}>
                I voti della settimana vengono calcolati ogni domenica
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Header sezione */}
              <div style={{
                padding: '10px 16px', borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(255,133,182,0.08), rgba(167,139,250,0.05))',
                border: '1px solid rgba(255,133,182,0.15)',
                textAlign: 'center', marginBottom: 4,
              }}>
                <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', marginBottom: 4 }}>
                  ✦ Classifica Settimanale Waifu ✦
                  {isLive && <span style={{ marginLeft: 8, background: 'rgba(6,214,160,0.2)', border: '1px solid rgba(6,214,160,0.5)', borderRadius: 999, padding: '1px 6px', fontSize: 8, color: '#06d6a0' }}>● LIVE</span>}
                </div>
                <div style={{ fontFamily: FF.body, fontSize: 11, color: 'rgba(241,235,255,0.5)' }}>
                  Top 50 classifica · le Top 10 ricevono Kisses bonus ogni settimana
                </div>
              </div>

              {/* Paginazione */}
              {(ranking.top5 || []).length > PAGE_SIZE && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: page === 0 ? 'rgba(255,255,255,0.2)' : '#fff', padding: '6px 14px', cursor: page === 0 ? 'default' : 'pointer', fontFamily: FF.label, fontSize: 11 }}>← Prec</button>
                  <span style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(241,235,255,0.5)' }}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, (ranking.top5 || []).length)} di {(ranking.top5 || []).length}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= (ranking.top5 || []).length} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: (page + 1) * PAGE_SIZE >= (ranking.top5 || []).length ? 'rgba(255,255,255,0.2)' : '#fff', padding: '6px 14px', cursor: (page + 1) * PAGE_SIZE >= (ranking.top5 || []).length ? 'default' : 'pointer', fontFamily: FF.label, fontSize: 11 }}>Succ →</button>
                </div>
              )}

              {/* Top 50 paginati — Top 10 con premio */}
              {(ranking.top5 || []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item, j) => {
                const i = page * PAGE_SIZE + j; // indice globale
                const isOwned = owns(item.waifuId);
                const isPrize = i < 10; // Solo top 10 ricevono il premio
                const prizeColor = isPrize ? (PRIZE_COLORS[i] ?? PRIZE_COLORS[9]) : 'rgba(174,156,255,0.3)';
                const isTop3 = i < 3;
                const isHotObscured = item.hot && !hasHardPass;

                return (
                  <div key={item.waifuId} style={{
                    position: 'relative', borderRadius: 16, overflow: 'hidden',
                    background: isTop3
                      ? `linear-gradient(135deg, ${prizeColor}15, rgba(10,7,38,0.95))`
                      : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${prizeColor}${isTop3 ? '40' : isPrize ? '25' : '12'}`,
                    boxShadow: isTop3 ? `0 4px 20px ${prizeColor}20` : 'none',
                    padding: '14px 16px',
                    transition: 'all 0.2s',
                    opacity: isPrize ? 1 : 0.7,
                  }}>
                    {/* Shine per top 3 */}
                    {isTop3 && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                        background: `linear-gradient(90deg, transparent, ${prizeColor}60, transparent)`,
                        pointerEvents: 'none',
                      }} />
                    )}
                    {/* Separatore tra top 10 (con premio) e 11+ */}
                    {i === 10 && (
                      <div style={{ position: 'absolute', top: -8, left: 16, right: 16, textAlign: 'center' }}>
                        <span style={{ fontFamily: FF.label, fontSize: 7, color: 'rgba(174,156,255,0.4)', letterSpacing: '0.2em', background: 'rgba(10,7,38,0.9)', padding: '0 6px' }}>SENZA PREMIO</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Posizione */}
                      <div style={{ minWidth: 40, textAlign: 'center', flexShrink: 0 }}>
                        {i < 3 ? (
                          <div style={{ fontSize: 28, lineHeight: 1 }}>{MEDAL[i]}</div>
                        ) : (
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: `${prizeColor}18`,
                            border: `1px solid ${prizeColor}30`,
                            display: 'grid', placeItems: 'center',
                            fontFamily: FF.display, fontSize: 13, fontWeight: 800, color: prizeColor,
                          }}>{i + 1}</div>
                        )}
                      </div>

                      {/* Immagine waifu */}
                      {!isHotObscured && item.image && (
                        <div style={{ width: 44, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `1px solid ${prizeColor}40` }}>
                          <img src={item.image} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }} />
                        </div>
                      )}

                      {/* Info waifu */}
                      <div style={{ flex: 1, minWidth: 0, filter: isHotObscured ? 'blur(4px)' : 'none', userSelect: isHotObscured ? 'none' : 'auto' }}>
                        <div style={{
                          fontFamily: FF.display, fontSize: 14, fontWeight: 800,
                          color: isTop3 ? '#fff' : 'rgba(241,235,255,0.8)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 4,
                        }}>{isHotObscured ? '🔞 Solo Hard Pass' : item.nome}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontFamily: FF.mono, fontSize: 11, color: 'rgba(174,156,255,0.6)',
                          }}>♥ {item.likeCount.toLocaleString()}</span>
                          {isOwned && (
                            <span style={{
                              fontFamily: FF.label, fontSize: 8, letterSpacing: '0.15em',
                              color: '#58e0a3', background: 'rgba(88,224,163,0.12)',
                              border: '1px solid rgba(88,224,163,0.3)',
                              borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase',
                            }}>✓ Tua</span>
                          )}
                        </div>
                        {/* Rarità attuale + prossima */}
                        {item.rarita && (() => {
                          const RARITY_CHAIN = ['comune','raro','epico','leggendario','immersivo'];
                          const RARITY_COLORS = { comune:'#9ca3af', raro:'#3b82f6', epico:'#a855f7', leggendario:'#f59e0b', immersivo:'#ec4899' };
                          const RARITY_NAMES = { comune:'Comune', raro:'Raro', epico:'Epico', leggendario:'Leggendario', immersivo:'Immersivo' };
                          const currIdx = RARITY_CHAIN.indexOf(item.rarita);
                          const nextRarity = RARITY_CHAIN[currIdx + 1];
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ fontFamily: FF.label, fontSize: 8, color: RARITY_COLORS[item.rarita] ?? '#888', background: `${RARITY_COLORS[item.rarita] ?? '#888'}18`, border: `1px solid ${RARITY_COLORS[item.rarita] ?? '#888'}40`, borderRadius: 4, padding: '1px 6px' }}>
                                {RARITY_NAMES[item.rarita] ?? item.rarita}
                              </span>
                              {nextRarity && i < 10 && (
                                <>
                                  <span style={{ color: 'rgba(241,235,255,0.3)', fontSize: 8 }}>→</span>
                                  <span style={{ fontFamily: FF.label, fontSize: 8, color: RARITY_COLORS[nextRarity], background: `${RARITY_COLORS[nextRarity]}18`, border: `1px solid ${RARITY_COLORS[nextRarity]}40`, borderRadius: 4, padding: '1px 6px' }}>
                                    {RARITY_NAMES[nextRarity]}
                                  </span>
                                  <span style={{ fontFamily: FF.label, fontSize: 7, color: 'rgba(241,235,255,0.3)' }}>se vince</span>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Premio (solo top 5) */}
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        {isPrize ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                              <KissesIcon size={14} />
                              <span style={{ fontFamily: FF.display, fontSize: 16, fontWeight: 800, color: prizeColor }}>
                                {item.prize}
                              </span>
                            </div>
                            <div style={{ fontFamily: FF.label, fontSize: 7, color: 'rgba(241,235,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
                              premio
                            </div>
                          </>
                        ) : (
                          <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(174,156,255,0.3)', letterSpacing: '0.1em' }}>
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Call to action Swap */}
              <div style={{
                marginTop: 8, padding: '12px 16px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(255,133,182,0.06)', border: '1px dashed rgba(255,133,182,0.2)',
              }}>
                <div style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.5)', lineHeight: 1.5 }}>
                  Vota le waifu nella sezione <strong style={{ color: C.sakura }}>Swap</strong> per influenzare la classifica della prossima settimana!
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {subTab === 'pausa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paused.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(241,235,255,0.35)', fontFamily: FF.body, fontSize: 13 }}>
              Nessuna waifu attualmente in pausa.
            </div>
          ) : paused.map(p => (
            <div key={p.waifuId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(174,156,255,0.1)',
              borderRadius: 14, padding: '12px 14px',
            }}>
              <div>
                <div style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(174,156,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>
                  ⏸ Anti-monopolio
                </div>
                <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.7)' }}>{p.waifuId}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FF.mono, fontSize: 12, color: C.sakura }}>↩ {countdown(p.pausedUntilMs - now)}</div>
                <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(241,235,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>al rientro</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
