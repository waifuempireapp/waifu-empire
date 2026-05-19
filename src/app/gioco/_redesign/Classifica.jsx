// src/app/gioco/_redesign/Classifica.jsx
'use client';
import React, { useEffect, useState } from 'react';
import { getClassifica, premioPerPosizione } from '@/lib/firestoreService';
import { Chip, PannelloOrnato } from '@/components/ui/UIKit';
import { C, FF, ScreenTitle } from './_shared';
import WaifuRankingList from '@/components/classifica/WaifuRankingList';

// Card premio riutilizzabile per le due righe
function PremioBox({ p }) {
  return (
    <div style={{
      flex: 1,
      background: `${p.col}10`, border: `1px solid ${p.col}45`,
      borderRadius: 11, padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: p.col, fontWeight: 700, fontFamily: FF.label, letterSpacing: '0.12em' }}>{p.label}</div>
      <div style={{ fontSize: 18, color: '#fff', fontFamily: FF.mono, fontWeight: 800, marginTop: 2, textShadow: `0 0 8px ${p.col}55` }}>{p.pack}</div>
      <div style={{ fontSize: 8, color: 'rgba(241,235,255,0.45)', fontFamily: FF.label, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>🎴 PREMIO</div>
    </div>
  );
}

export function ClassificaTab({ user }) {
  const [subTab, setSubTab] = useState('giocatori');
  const [classifica, setClassifica] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    getClassifica(200)
      .then(d => { setClassifica(d); setLoading(false); })
      .catch(e => { setErrore(e.message); setLoading(false); });
  }, []);

  const mioIndice = user ? classifica.findIndex(u => u.id === user.uid) : -1;

  const prossimoLunedi = (() => {
    const ora = new Date();
    const giorno = ora.getDay();
    const diff = (8 - giorno) % 7 || 7;
    const lun = new Date(ora);
    lun.setDate(ora.getDate() + diff);
    lun.setHours(0, 0, 0, 0);
    const diffMs = lun - ora;
    const giorni = Math.floor(diffMs / 86400000);
    const ore = Math.floor((diffMs % 86400000) / 3600000);
    const min = Math.floor((diffMs % 3600000) / 60000);
    return giorni > 0 ? `${giorni}d ${ore}h ${min}m` : `${ore}h ${min}m`;
  })();

  const podiumColors = [C.gold, '#cfd8e3', '#ff9b6b'];

  return (
    <div className="fade-in" style={{ paddingTop: 14 }}>
      {/* Tab bar Giocatori / Waifu */}
      <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 3, marginBottom: 20 }}>
        {[{ id: 'giocatori', label: 'Giocatori' }, { id: 'waifu', label: 'Classifica Waifu' }].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: subTab === t.id ? 'rgba(245,197,96,0.18)' : 'transparent',
            color: subTab === t.id ? C.goldL : 'rgba(241,235,255,0.45)',
            fontFamily: FF.label, fontSize: 11, letterSpacing: '0.15em', fontWeight: subTab === t.id ? 700 : 500,
            textTransform: 'uppercase', transition: 'all 0.18s',
            boxShadow: subTab === t.id ? '0 0 12px rgba(245,197,96,0.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === 'waifu' && <WaifuRankingList user={user} />}
      {subTab === 'giocatori' && <>

      <div style={{ textAlign: 'center' }}>
        <ScreenTitle
          kicker={`Stagione 7 · reset in ${prossimoLunedi}`}
          title={<span className="shimmer-text">Classifica Globale</span>}
          sub="Conquista più territori, sali di livello mappa, vinci più premi."
          color={C.goldL}
        />
      </div>

      {/* Premio settimanale */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,197,96,0.10), rgba(255,126,182,0.08))',
        border: `1px solid ${C.gold}44`,
        borderRadius: 16, padding: '14px 16px', marginBottom: 16,
        boxShadow: `0 0 20px ${C.gold}1a`,
      }}>
        <div style={{
          fontFamily: FF.label, fontSize: 10, color: C.goldL,
          letterSpacing: '0.28em', marginBottom: 10, fontWeight: 700,
          textTransform: 'uppercase',
        }}>🎁 Premi settimanali</div>
        {/* Riga 1: podi (1°, 2°, 3°) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {[
            { label: '🥇 1°', pack: 10, col: C.gold    },
            { label: '🥈 2°', pack: 5,  col: '#cfd8e3' },
            { label: '🥉 3°', pack: 3,  col: '#ff9b6b' },
          ].map(p => (
            <PremioBox key={p.label} p={p} />
          ))}
        </div>
        {/* Riga 2: categorie più ampie */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '🏅 Top 100', pack: 2, col: C.violet  },
            { label: '✦ Tutti',   pack: 1, col: '#5aa9ff' },
          ].map(p => (
            <PremioBox key={p.label} p={p} />
          ))}
        </div>
      </div>

      {loading && <LoadingHint label="Caricamento classifica…" color={C.goldL}/>}
      {errore && <ErrorHint label={`Errore: ${errore}`}/>}

      {/* PODIO */}
      {!loading && classifica.length >= 3 && (
        <Podio classifica={classifica} user={user} podiumColors={podiumColors}/>
      )}

      {/* La tua posizione (se non in top 3) */}
      {!loading && mioIndice >= 3 && (
        <div style={{
          background: `linear-gradient(135deg, ${C.sakura}22, rgba(13,10,38,0.92))`,
          border: `1px solid ${C.sakura}66`,
          borderRadius: 14, padding: 14, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: `0 0 22px ${C.sakura}1f`,
        }}>
          <div style={{
            fontFamily: FF.display, fontSize: 26, color: C.sakura,
            minWidth: 54, textShadow: `0 0 12px ${C.sakura}`, fontWeight: 800,
          }}>#{mioIndice + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FF.display, fontSize: 14, color: '#fff', fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {(classifica[mioIndice]._nomeDisplay || classifica[mioIndice].nomeImpero || 'Tu')} <span style={{ color: C.sakura }}>· TU</span>
            </div>
            <div style={{
              fontFamily: FF.mono, fontSize: 10, color: 'rgba(241,235,255,0.55)',
              marginTop: 2, letterSpacing: '-0.01em',
            }}>
              {classifica[mioIndice]._territori} {classifica[mioIndice]._territori === 1 ? "territorio" : "territori"}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: FF.mono, fontSize: 13, color: C.goldL, fontWeight: 700,
            }}>{premioPerPosizione(mioIndice + 1)} 🎴</div>
            <div style={{
              fontSize: 7, color: 'rgba(241,235,255,0.4)',
              fontFamily: FF.label, letterSpacing: '0.18em',
              textTransform: 'uppercase', marginTop: 2,
            }}>Premio</div>
          </div>
        </div>
      )}

      {/* LISTA */}
      {!loading && classifica.length > 0 && (
        <PannelloOrnato glow={C.gold} variant="default" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderBottom: `1px solid ${C.inkLine}`,
            fontFamily: FF.label, fontSize: 8, letterSpacing: '0.22em',
            color: 'rgba(241,235,255,0.4)', textTransform: 'uppercase', fontWeight: 700,
          }}>
            <div style={{ minWidth: 30 }}>#</div>
            <div style={{ flex: 1 }}>Giocatore</div>
            <div style={{ minWidth: 60, textAlign: 'center' }}>Territori</div>
            <div style={{ minWidth: 38, textAlign: 'right' }}>Premio</div>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {classifica.map((u, i) => {
              const isMe = user && u.id === user.uid;
              const isTop3 = i < 3;
              const col = isTop3 ? podiumColors[i] : isMe ? C.gold : null;
              const premio = premioPerPosizione(i + 1);
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: isMe
                    ? `linear-gradient(90deg, ${C.gold}1a, transparent)`
                    : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  borderLeft: isMe ? `3px solid ${C.gold}` : '3px solid transparent',
                  borderBottom: `1px solid rgba(174,156,255,0.06)`,
                  transition: 'background 0.15s',
                }}>
                  <div style={{ minWidth: 30, textAlign: 'center' }}>
                    {isTop3
                      ? <span style={{ fontSize: 18 }}>{['🥇','🥈','🥉'][i]}</span>
                      : <span style={{
                          fontFamily: FF.mono, fontSize: 11,
                          color: col || 'rgba(241,235,255,0.4)',
                          fontWeight: isMe ? 800 : 600,
                        }}>#{i + 1}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FF.display, fontSize: 11,
                      color: col || 'rgba(241,235,255,0.85)',
                      fontWeight: isMe || isTop3 ? 700 : 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {(u._nomeDisplay || u.nomeImpero || u.nome || u.email?.split('@')[0] || 'Giocatore').slice(0, 22)}
                      {isMe && <span style={{ marginLeft: 6, fontSize: 8, color: C.gold,
                        fontFamily: FF.label, letterSpacing: '0.18em' }}>← TU</span>}
                    </div>
                  </div>
                  <div style={{
                    minWidth: 60, textAlign: 'center',
                    fontFamily: FF.mono, fontSize: 11,
                    color: col || 'rgba(241,235,255,0.55)', fontWeight: 600,
                  }}>🗺️ {u._territori}</div>
                  <div style={{
                    minWidth: 38, textAlign: 'right',
                    fontFamily: FF.mono, fontSize: 10,
                    color: premio >= 3 ? C.goldL : 'rgba(241,235,255,0.4)',
                    fontWeight: premio >= 3 ? 700 : 500,
                  }}>{premio} 🎴</div>
                </div>
              );
            })}
          </div>

          {classifica.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 38, marginBottom: 8, filter: `drop-shadow(0 0 12px ${C.gold}88)` }}>🏆</div>
              <div style={{
                fontFamily: FF.label, fontSize: 10, color: C.gold,
                letterSpacing: '0.24em', marginBottom: 6,
                textTransform: 'uppercase', fontWeight: 700,
              }}>Classifica vuota</div>
              <div style={{ opacity: 0.55, fontSize: 11, lineHeight: 1.6, fontFamily: FF.body }}>
                Sii il primo a conquistare territori<br/>e scalare la classifica!
              </div>
            </div>
          )}
        </PannelloOrnato>
      )}

      <div style={{
        textAlign: 'center', marginTop: 14,
        fontSize: 8, color: 'rgba(241,235,255,0.3)',
        fontFamily: FF.label, letterSpacing: '0.22em',
        textTransform: 'uppercase', fontWeight: 600,
      }}>
        Criteri · Territori conquistati → Pass Hard (spareggio) → Data iscrizione
      </div>
      </>}
    </div>
  );
}

