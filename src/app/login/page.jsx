// src/app/login/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getUserProfile, createUserProfile } from '@/lib/firestoreService';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) verificaProfilo();
  }, [user, loading]);

  const verificaProfilo = async () => {
    const p = await getUserProfile(user.uid);
    if (p) router.replace('/gioco');
    else router.replace('/onboarding');
  };

  const loginGoogle = async () => {
    setBusy(true); setErrore('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setErrore(traduciErrore(e.code));
    } finally { setBusy(false); }
  };

  const loginEmail = async (e) => {
    e.preventDefault();
    setBusy(true); setErrore('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setErrore(traduciErrore(err.code));
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="fade-up" style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(15,10,30,0.7)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 16, padding: 28,
        boxShadow: '0 0 40px rgba(168,85,247,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="glow-pulse" style={{ fontSize: 50, color: '#f59e0b' }}>♛</div>
          <h1 style={{
            fontFamily: 'Cinzel, serif', letterSpacing: 5,
            background: 'linear-gradient(135deg, #f59e0b, #ec4899, #a855f7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontSize: 24, margin: '12px 0 4px',
          }}>
            IMPERO DELLE WAIFU
          </h1>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#a855f7' }}>
            ⚜ {mode === 'login' ? 'ACCEDI' : 'REGISTRATI'} ⚜
          </div>
        </div>

        <button onClick={loginGoogle} disabled={busy} style={btnGoogle}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.7 39.7 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.6l6.2 5.2C42 35.7 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
          Accedi con Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.2)' }} />
          <span style={{ fontSize: 11, opacity: 0.5, letterSpacing: 2 }}>OPPURE</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(245,158,11,0.2)' }} />
        </div>

        <form onSubmit={loginEmail}>
          <input type="email" required placeholder="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" required placeholder="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} style={inputStyle} />
          {errore && <div style={{ color: '#ef4444', fontSize: 12, padding: '6px 0', textAlign: 'center' }}>⚠ {errore}</div>}
          <button type="submit" disabled={busy} style={btnPrimario}>
            {busy ? '...' : (mode === 'login' ? 'ACCEDI' : 'CREA ACCOUNT')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          {mode === 'login' ? (
            <span>Non hai un account? <button onClick={() => { setMode('register'); setErrore(''); }} style={btnLink}>Registrati</button></span>
          ) : (
            <span>Hai già un account? <button onClick={() => { setMode('login'); setErrore(''); }} style={btnLink}>Accedi</button></span>
          )}
        </div>
      </div>
    </div>
  );
}

function traduciErrore(code) {
  const m = {
    'auth/invalid-email': 'Email non valida',
    'auth/user-not-found': 'Utente non trovato',
    'auth/wrong-password': 'Password errata',
    'auth/email-already-in-use': 'Email già registrata',
    'auth/weak-password': 'Password troppo debole (min 6 caratteri)',
    'auth/popup-closed-by-user': 'Login annullato',
    'auth/network-request-failed': 'Errore di rete',
  };
  return m[code] || 'Errore: ' + code;
}

const inputStyle = {
  width: '100%', padding: 12, marginBottom: 10,
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 8, color: '#f5e6d3', fontFamily: 'inherit', fontSize: 14,
};

const btnPrimario = {
  width: '100%', padding: 12,
  background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  border: 'none', color: '#000', fontWeight: 600,
  fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: 3,
  borderRadius: 8, cursor: 'pointer', marginTop: 6,
};

const btnGoogle = {
  width: '100%', padding: 12,
  background: '#fff', color: '#3c4043',
  border: 'none', borderRadius: 8,
  fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
};

const btnLink = {
  background: 'none', border: 'none',
  color: '#f59e0b', cursor: 'pointer', fontSize: 12,
  textDecoration: 'underline', fontFamily: 'inherit',
};
