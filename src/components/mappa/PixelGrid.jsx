'use client';
import { useRef, useEffect, useCallback, useState } from 'react';

const BASE_PIXEL_SIZE = 8;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const GRID_SIZE = 50;
const CPU_COLOR = '#444455';
const OCEAN_COLOR = '#0d1a2e';

export default function PixelGrid({ chunks, userUid, onPixelSelect, selectedPixel, landSet }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ panX: 0, panY: 0, scale: 1 });
  const dragRef  = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const pinchRef = useRef({ active: false, dist: 0, midX: 0, midY: 0 });
  const [, forceRedraw] = useState(0);

  const pixelColors = useRef({});
  useEffect(() => {
    const map = {};
    if (chunks) {
      for (const chunk of Object.values(chunks)) {
        if (chunk.pixels) {
          for (const [key, data] of Object.entries(chunk.pixels)) {
            map[key] = data.ownerId === 'CPU' ? CPU_COLOR : (data.ownerColor || '#ff85b6');
          }
        }
      }
    }
    pixelColors.current = map;
    redraw();
  }, [chunks]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { panX, panY, scale } = stateRef.current;
    const ps = BASE_PIXEL_SIZE * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = OCEAN_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const key = `${gx}_${gy}`;
        const sx = gx * ps + panX;
        const sy = gy * ps + panY;
        if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue;

        // Se landSet è definito e questo pixel non è terra, salta (ocean)
        if (landSet && !landSet.has(key)) continue;

        const color = pixelColors.current[key] || CPU_COLOR;
        ctx.fillStyle = color;
        ctx.fillRect(sx, sy, ps - 1, ps - 1);
      }
    }

    // Highlight selezione
    if (selectedPixel) {
      const { x, y } = selectedPixel;
      const sx = x * ps + panX;
      const sy = y * ps + panY;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, ps + 1, ps + 1);
    }

    // Griglia sottile
    ctx.strokeStyle = 'rgba(174,156,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * ps + panX, panY);
      ctx.lineTo(i * ps + panX, GRID_SIZE * ps + panY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(panX, i * ps + panY);
      ctx.lineTo(GRID_SIZE * ps + panX, i * ps + panY);
      ctx.stroke();
    }
  }, [selectedPixel, landSet]);

  useEffect(() => { redraw(); }, [redraw]);

  // ── PAN (1 dito / mouse) ──────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.touches?.length === 2) return; // pinch gestito separatamente
    dragRef.current = {
      active: true,
      startX: e.clientX ?? e.touches?.[0]?.clientX,
      startY: e.clientY ?? e.touches?.[0]?.clientY,
      panX: stateRef.current.panX,
      panY: stateRef.current.panY,
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active || pinchRef.current.active) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    stateRef.current.panX = dragRef.current.panX + (cx - dragRef.current.startX);
    stateRef.current.panY = dragRef.current.panY + (cy - dragRef.current.startY);
    redraw();
  }, [redraw]);

  const onPointerUp = useCallback((e) => {
    if (pinchRef.current.active) return;
    const cx = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const cy = e.clientY ?? e.changedTouches?.[0]?.clientY;
    const dx = Math.abs(cx - dragRef.current.startX);
    const dy = Math.abs(cy - dragRef.current.startY);
    dragRef.current.active = false;

    if (dx < 5 && dy < 5) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { panX, panY, scale } = stateRef.current;
      const ps = BASE_PIXEL_SIZE * scale;
      const lx = cx - rect.left - panX;
      const ly = cy - rect.top - panY;
      const gx = Math.floor(lx / ps);
      const gy = Math.floor(ly / ps);
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        const key = `${gx}_${gy}`;
        // Non selezionare pixel oceano
        if (landSet && !landSet.has(key)) return;
        const chunkCol = Math.floor(gx / 10);
        const chunkRow = Math.floor(gy / 10);
        const chunkId = `chunk_${chunkCol}_${chunkRow}`;
        const pixelData = chunks?.[chunkId]?.pixels?.[key] ?? { ownerId: 'CPU', ownerColor: CPU_COLOR, ownerName: 'CPU' };
        onPixelSelect?.({ x: gx, y: gy, ...pixelData });
      }
    }
  }, [chunks, onPixelSelect, landSet]);

  // ── PINCH-TO-ZOOM (2 dita) ───────────────────────────────────────────────
  const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  const getMid  = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      dragRef.current.active = false;
      pinchRef.current = {
        active: true,
        dist: getDist(e.touches[0], e.touches[1]),
        midX: getMid(e.touches[0], e.touches[1]).x,
        midY: getMid(e.touches[0], e.touches[1]).y,
        panX: stateRef.current.panX,
        panY: stateRef.current.panY,
        scale: stateRef.current.scale,
      };
      e.preventDefault();
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const newDist = getDist(e.touches[0], e.touches[1]);
      const mid = getMid(e.touches[0], e.touches[1]);
      const ratio = newDist / pinchRef.current.dist;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRef.current.scale * ratio));

      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const midLocal = { x: pinchRef.current.midX - rect.left, y: pinchRef.current.midY - rect.top };

      // Zoom centrato sul punto di pinch
      const scaleDiff = newScale / pinchRef.current.scale;
      stateRef.current.panX = midLocal.x + (pinchRef.current.panX - midLocal.x) * scaleDiff;
      stateRef.current.panY = midLocal.y + (pinchRef.current.panY - midLocal.y) * scaleDiff;
      stateRef.current.scale = newScale;
      redraw();
    }
  }, [redraw]);

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      pinchRef.current.active = false;
    }
  }, []);

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
    const ps = BASE_PIXEL_SIZE * scale;
    stateRef.current.panX = canvas.width / 2 - (sumX / count) * ps;
    stateRef.current.panY = canvas.height / 2 - (sumY / count) * ps;
    redraw();
  }, [chunks, userUid, redraw]);

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
      }}>
        ◎ Il mio impero
      </button>
    </div>
  );
}
