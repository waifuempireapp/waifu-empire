'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import { LAND_SET } from '@/lib/worldMap';

const BASE_PIXEL_SIZE = 8;
const MOBILE_PIXEL_SIZE = 10; // più grande su mobile per facilità di click
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const GRID_SIZE = 50;
const CPU_COLOR = '#444455';
const OCEAN_COLOR = '#0a1428';
const TAP_THRESHOLD = 12; // px — più generoso su Android

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

const MISSION_COLOR = '#e879f9'; // fuchsia — non selezionabile come colore impero

export default function PixelGrid({ chunks, userUid, onPixelSelect, selectedPixel, landSet, missionPixelSet, focusPixel }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ panX: 0, panY: 0, scale: 1 });
  const dragRef   = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const pinchRef  = useRef({ active: false, dist: 0, midX: 0, midY: 0 });
  const pulseRef  = useRef(0); // 0-1 oscillante per il pulse degli adiacenti
  const rafRef    = useRef(null);
  const [, forceRedraw] = useState(0);

  const effectiveLandSet = landSet || LAND_SET;
  const basePS = isMobile() ? MOBILE_PIXEL_SIZE : BASE_PIXEL_SIZE;

  const pixelColors = useRef({});
  const pixelOwners = useRef({});

  useEffect(() => {
    const colorMap = {};
    const ownerMap = {};
    if (chunks) {
      for (const chunk of Object.values(chunks)) {
        if (!chunk.pixels) continue;
        for (const [key, data] of Object.entries(chunk.pixels)) {
          colorMap[key] = data.ownerId === 'CPU' ? CPU_COLOR : (data.ownerColor || '#ff85b6');
          ownerMap[key] = data.ownerId;
        }
      }
    }
    pixelColors.current = colorMap;
    pixelOwners.current = ownerMap;
    drawCanvas(pulseRef.current);
  }, [chunks]);

  // Calcola set di pixel adiacenti (conquestabili dal giocatore)
  const adjacentSet = useRef(new Set());
  useEffect(() => {
    if (!chunks || !userUid) { adjacentSet.current = new Set(); return; }
    const dirs8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const adj = new Set();
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const key = `${x}_${y}`;
        if (!effectiveLandSet.has(key)) continue;
        if (pixelOwners.current[key] === userUid) continue;
        // Controlla se adiacente a un pixel dell'utente via mare
        outer: for (const [dx, dy] of dirs8) {
          let nx = x + dx, ny = y + dy;
          while (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const nk = `${nx}_${ny}`;
            if (effectiveLandSet.has(nk)) {
              if (pixelOwners.current[nk] === userUid) { adj.add(key); break outer; }
              break;
            }
            nx += dx; ny += dy;
          }
        }
      }
    }
    adjacentSet.current = adj;
  }, [chunks, userUid, effectiveLandSet]);

  const drawCanvas = useCallback((pulse = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { panX, panY, scale } = stateRef.current;
    const ps = basePS * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = OCEAN_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Disegna pixel terra
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const key = `${gx}_${gy}`;
        if (effectiveLandSet && !effectiveLandSet.has(key)) continue;

        const sx = gx * ps + panX;
        const sy = gy * ps + panY;
        if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue;

        const owner = pixelOwners.current[key];
        const color = pixelColors.current[key] || CPU_COLOR;
        const isOwn = owner === userUid;
        const isAdj = adjacentSet.current.has(key);

        // Pixel conquestabili: pulse animato
        // CPU → pulse golden (cambia colore), giocatori → pulse sottile senza cambiare colore
        if (isAdj) {
          const isCpuTarget = pixelOwners.current[key] === 'CPU' || !pixelOwners.current[key];
          if (isCpuTarget) {
            // CPU: bagliore gold pulsante
            const alpha = 0.12 + pulse * 0.28;
            ctx.fillStyle = `rgba(245,197,96,${alpha})`;
            ctx.fillRect(sx - 1, sy - 1, ps + 2, ps + 2);
          } else {
            // Giocatore avversario: solo outline pulsante bianca, senza colore
            ctx.strokeStyle = `rgba(255,255,255,${0.2 + pulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(sx, sy, ps - 1, ps - 1);
          }
        }

        // Pixel terra
        if (isOwn) {
          // Proprio empire: più vivido
          ctx.fillStyle = color;
          ctx.globalAlpha = 1;
          ctx.fillRect(sx, sy, ps - 1, ps - 1);
        } else {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(sx, sy, ps - 1, ps - 1);
          ctx.globalAlpha = 1;
        }

        // Pixel selezionato
        if (selectedPixel && selectedPixel.x === gx && selectedPixel.y === gy) {
          ctx.strokeStyle = '#ffe9a8';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx, sy, ps - 1, ps - 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Bordi tra empire diversi (secondo passaggio)
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const key = `${gx}_${gy}`;
        if (effectiveLandSet && !effectiveLandSet.has(key)) continue;
        const owner = pixelOwners.current[key];
        const sx = gx * ps + panX;
        const sy = gy * ps + panY;
        if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue;

        const isOwn = owner === userUid;
        // Solo bordi cardinali (4 direzioni) per evitare over-rendering
        const cardinals = [[1,0],[0,1]];
        for (const [dx, dy] of cardinals) {
          const nx = gx + dx, ny = gy + dy;
          if (nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
          const nk = `${nx}_${ny}`;
          if (effectiveLandSet && !effectiveLandSet.has(nk)) continue;
          const nOwner = pixelOwners.current[nk];
          if (nOwner === owner) continue; // stesso empire → nessun bordo

          // Bordo tra empire diversi
          ctx.strokeStyle = isOwn || nOwner === userUid ? 'rgba(255,233,168,0.7)' : 'rgba(0,0,0,0.55)';
          ctx.lineWidth = isOwn || nOwner === userUid ? 1.5 : 1;
          ctx.beginPath();
          if (dx === 1) { // bordo destra
            ctx.moveTo(sx + ps - 1, sy);
            ctx.lineTo(sx + ps - 1, sy + ps - 1);
          } else { // bordo sotto
            ctx.moveTo(sx, sy + ps - 1);
            ctx.lineTo(sx + ps - 1, sy + ps - 1);
          }
          ctx.stroke();
        }
      }
    }

    // Micro-bordo gold interno per proprio empire
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const key = `${gx}_${gy}`;
        if (!effectiveLandSet?.has(key)) continue;
        if (pixelOwners.current[key] !== userUid) continue;
        const sx = gx * ps + panX;
        const sy = gy * ps + panY;
        if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue;
        ctx.strokeStyle = 'rgba(255,233,168,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, ps - 2, ps - 2);
      }
    }

    // Overlay missione mappa: bordo fuchsia + corona ♛ (quando abbastanza grande)
    if (missionPixelSet?.size > 0) {
      for (const key of missionPixelSet) {
        const [gx, gy] = key.split('_').map(Number);
        if (!effectiveLandSet?.has(key)) continue;
        const sx = gx * ps + panX;
        const sy = gy * ps + panY;
        if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue;

        // Overlay semi-trasparente fuchsia
        ctx.fillStyle = 'rgba(232,121,249,0.22)';
        ctx.fillRect(sx, sy, ps - 1, ps - 1);

        // Bordo fuchsia
        ctx.strokeStyle = MISSION_COLOR;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx + 0.5, sy + 0.5, ps - 2, ps - 2);

        // Corona al centro — visibile anche a zoom ridotto (soglia abbassata a 7px)
        if (ps >= 7) {
          const fontSize = Math.min(Math.floor(ps * 0.75), 14);
          ctx.fillStyle = MISSION_COLOR;
          ctx.globalAlpha = 0.95;
          ctx.font = `bold ${fontSize}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♛', sx + ps / 2, sy + ps / 2);
          ctx.globalAlpha = 1;
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }, [selectedPixel, effectiveLandSet, userUid, basePS, missionPixelSet]);

  // Animazione pulse per pixel adiacenti
  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 0.04;
      pulseRef.current = (Math.sin(t) + 1) / 2; // 0-1
      drawCanvas(pulseRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [drawCanvas]);

  // Centra la mappa su focusPixel quando cambia
  useEffect(() => {
    if (!focusPixel) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { scale } = stateRef.current;
    const ps = basePS * scale;
    stateRef.current.panX = canvas.width / 2 - focusPixel.x * ps - ps / 2;
    stateRef.current.panY = canvas.height / 2 - focusPixel.y * ps - ps / 2;
    drawCanvas(pulseRef.current);
  }, [focusPixel, basePS, drawCanvas]);

  // ── PAN ──────────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.touches?.length === 2) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    dragRef.current = { active: true, startX: cx, startY: cy, panX: stateRef.current.panX, panY: stateRef.current.panY };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active || pinchRef.current.active) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    stateRef.current.panX = dragRef.current.panX + (cx - dragRef.current.startX);
    stateRef.current.panY = dragRef.current.panY + (cy - dragRef.current.startY);
  }, []);

  const handleTap = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { panX, panY, scale } = stateRef.current;
    const ps = basePS * scale;
    const lx = clientX - rect.left - panX;
    const ly = clientY - rect.top - panY;
    const gx = Math.floor(lx / ps);
    const gy = Math.floor(ly / ps);
    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      const key = `${gx}_${gy}`;
      if (effectiveLandSet && !effectiveLandSet.has(key)) return;
      const chunkCol = Math.floor(gx / 10);
      const chunkRow = Math.floor(gy / 10);
      const chunkId = `chunk_${chunkCol}_${chunkRow}`;
      const pixelData = chunks?.[chunkId]?.pixels?.[key] ?? { ownerId: 'CPU', ownerColor: CPU_COLOR, ownerName: 'CPU' };
      onPixelSelect?.({ x: gx, y: gy, ...pixelData });
    }
  }, [chunks, onPixelSelect, effectiveLandSet, basePS]);

  const onPointerUp = useCallback((e) => {
    if (pinchRef.current.active) return;
    const cx = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;
    const dx = Math.abs(cx - dragRef.current.startX);
    const dy = Math.abs(cy - dragRef.current.startY);
    dragRef.current.active = false;
    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) handleTap(cx, cy);
  }, [handleTap]);

  // ── PINCH-TO-ZOOM ────────────────────────────────────────────────────────────
  const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      dragRef.current.active = false;
      pinchRef.current = { active: true, dist: getDist(e.touches[0], e.touches[1]), midX: (e.touches[0].clientX + e.touches[1].clientX) / 2, midY: (e.touches[0].clientY + e.touches[1].clientY) / 2, panX: stateRef.current.panX, panY: stateRef.current.panY, scale: stateRef.current.scale };
      e.preventDefault();
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = { active: true, startX: t.clientX, startY: t.clientY, panX: stateRef.current.panX, panY: stateRef.current.panY };
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const newDist = getDist(e.touches[0], e.touches[1]);
      const ratio = newDist / pinchRef.current.dist;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRef.current.scale * ratio));
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const midLocal = { x: pinchRef.current.midX - rect.left, y: pinchRef.current.midY - rect.top };
      const scaleDiff = newScale / pinchRef.current.scale;
      stateRef.current.panX = midLocal.x + (pinchRef.current.panX - midLocal.x) * scaleDiff;
      stateRef.current.panY = midLocal.y + (pinchRef.current.panY - midLocal.y) * scaleDiff;
      stateRef.current.scale = newScale;
    } else if (e.touches.length === 1 && dragRef.current.active) {
      const t = e.touches[0];
      stateRef.current.panX = dragRef.current.panX + (t.clientX - dragRef.current.startX);
      stateRef.current.panY = dragRef.current.panY + (t.clientY - dragRef.current.startY);
    }
  }, []);

  // Fallback onTouchEnd per Android (più affidabile di onPointerUp su Android)
  const onTouchEnd = useCallback((e) => {
    if (e.touches.length >= 2) return;
    pinchRef.current.active = false;
    if (e.changedTouches?.length === 1) {
      const t = e.changedTouches[0];
      const dx = Math.abs(t.clientX - dragRef.current.startX);
      const dy = Math.abs(t.clientY - dragRef.current.startY);
      dragRef.current.active = false;
      if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) handleTap(t.clientX, t.clientY);
    }
  }, [handleTap]);

  const centerOnEmpire = useCallback(() => {
    if (!chunks || !userUid) return;
    const canvas = canvasRef.current;
    let sumX = 0, sumY = 0, count = 0;
    for (const chunk of Object.values(chunks)) {
      if (!chunk.pixels) continue;
      for (const [key, data] of Object.entries(chunk.pixels)) {
        if (data.ownerId === userUid) {
          const [gx, gy] = key.split('_').map(Number);
          sumX += gx; sumY += gy; count++;
        }
      }
    }
    if (count === 0) return;
    const { scale } = stateRef.current;
    const ps = basePS * scale;
    stateRef.current.panX = canvas.width / 2 - (sumX / count) * ps;
    stateRef.current.panY = canvas.height / 2 - (sumY / count) * ps;
  }, [chunks, userUid, basePS]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={typeof window !== 'undefined' ? window.innerWidth : 412}
        height={380}
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      <button onClick={centerOnEmpire} style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(6,3,15,0.92)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(174,156,255,0.3)', color: '#ffe9a8',
        fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
      }}>◎ Il mio impero</button>
    </div>
  );
}
