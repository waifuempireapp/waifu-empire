// src/components/MappaMondoArt.jsx
// FASE 5 — Mappa Anime-Fantasy: grafica organica, continenti curvilinei,
//           legenda più visibile, "Conquistati" più evidente,
//           pulsazione forte per confinanti, non-confinanti più scuri,
//           nessun colore duplicato tra il proprio impero e gli altri.
'use client';
import React, { useState } from 'react';
import { TERRITORI, COLORI_CONTINENTI, NOMI_CONTINENTI } from '@/lib/constants';

// ─── palette continenti (base) ────────────────────────────────────────────────
// I colori sono distinti tra loro e non coincidono con il colore dell'impero del player,
// che viene calcolato a runtime e gestito con un override nella SVG.

export default function MappaMondoArt({
  territoriUtente = {},
  coloreImpero = '#f5a623',
  nomeImpero = 'Il Tuo Impero',
  onTerritorioClick,
  territorioSelezionato,
  width = '100%',
  height = '70vh',
  // ── Props multiplayer ──────────────────────────────────────────────────────
  // mappaMulti: { [territorioId]: { uid, coloreImpero, nomeImpero } }
  // Se presente, sovrascrive la logica conquisto/non-conquisto con i colori reali
  mappaMulti = null,
  myUid = null,
}) {
  const mieiTerrIds = Object.entries(territoriUtente)
    .filter(([, v]) => v?.conquistato)
    .map(([k]) => k);
  const primoAttacco = mieiTerrIds.length === 0;

  // ── Modalità Multiplayer: dati derivati da mappaMulti ─────────────────────
  // imperiMulti: Map uid → { coloreImpero, nomeImpero, count }
  // mieiTerrIdsMulti: array di territorioId posseduti da myUid
  let imperiMulti = null;
  let mieiTerrIdsMulti = [];
  if (mappaMulti && myUid) {
    const empMap = {};
    Object.entries(mappaMulti).forEach(([tid, info]) => {
      if (!info) return;
      const uid = info.uid;
      if (!empMap[uid]) empMap[uid] = { coloreImpero: info.coloreImpero, nomeImpero: info.nomeImpero, count: 0 };
      empMap[uid].count++;
      if (uid === myUid) mieiTerrIdsMulti.push(tid);
    });
    imperiMulti = empMap;
  }

  // ── Calcoliamo legenda: il mio impero + avversari ───────────────────────────
  const imperiMap = {};
  let mioCount = 0;
  Object.values(territoriUtente).forEach(v => {
    if (v?.conquistato) { mioCount++; return; }
    if (v?.impero && v?.coloreImpero) {
      if (!imperiMap[v.impero]) imperiMap[v.impero] = { colore: v.coloreImpero, count: 0 };
      imperiMap[v.impero].count++;
    }
  });
  const avversari = Object.entries(imperiMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  let listaImperi = [];
  if (imperiMulti && myUid) {
    // Modalità multiplayer: legenda con tutti gli imperi reali
    const myEmp = imperiMulti[myUid];
    if (myEmp) listaImperi.push([myEmp.nomeImpero, { colore: myEmp.coloreImpero, count: myEmp.count, mio: true }]);
    Object.entries(imperiMulti)
      .filter(([uid]) => uid !== myUid)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([uid, emp]) => {
        const label = uid === 'cpu' ? 'CPU' : emp.nomeImpero;
        listaImperi.push([label, { colore: emp.coloreImpero, count: emp.count, mio: false }]);
      });
  } else {
    if (mioCount > 0) listaImperi.push([nomeImpero, { colore: coloreImpero, count: mioCount, mio: true }]);
    avversari.forEach(([n, d]) => listaImperi.push([n, d]));
  }

  const numConquistati = imperiMulti && myUid
    ? mieiTerrIdsMulti.length
    : Object.values(territoriUtente).filter(t => t?.conquistato).length;

  const [legendaAperta, setLegendaAperta] = useState(true);

  return (
    <div style={{
      position: 'relative',
      width, height,
      background: 'radial-gradient(1200px 600px at 15% -10%, rgba(167,139,250,0.18), rgba(0,0,0,0) 60%), radial-gradient(900px 500px at 100% 110%, rgba(255,126,182,0.12), rgba(0,0,0,0) 55%), radial-gradient(700px 400px, rgba(108,240,224,0.06), rgba(0,0,0,0) 60%), linear-gradient(#0a0726 0%, #050314 60%, #02010a 100%)',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(245,166,35,0.25)',
      boxShadow: '0 0 60px rgba(155,89,255,0.18), inset 0 0 80px rgba(0,0,0,0.5)',
    }}>
      {/* CSS per animazioni keyframe */}
      <style>{`
        @keyframes pulseConf {
          0%,100% { opacity: 0.55; filter: brightness(1); }
          50%      { opacity: 1;    filter: brightness(1.5) drop-shadow(0 0 8px #ffd666); }
        }
        @keyframes dotPulse {
          0%,100% { r: 2.5; opacity: 0.8; }
          50%      { r: 5;   opacity: 0.3; }
        }
        @keyframes shimmer {
          0%   { stop-color: #ffd666; }
          50%  { stop-color: #fff7c0; }
          100% { stop-color: #ffd666; }
        }
        .terr-conf { animation: pulseConf 1.6s ease-in-out infinite; }
        .dot-pulse  { animation: dotPulse 1.4s ease-in-out infinite; }
      `}</style>

      <svg
        viewBox="0 0 1060 720"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          {/* ── Oceano ── */}
          <radialGradient id="ocean-g" cx="48%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#0a0726" />
            <stop offset="60%" stopColor="#050314" />
            <stop offset="100%" stopColor="#02010a" />
          </radialGradient>

          {/* ── Grid tenue ── */}
          <pattern id="grid-p" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M52,0 L52,52 M0,52 L52,52" stroke="rgba(155,89,255,0.05)" strokeWidth="0.5"/>
          </pattern>

          {/* ── Esagoni fantasia ── */}
          <pattern id="hex-p" width="32" height="28" patternUnits="userSpaceOnUse">
            <path d="M16,0 L32,8 L32,20 L16,28 L0,20 L0,8 Z"
              fill="none" stroke="rgba(245,166,35,0.035)" strokeWidth="0.4"/>
          </pattern>

          {/* ── Gradiente per ogni continente ── */}
          {Object.entries(COLORI_CONTINENTI).map(([key, c]) => (
            <linearGradient key={key} id={`cg-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={lighten(c, 14)} stopOpacity="0.95"/>
              <stop offset="100%" stopColor={darken(c, 38)}  stopOpacity="0.85"/>
            </linearGradient>
          ))}

          {/* ── Gradiente per il mio impero ── */}
          <linearGradient id="my-empire-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={lighten(coloreImpero, 20)} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={darken(coloreImpero, 20)}  stopOpacity="0.8"/>
          </linearGradient>

          {/* ── Gradienti per-impero multiplayer ── */}
          {imperiMulti && Object.entries(imperiMulti).map(([uid, { coloreImpero: c }]) => (
            <linearGradient key={`emp-g-${uid}`} id={`emp-g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={lighten(c, 18)} stopOpacity="0.92"/>
              <stop offset="100%" stopColor={darken(c, 22)}  stopOpacity="0.82"/>
            </linearGradient>
          ))}

          {/* ── Filtri glow ── */}
          <filter id="glow-s" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-m" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-xl" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="9" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="darken-f">
            <feColorMatrix type="matrix"
              values="0.4 0   0   0 0
                      0   0.4 0   0 0
                      0   0   0.4 0 0
                      0   0   0   0.6 0"/>
          </filter>

          {/* ── Clip per il viewbox ── */}
          <clipPath id="map-clip">
            <rect width="1060" height="720" rx="14"/>
          </clipPath>

          {/* ── Stelle di sfondo ── */}
          {STARS.map((s, i) => (
            <circle key={i} id={`star-${i}`} cx={s[0]} cy={s[1]} r={s[2]}
              fill="rgba(255,255,255,0.6)"/>
          ))}
        </defs>

        {/* ── Sfondo oceano ── */}
        <rect width="1060" height="720" fill="url(#ocean-g)" clipPath="url(#map-clip)"/>
        <rect width="1060" height="720" fill="url(#grid-p)" clipPath="url(#map-clip)"/>
        <rect width="1060" height="720" fill="url(#hex-p)"  clipPath="url(#map-clip)"/>

        {/* ── Stelle ── */}
        {STARS.map((s, i) => (
          <circle key={i} cx={s[0]} cy={s[1]} r={s[2]} fill={`rgba(255,255,255,${s[3]})`}/>
        ))}

        {/* ── Linee orizzontali dell'oceano ── */}
        {[0.17,0.33,0.5,0.67,0.83].map((f, i) => (
          <line key={i} x1="0" y1={720*f} x2="1060" y2={720*f}
            stroke="rgba(108,240,224,0.02)" strokeWidth="0.6"/>
        ))}

        {/* ── Continenti — blob decorativi (per dare impressione organica) ── */}
        {CONTINENT_BLOBS.map((b, i) => (
          <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry}
            fill={COLORI_CONTINENTI[b.cont] || '#333'}
            opacity={0.06}
            transform={b.rot ? `rotate(${b.rot},${b.cx},${b.cy})` : undefined}
          />
        ))}

        {/* ════════════════════════════════════════════════════
            TERRITORI
            ════════════════════════════════════════════════════ */}
        {TERRITORI.map(t => {
          // ════════════════════════════════════════════════════
          // MODALITÀ MULTIPLAYER
          // ════════════════════════════════════════════════════
          if (imperiMulti && myUid) {
            const infoMulti = mappaMulti[t.id];
            const proprietarioUid = infoMulti?.uid || 'cpu';
            const isMio = proprietarioUid === myUid;
            const isCpu = proprietarioUid === 'cpu';
            const coloreProprietario = isCpu ? '#666666' : (infoMulti?.coloreImpero || '#666666');
            const nomeProprietario = isCpu ? 'CPU' : (infoMulti?.nomeImpero || '?');
            const selez = territorioSelezionato === t.id;

            // Confinante = non mio E almeno un mio territorio è confinante (o non ho ancora territori)
            const eConfinante = !isMio && (
              mieiTerrIdsMulti.length === 0 ||
              (t.conf || []).some(cId => mieiTerrIdsMulti.includes(cId))
            );

            let fillCol, strokeCol, strokeW, opac;
            if (isMio) {
              fillCol = `url(#emp-g-${myUid})`;
              strokeCol = coloreImpero;
              strokeW = 2.5;
              opac = 1;
            } else if (eConfinante) {
              fillCol = `url(#emp-g-${proprietarioUid})`;
              strokeCol = '#ffd666';
              strokeW = 2;
              opac = 0.75;
            } else {
              fillCol = `url(#emp-g-${proprietarioUid})`;
              strokeCol = coloreProprietario + '50';
              strokeW = 0.8;
              opac = 0.30;
            }

            return (
              <g key={t.id} style={{ cursor: isMio ? 'default' : 'pointer' }}
                onClick={() => onTerritorioClick && onTerritorioClick(t)}>

                {/* Glow halo mio territorio */}
                {isMio && (
                  <path d={t.path} fill="none"
                    stroke={coloreImpero} strokeWidth="8" opacity="0.25"
                    filter="url(#glow-xl)"/>
                )}
                {/* Glow halo confinante attaccabile */}
                {eConfinante && (
                  <path d={t.path} fill="none"
                    stroke="#ffd666" strokeWidth="6" opacity="0.35"
                    filter="url(#glow-m)"/>
                )}

                {/* Body territorio */}
                <path
                  d={t.path}
                  fill={fillCol}
                  stroke={selez ? '#fff' : strokeCol}
                  strokeWidth={selez ? 3.5 : strokeW}
                  opacity={isMio || selez ? 1 : opac}
                  filter={selez ? 'url(#glow-s)' : undefined}
                  className={eConfinante ? 'terr-conf' : undefined}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                />

                {/* Overlay scuro per non confinanti non miei */}
                {!isMio && !eConfinante && (
                  <path d={t.path} fill="rgba(0,0,0,0.48)" stroke="none"/>
                )}

                {/* Bandierina mio territorio */}
                {isMio && (
                  <g transform={`translate(${t.cx},${t.cy - 18})`} filter="url(#glow-s)">
                    <text fontSize="15" fill={coloreImpero} textAnchor="middle" y="0"
                      style={{ filter: `drop-shadow(0 0 6px ${coloreImpero})` }}>⚑</text>
                  </g>
                )}

                {/* Bandierina altri giocatori (visibile per confinanti) */}
                {!isMio && !isCpu && eConfinante && (
                  <g transform={`translate(${t.cx},${t.cy - 18})`}>
                    <text fontSize="11" fill={coloreProprietario} textAnchor="middle" y="0"
                      opacity="0.8">⚑</text>
                  </g>
                )}

                {/* Nome territorio */}
                <text
                  x={t.cx} y={t.cy + (isMio ? 14 : eConfinante ? 8 : 6)}
                  textAnchor="middle"
                  fontSize={isMio || eConfinante ? '9.5' : '7.5'}
                  fontFamily="Orbitron, sans-serif"
                  fill={isMio ? '#ffd666' : eConfinante ? '#fff' : 'rgba(238,232,220,0.28)'}
                  stroke="rgba(0,0,0,0.8)" strokeWidth="0.4" paintOrder="stroke"
                  style={{ letterSpacing: 0.5, fontWeight: isMio || eConfinante ? 700 : 400 }}
                >{t.nome}</text>

                {/* Nome proprietario sotto il territorio (per confinanti non miei) */}
                {eConfinante && !isMio && (
                  <text
                    x={t.cx} y={t.cy + 20}
                    textAnchor="middle"
                    fontSize="7"
                    fontFamily="Orbitron, sans-serif"
                    fill={coloreProprietario}
                    stroke="rgba(0,0,0,0.9)" strokeWidth="0.5" paintOrder="stroke"
                    opacity="0.85"
                  >{nomeProprietario.length > 12 ? nomeProprietario.slice(0,10)+'…' : nomeProprietario}</text>
                )}

                {/* Punto pulsante confinante */}
                {eConfinante && (
                  <circle cx={t.cx} cy={t.cy - 16} r="3.5" fill="#ffd666"
                    className="dot-pulse"/>
                )}
              </g>
            );
          }

          // ════════════════════════════════════════════════════
          // MODALITÀ SINGLE PLAYER (comportamento originale)
          // ════════════════════════════════════════════════════
          const terrData = territoriUtente[t.id] || {};
          const conquistato = terrData.conquistato;
          const selez = territorioSelezionato === t.id;
          const eConfinante = !conquistato && (
            primoAttacco || (t.conf || []).some(cId => mieiTerrIds.includes(cId))
          );

          // ── stati visuali ──
          let fillCol, strokeCol, strokeW, opac;

          if (conquistato) {
            fillCol = 'url(#my-empire-g)';
            strokeCol = coloreImpero;
            opac = 1;
            strokeW = 2.5;
          } else if (eConfinante) {
            fillCol = `url(#cg-${t.cont})`;
            strokeCol = '#ffd666';
            opac = 0.75;    // viene sovrascritta dall'animazione CSS
            strokeW = 2;
          } else {
            // non confinante → più scuro e desaturato
            fillCol = `url(#cg-${t.cont})`;
            strokeCol = COLORI_CONTINENTI[t.cont] + '40';
            opac = 0.22;
            strokeW = 0.7;
          }

          return (
            <g key={t.id} style={{ cursor: 'pointer' }}
              onClick={() => onTerritorioClick && onTerritorioClick(t)}>

              {/* ── Glow halo per conquistati ── */}
              {conquistato && (
                <path d={t.path} fill="none"
                  stroke={coloreImpero} strokeWidth="8" opacity="0.25"
                  filter="url(#glow-xl)"/>
              )}

              {/* ── Glow halo per confinanti ── */}
              {eConfinante && (
                <path d={t.path} fill="none"
                  stroke="#ffd666" strokeWidth="6" opacity="0.35"
                  filter="url(#glow-m)"/>
              )}

              {/* ── Body territorio ── */}
              <path
                d={t.path}
                fill={fillCol}
                stroke={selez ? '#fff' : strokeCol}
                strokeWidth={selez ? 3.5 : strokeW}
                opacity={conquistato || selez ? 1 : opac}
                filter={selez ? 'url(#glow-s)' : undefined}
                className={eConfinante ? 'terr-conf' : undefined}
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
              />

              {/* ── Overlay scuro per non confinanti ── */}
              {!conquistato && !eConfinante && (
                <path d={t.path} fill="rgba(0,0,0,0.45)" stroke="none"/>
              )}

              {/* ── Bandierina conquistato ── */}
              {conquistato && (
                <g transform={`translate(${t.cx},${t.cy - 18})`} filter="url(#glow-s)">
                  <text fontSize="15" fill={coloreImpero} textAnchor="middle" y="0"
                    style={{ filter: `drop-shadow(0 0 6px ${coloreImpero})` }}>⚑</text>
                </g>
              )}

              {/* ── Nome territorio ── */}
              <text
                x={t.cx} y={t.cy + (conquistato ? 14 : eConfinante ? 8 : 6)}
                textAnchor="middle"
                fontSize={conquistato || eConfinante ? '9.5' : '7.5'}
                fontFamily="Orbitron, sans-serif"
                fill={conquistato ? '#ffd666' : eConfinante ? '#fff' : 'rgba(238,232,220,0.28)'}
                stroke="rgba(0,0,0,0.8)" strokeWidth="0.4" paintOrder="stroke"
                style={{ letterSpacing: 0.5, fontWeight: conquistato || eConfinante ? 700 : 400 }}
              >{t.nome}</text>

              {/* ── Punto pulsante confinante ── */}
              {eConfinante && (
                <circle cx={t.cx} cy={t.cy - 16} r="3.5" fill="#ffd666"
                  className="dot-pulse"/>
              )}
            </g>
          );
        })}

        {/* ════════════════════════════════════════════════════
            BORDO DECORATIVO
            ════════════════════════════════════════════════════ */}
        <rect x="6" y="6" width="1048" height="708" fill="none"
          stroke="rgba(167,139,250,0.2)" strokeWidth="1" rx="12"/>

        {/* Angoli stile manga */}
        {[
          {x:2,y:2,r:0}, {x:1058,y:2,r:90},
          {x:1058,y:718,r:180}, {x:2,y:718,r:270},
        ].map((c,i) => (
          <g key={i} transform={`translate(${c.x},${c.y}) rotate(${c.r})`}>
            <path d="M6,6 L36,6 L36,8.5 L8.5,8.5 L8.5,36 L6,36 Z"
              fill="rgba(167,139,250,0.5)" opacity="1"/>
          </g>
        ))}

        {/* ════════════════════════════════════════════════════
            TITOLO
            ════════════════════════════════════════════════════ */}
        <g transform="translate(530,36)">
          <rect x="-150" y="-19" width="300" height="36" rx="8"
            fill="rgba(5,2,14,0.88)" stroke="rgba(167,139,250,0.35)" strokeWidth="1"/>
          {/* piccole stelle decorative ai lati */}
          <text x="-128" y="7" fontSize="9" fill="rgba(167,139,250,0.5)">✦</text>
          <text x="128"  y="7" fontSize="9" fill="rgba(167,139,250,0.5)" textAnchor="end">✦</text>
          <text textAnchor="middle" y="7" fontSize="11"
            fontFamily="Orbitron, sans-serif" fill="#a78bfa" letterSpacing="3.5" fontWeight="700">
            MONDO CONOSCIUTO
          </text>
        </g>



        {/* ════════════════════════════════════════════════════
            BUSSOLA — stile anime
            ════════════════════════════════════════════════════ */}
        <g transform="translate(990,72)">
          <circle r="26" fill="rgba(5,2,14,0.78)" stroke="rgba(167,139,250,0.3)" strokeWidth="0.8"/>
          {/* quadranti */}
          {[0,45,90,135,180,225,270,315].map((a,i) => {
            const rad = a * Math.PI / 180;
            const isMaj = a % 90 === 0;
            return <line key={i}
              x1={0} y1={0}
              x2={Math.sin(rad) * (isMaj ? 20 : 14)}
              y2={-Math.cos(rad) * (isMaj ? 20 : 14)}
              stroke={isMaj ? 'rgba(108,240,224,0.5)' : 'rgba(167,139,250,0.18)'}
              strokeWidth={isMaj ? 0.7 : 0.4}/>;
          })}
          {/* freccia N (aqua) */}
          <path d="M0,-20 L3.5,-4 L0,2 L-3.5,-4 Z" fill="#6cf0e0" opacity="0.9"/>
          {/* freccia S */}
          <path d="M0,20 L3.5,4 L0,-2 L-3.5,4 Z" fill="rgba(245,166,35,0.25)"/>
          <circle r="2.5" fill="#ffd666"/>
          <text y="-23" textAnchor="middle" fill="rgba(108,240,224,0.8)"
            fontSize="6" fontFamily="Orbitron">N</text>
        </g>

      </svg>

      {/* HTML overlay legenda — visibile di default, collassabile su mobile */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 10,
        maxWidth: legendaAperta ? 180 : 32,
        transition: 'max-width 0.3s ease',
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'rgba(10,7,38,0.88)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '0.8px solid rgba(167,139,250,0.25)',
          borderRadius: 12,
          padding: legendaAperta ? '10px 12px' : '6px',
          minWidth: 28,
        }}>
          {/* Toggle button */}
          <button
            onClick={() => setLegendaAperta(v => !v)}
            style={{
              display: 'block',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#a78bfa',
              fontSize: 12,
              padding: 0,
              marginBottom: legendaAperta ? 8 : 0,
              lineHeight: 1,
            }}
            title={legendaAperta ? 'Nascondi legenda' : 'Mostra legenda'}
          >
            {legendaAperta ? '⚑' : '⚑'}
          </button>

          {legendaAperta && (
            <>
              {/* Titolo */}
              <div style={{
                fontFamily: "'Saira Condensed', Saira, sans-serif",
                fontSize: 8,
                fontWeight: 700,
                color: 'rgba(167,139,250,0.8)',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 8,
                borderBottom: '0.5px solid rgba(167,139,250,0.15)',
                paddingBottom: 6,
              }}>⚑ Legenda Imperi</div>

              {/* Lista imperi */}
              {listaImperi.map(([nome, { colore, count, mio }]) => (
                <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                    background: colore,
                    border: mio ? '1px solid rgba(255,233,168,0.6)' : 'none',
                    boxShadow: mio ? `0 0 6px ${colore}80` : 'none',
                  }}/>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: mio ? 10 : 9,
                    color: mio ? '#f1ebff' : 'rgba(182,174,214,0.8)',
                    fontWeight: mio ? 700 : 400,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {nome.length > 14 ? nome.slice(0, 12) + '…' : nome}
                  </span>
                  <span style={{
                    fontFamily: "'Saira Condensed', Saira, sans-serif",
                    fontSize: 9,
                    color: mio ? '#6cf0e0' : 'rgba(167,139,250,0.6)',
                    fontWeight: 700,
                  }}>{count}</span>
                </div>
              ))}

              {listaImperi.length === 0 && (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: 'rgba(167,139,250,0.4)' }}>
                  Nessun impero
                </div>
              )}

              {/* Legenda stati */}
              <div style={{
                marginTop: 8,
                paddingTop: 6,
                borderTop: '0.5px solid rgba(167,139,250,0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffd666', boxShadow: '0 0 4px #ffd666' }}/>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, color: 'rgba(255,214,102,0.8)' }}>Conquistabile</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(60,50,80,0.7)' }}/>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, color: 'rgba(167,139,250,0.4)' }}>Non raggiungibile</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* HTML overlay contatore conquistati */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        zIndex: 10,
        background: 'rgba(10,7,38,0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '0.8px solid rgba(167,139,250,0.25)',
        borderRadius: 12,
        padding: '8px 14px',
        textAlign: 'center',
        minWidth: 80,
      }}>
        <div style={{
          fontFamily: "'Saira Condensed', Saira, sans-serif",
          fontSize: 8,
          fontWeight: 700,
          color: 'rgba(167,139,250,0.7)',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 2,
        }}>CONQUISTATI</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
          <span style={{
            fontFamily: "'Unbounded', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: '#6cf0e0',
            lineHeight: 1,
          }}>{numConquistati}</span>
          <span style={{
            fontFamily: "'Saira Condensed', sans-serif",
            fontSize: 12,
            color: 'rgba(167,139,250,0.4)',
          }}>/{TERRITORI.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── helpers colore ────────────────────────────────────────────────────────────
function lighten(hex, pct) {
  try {
    const n = parseInt(hex.replace('#',''), 16);
    const a = Math.round(2.55 * pct);
    const R = Math.min(255,(n>>16)+a), G = Math.min(255,((n>>8)&0xFF)+a), B = Math.min(255,(n&0xFF)+a);
    return `#${(0x1000000+R*0x10000+G*0x100+B).toString(16).slice(1)}`;
  } catch { return hex; }
}
function darken(hex, pct) {
  try {
    const n = parseInt(hex.replace('#',''), 16);
    const a = Math.round(2.55 * pct);
    const R = Math.max(0,(n>>16)-a), G = Math.max(0,((n>>8)&0xFF)-a), B = Math.max(0,(n&0xFF)-a);
    return `#${(0x1000000+R*0x10000+G*0x100+B).toString(16).slice(1)}`;
  } catch { return hex; }
}

// ─── stelle di sfondo ─────────────────────────────────────────────────────────
const STARS = [
  [42,18,0.8,0.5],[88,55,1.2,0.4],[130,22,0.7,0.6],[205,44,1.0,0.3],[280,14,0.9,0.5],
  [370,35,0.7,0.4],[450,19,1.1,0.6],[520,8,0.8,0.3],[610,28,0.7,0.5],[690,15,1.0,0.4],
  [760,40,0.9,0.3],[840,22,0.7,0.6],[930,12,1.2,0.4],[1000,35,0.8,0.5],[1040,18,0.7,0.3],
  [55,640,0.8,0.3],[120,680,1.0,0.4],[200,660,0.7,0.5],[300,695,0.9,0.3],[420,650,0.8,0.4],
  [540,700,0.7,0.3],[630,665,1.1,0.5],[700,690,0.8,0.4],[800,658,0.9,0.3],[900,682,0.7,0.4],
];

// ─── blob continentali decorativi ─────────────────────────────────────────────
const CONTINENT_BLOBS = [
  { cont:'NA', cx:215, cy:215, rx:170, ry:140, rot:-8 },
  { cont:'SA', cx:330, cy:470, rx:90,  ry:120, rot:5  },
  { cont:'EU', cx:595, cy:250, rx:120, ry:90,  rot:-5 },
  { cont:'AF', cx:630, cy:440, rx:95,  ry:120, rot:3  },
  { cont:'AS', cx:840, cy:290, rx:185, ry:145, rot:-4 },
  { cont:'OC', cx:920, cy:540, rx:75,  ry:60,  rot:6  },
];
