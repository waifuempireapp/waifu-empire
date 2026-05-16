'use client';

/**
 * @module MappaScrollabile
 * @description Wrapper scrollabile e zoomabile attorno a MappaMondoArt.
 * Gestisce i controlli di zoom (+/-) e il pan touch/mouse sulla mappa SVG.
 *
 * Principio SRP: responsabile SOLO del comportamento scroll/zoom della mappa.
 * La logica di conquista territoriale rimane in MappaTab.
 *
 * @param {Object}   props
 * @param {Object}   props.territoriUtente    — Mappa dei territori con stato conquista.
 * @param {string}   props.coloreImpero       — Colore HEX dell'impero del giocatore.
 * @param {string}   props.nomeImpero         — Nome dell'impero del giocatore.
 * @param {string}   [props.territorioSelezionato] — ID del territorio selezionato.
 * @param {Function} props.onTerritorioClick  — Callback al click su un territorio.
 * @param {Array}    [props.mieiTerritori]    — Array di ID territori conquistati.
 */
import { useState, useCallback } from 'react';
import MappaMondoArt from '@/components/MappaMondoArt';

/**
 * MappaScrollabile — wrapper con zoom e scroll attorno alla mappa SVG del mondo.
 *
 * Espone tre pulsanti di controllo (zoom in, reset 1:1, zoom out) e cattura
 * l'evento wheel del mouse per modificare lo zoom tramite scroll.
 *
 * @param {Object}   props
 * @param {Object}   props.territoriUtente         — Stato conquista di ogni territorio.
 * @param {string}   props.coloreImpero            — Colore HEX dell'impero del giocatore.
 * @param {string}   props.nomeImpero              — Nome dell'impero del giocatore.
 * @param {string}   [props.territorioSelezionato] — ID del territorio selezionato corrente.
 * @param {Function} props.onTerritorioClick       — Callback invocata al click su un territorio.
 * @param {Array}    [props.mieiTerritori=[]]      — Array di ID dei territori conquistati.
 * @returns {JSX.Element} Il wrapper con mappa zoomabile.
 */
export default function MappaScrollabile({ territoriUtente, coloreImpero, nomeImpero, territorioSelezionato, onTerritorioClick, mieiTerritori = [] }) {
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 2.2;
  const ZOOM_STEP = 0.2;

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  return (
    <div style={{ position: 'relative', background: 'radial-gradient(60% 40% at 50% 30%, rgba(167,139,250,0.08), transparent 70%), #02010a' }}>
      {/* Controlli zoom */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))} style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(167,139,250,0.35)',
          color: '#a78bfa', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
        }}>+</button>
        <button onClick={() => setZoom(1)} style={{
          width: 28, height: 14, borderRadius: 4,
          background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(167,139,250,0.2)',
          color: 'rgba(167,139,250,0.5)', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Saira Condensed', Saira, sans-serif",
        }}>1:1</button>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))} style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(167,139,250,0.35)',
          color: '#a78bfa', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
        }}>−</button>
      </div>

      {/* Container scrollabile */}
      <div
        className="mappa-scroll-container"
        onWheel={handleWheel}
        style={{ borderRadius: 10, overflow: 'auto', maxHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? '55vw' : '68vh', minHeight: 200 }}
      >
        <div style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: zoom > 1 ? `${zoom * 100}%` : '100%',
          minWidth: zoom > 1 ? `${zoom * 100}%` : undefined,
        }}>
          <MappaMondoArt
            territoriUtente={territoriUtente}
            coloreImpero={coloreImpero}
            nomeImpero={nomeImpero}
            territorioSelezionato={territorioSelezionato}
            onTerritorioClick={onTerritorioClick}
            mieiTerritori={mieiTerritori}
          />
        </div>
      </div>
    </div>
  );
}
