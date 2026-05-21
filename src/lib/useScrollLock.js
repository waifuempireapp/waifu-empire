'use client';
import { useEffect } from 'react';

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [active]);
}