function Podio({ classifica, user, podiumColors }) {
  const heights = [180, 150, 120];
  const indices = [1, 0, 2]; // ordine visivo: 2°, 1°, 3°
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1.18fr 1fr',
      gap: 10, alignItems: 'flex-end', marginBottom: 18,
    }}>
      {indices.map(idx => {
        const u = classifica[idx];
        const col = podiumColors[idx];
        const isMe = user && u.id === user.uid;
        const h = heights[idx];
        const place = idx + 1;
        return (
          <div key={idx} style={{ position: 'relative', textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{
              width: 60, height: 60, borderRadius: 16, margin: '0 auto -16px',
              background: `linear-gradient(135deg, ${col}, ${C.violet})`,
              border: `2.5px solid ${col}`,
              boxShadow: `0 0 20px ${col}66`,
              display: 'grid', placeItems: 'center',
              position: 'relative', zIndex: 2,
              color: '#fff', fontFamily: FF.display, fontSize: 22, fontWeight: 800,
            }}>
              {(u._nomeDisplay || u.nomeImpero || u.email || '?')[0].toUpperCase()}
              <div style={{
                position: 'absolute', top: -10, right: -10,
                background: col, color: '#1a0e00',
                fontFamily: FF.display, fontSize: 15, fontWeight: 800,
                width: 26, height: 26, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                border: `2px solid ${C.ink}`,
                boxShadow: `0 0 12px ${col}`,
              }}>{place}</div>
              {isMe && (
                <div style={{
                  position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
                  background: col, color: '#1a0e00', fontFamily: FF.label,
                  fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                  border: `1px solid ${C.ink}`, letterSpacing: '0.18em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>TU</div>
              )}
            </div>
            <div style={{
              height: h, paddingTop: 30, position: 'relative',
              background: `linear-gradient(180deg, ${col}40 0%, ${col}10 50%, transparent 100%)`,
              borderRadius: '16px 16px 0 0',
              border: `1px solid ${col}55`, borderBottom: 'none',
              backdropFilter: 'blur(6px)',
            }}>
              {place === 1 && (
                <div style={{
                  position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 22, color: col, filter: `drop-shadow(0 0 12px ${col})`,
                }}>👑</div>
              )}
              <div style={{
                fontFamily: FF.display, fontSize: 12, color: '#fff', fontWeight: 700,
                padding: '0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{(u._nomeDisplay || u.nomeImpero || u.nome || u.email?.split('@')[0] || '—').slice(0, 14)}</div>
              <div style={{
                fontFamily: FF.label, fontSize: 8, color: 'rgba(241,235,255,0.55)',
                letterSpacing: '0.22em', marginTop: 4, textTransform: 'uppercase', fontWeight: 600,
              }}>🗺️ {u._territori} {u._territori === 1 ? 'territorio' : 'territori'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoadingHint({ label, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: '32px 16px',
      color: 'rgba(241,235,255,0.45)', fontFamily: FF.label,
      fontSize: 10, letterSpacing: '0.22em',
      textTransform: 'uppercase', fontWeight: 700,
    }}>
      <span style={{
        display: 'inline-block', width: 18, height: 18,
        borderRadius: '50%', border: `2px solid ${color}`,
        borderTopColor: 'transparent', verticalAlign: 'middle',
        marginRight: 10, animation: 'spinSlow 1s linear infinite',
      }}/>
      {label}
    </div>
  );
}
function ErrorHint({ label }) {
  return (
    <div style={{
      textAlign: 'center', padding: 20, color: C.err,
      fontSize: 11, fontFamily: FF.body, fontWeight: 600,
    }}>{label}</div>
  );
}
