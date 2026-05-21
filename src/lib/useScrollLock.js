'use client';
import { useEffect } from 'react';

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;

    // Salva la posizione di scroll corrente
    const scrollY = window.scrollY;
    const body = document.body;

    // CSS: overflow hidden (desktop + Android)
    body.classList.add('modal-open');

    // iOS fix: position fixed con top negativo mantiene lo scroll fermo
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      body.classList.remove('modal-open');
      body.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      // Ripristina la posizione di scroll
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
