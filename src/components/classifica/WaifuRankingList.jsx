'use client';
import { useEffect, useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';
import { getCollezione } from '@/lib/firestoreService';

const MEDAL = ['🥇', '🥈', '🥉', '4', '5'];

function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}g ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function WaifuRankingList({ user }) {
  const [ranking, setRanking] = useState(null);
  const [paused, setPaused] = useState([]);
  const [subTab, setSubTab] = useState('top5');
  const [collezione, setCollezione] = useState(null);
  const [loading, setLoading] = useState(true);
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
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const owns = (waifuId) => !!(collezione?.waifu?.[waifuId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'rgba(241,235,255,0.3)', fontFamily: FF.label, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Caricamento…</div>;
  }

  return (
    <div>
      {/* Sub-tab Top 5 / In pausa */}
      <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
        {[{ id: 'top5', label: 'Top 5 Settimana' }, { id: 'pausa', label: 'In pausa' }].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: subTab === t.id ? 'rgba(255,133,182,0.2)' : 'transparent',
            color: subTab === t.id ? C.sakura : 'rgba(241,235,255,0.4)',
            fontFamily: FF.label, fontSize: 10, letterSpacing: '0.15em',
            textTransform: 'uppercase', transition: 'all 0.18s',
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === 'top5' && (
        <>
          {!ranking ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(241,235,255,0.35)', fontFamily: FF.body, fontSize: 13 }}>
              Classifica non ancora disponibile per questa settimana.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(ranking.top5 || []).map((item, i) => (
                <div key={item.waifuId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${owns(item.waifuId) ? 'rgba(88,224,163,0.3)' : 'rgba(174,156,255,0.1)'}`,
                  borderRadius: 14, padding: '12px 14px',
                  boxShadow: owns(item.waifuId) ? '0 0 16px rgba(88,224,163,0.08)' : 'none',
                }}>
                  <span style={{ fontSize: 22, minWidth: 28 }}>{MEDAL[i] || `${i + 1}`}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FF.display, fontSize: 14, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.nome}
                    </div>
                    <div style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.4)', marginTop: 2 }}>
                      ♥ {item.likeCount} like
                    </div>
                  </div>
                  {owns(item.waifuId) && (
                    <span style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.15em', color: C.ok, textTransform: 'uppercase', background: 'rgba(88,224,163,0.12)', border: '1px solid rgba(88,224,163,0.3)', borderRadius: 6, padding: '3px 8px' }}>
                      ✓ Posseduta
                    </span>
                  )}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <KissesIcon size={13} />
                      <span style={{ fontFamily: FF.display, fontSize: 13, color: C.gold, fontWeight: 700 }}>{item.prize}</span>
                    </div>
                    <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(241,235,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>Premio</div>
                  </div>
                </div>
              ))}
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
                <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.7)' }}>{p.waifuId}</div>
                <div style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(174,156,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
                  In pausa anti-monopolio
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FF.mono, fontSize: 11, color: C.sakura }}>
                  ↩ {countdown(p.pausedUntilMs - now)}
                </div>
                <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(241,235,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>
                  al rientro
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
