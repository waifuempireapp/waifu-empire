// src/app/page.jsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/gioco');
    else router.replace('/login');
  }, [user, loading, router]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20,
    }}>
      <div className="glow-pulse" style={{
        fontSize: 60, color: '#f59e0b',
        fontFamily: 'Cinzel, serif',
      }}>♛</div>
      <div style={{
        fontFamily: 'Cinzel, serif', letterSpacing: 6,
        background: 'linear-gradient(135deg, #f59e0b, #ec4899, #a855f7)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        fontSize: 24,
      }}>
        IMPERO DELLE WAIFU
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: 3 }}>caricamento...</div>
    </div>
  );
}
