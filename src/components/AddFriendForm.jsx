'use client';
import { useState } from 'react';

export default function AddFriendForm({ user }) {
  const [friendId, setFriendId] = useState('');
  const [stato, setStato] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [messaggio, setMessaggio] = useState('');

  const invia = async () => {
    const id = friendId.trim().toUpperCase();
    if (id.length !== 8) { setStato('error'); setMessaggio('Il Friend ID deve essere di 8 caratteri'); return; }
    setStato('loading');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/friends/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendId: id }),
      });
      const data = await res.json();
      if (res.ok) { setStato('ok'); setMessaggio('Richiesta inviata!'); setFriendId(''); }
      else { setStato('error'); setMessaggio(data.error || 'Errore'); }
    } catch (_) { setStato('error'); setMessaggio('Errore di rete'); }
    setTimeout(() => setStato(null), 3000);
  };

  return (
    <div style={{
      background: 'rgba(6,3,15,0.6)',
      border: '1px solid rgba(245,166,35,0.15)',
      borderRadius: 12,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 8, fontFamily: 'Orbitron', letterSpacing: 2, color: 'rgba(238,232,220,0.5)', marginBottom: 10 }}>
        AGGIUNGI AMICO
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={friendId}
          onChange={e => setFriendId(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="ES: AB3X9K7M"
          maxLength={8}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(245,166,35,0.25)',
            borderRadius: 8,
            color: '#eedcd4', fontFamily: 'Orbitron', fontSize: 14,
            letterSpacing: 3, padding: '8px 12px', outline: 'none',
          }}
        />
        <button
          onClick={invia}
          disabled={stato === 'loading'}
          style={{
            background: 'rgba(245,166,35,0.12)',
            border: '1px solid rgba(245,166,35,0.35)',
            borderRadius: 8, color: '#f5a623',
            fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 1,
            padding: '8px 14px', cursor: stato === 'loading' ? 'wait' : 'pointer',
          }}
        >
          {stato === 'loading' ? '…' : 'INVIA'}
        </button>
      </div>
      {stato && stato !== 'loading' && (
        <div style={{
          marginTop: 8, fontSize: 11,
          color: stato === 'ok' ? '#00e676' : '#ff4d4d',
          fontFamily: 'Orbitron', letterSpacing: 1,
        }}>
          {messaggio}
        </div>
      )}
    </div>
  );
}
