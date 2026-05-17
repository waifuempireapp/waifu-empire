'use client';
import { useRef, useEffect, useCallback, useState } from 'react';

const PIXEL_SIZE = 8;   // px su schermo per ogni pixel della griglia
const GRID_SIZE = 50;
const CPU_COLOR = '#444455';

export default function PixelGrid({ chunks, userUid, onPixelSelect, selectedPixel }) {
  const canvasRef = useRef(null);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const [panState, setPanState] = useState({ x: 0, y: 0 });

  const totalSize = GRID_SIZE * PIXEL_SIZE;

  // Costruisce lookup flat pixel → colore da tutti i chunk
  const pixelColors = useRef({});
  useEffect(() => {
    const map = {};
    if (chunks) {
      for (const chunk of Object.values(chunks)) {
        if (chunk.pixels) {
          for (const [key, data] of Object.entries(chunk.pixels)) {
            map[key] = data.ownerId === 'CPU'
              ? CPU_COLOR
              : (data.ownerColor || '#ff85b6');
          }
        }
      }
    }
    pixelColors.current = map;
    drawCanvas();
  }, [chunks]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x: panX, y: panY } = panRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#07051a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw pixels
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const key = `${gx}_${gy}`;
        const color = pixelColors.current[key] || CPU_COLOR;
        const sx = gx * PIXEL_SIZE + panX;
        const sy = gy * PIXEL_SIZE + panY;
        if (sx + PIXEL_SIZE < 0 || sx > canvas.width || sy + PIXEL_SIZE < 0 || sy > canvas.height) continue;

        ctx.fillStyle = color;
        ctx.fillRect(sx, sy, PIXEL_SIZE - 1, PIXEL_SIZE - 1);
      }
    }

    // Draw selection highlight
    if (selectedPixel) {
      const { x, y } = selectedPixel;
      const sx = x * PIXEL_SIZE + panX;
      const sy = y * PIXEL_SIZE + panY;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, PIXEL_SIZE + 1, PIXEL_SIZE + 1);
    }

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(174,156,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * PIXEL_SIZE + panX, panY);
      ctx.lineTo(i * PIXEL_SIZE + panX, GRID_SIZE * PIXEL_SIZE + panY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(panX, i * PIXEL_SIZE + panY);
      ctx.lineTo(GRID_SIZE * PIXEL_SIZE + panX, i * PIXEL_SIZE + panY);
      ctx.stroke();
    }
  }, [selectedPixel]);

  useEffect(() => { drawCanvas(); }, [panState, drawCanvas]);

  // Pan handlers
  const onPointerDown = useCallback((e) => {
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    panRef.current = { x: dragRef.current.panX + dx, y: dragRef.current.panY + dy };
    setPanState({ ...panRef.current });
  }, []);

  const onPointerUp = useCallback((e) => {
    const dx = Math.abs(e.clientX - dragRef.current.startX);
    const dy = Math.abs(e.clientY - dragRef.current.startY);
    dragRef.current.isDragging = false;

    // Se quasi fermo → click su pixel
    if (dx < 4 && dy < 4) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - panRef.current.x;
      const cy = e.clientY - rect.top - panRef.current.y;
      const gx = Math.floor(cx / PIXEL_SIZE);
      const gy = Math.floor(cy / PIXEL_SIZE);
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        const key = `${gx}_${gy}`;
        const chunkCol = Math.floor(gx / 10);
        const chunkRow = Math.floor(gy / 10);
        const chunkId = `chunk_${chunkCol}_${chunkRow}`;
        const pixelData = chunks?.[chunkId]?.pixels?.[key] ?? {
          ownerId: 'CPU', ownerColor: CPU_COLOR, ownerName: 'CPU',
        };
        onPixelSelect?.({ x: gx, y: gy, ...pixelData });
      }
    }
  }, [chunks, onPixelSelect]);

  const centerOnEmpire = useCallback(() => {
    if (!chunks || !userUid) return;
    const canvas = canvasRef.current;
    let sumX = 0, sumY = 0, count = 0;
    for (const chunk of Object.values(chunks)) {
      if (chunk.pixels) {
        for (const [key, data] of Object.entries(chunk.pixels)) {
          if (data.ownerId === userUid) {
            const [gx, gy] = key.split('_').map(Number);
            sumX += gx; sumY += gy; count++;
          }
        }
      }
    }
    if (count === 0) return;
    const avgX = sumX / count;
    const avgY = sumY / count;
    if (canvas) {
      panRef.current = {
        x: canvas.width / 2 - avgX * PIXEL_SIZE,
        y: canvas.height / 2 - avgY * PIXEL_SIZE,
      };
      setPanState({ ...panRef.current });
    }
  }, [chunks, userUid]);

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
      />
      <button
        onClick={centerOnEmpire}
        style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(6,3,15,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(174,156,255,0.3)', color: '#ffe9a8',
          fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        }}
      >
        ◎ Il mio impero
      </button>
    </div>
  );
}
