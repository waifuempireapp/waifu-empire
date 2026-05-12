'use client';
import { useState, useEffect } from 'react';
import { getFriendRequests, getUserProfile } from '@/lib/firestoreService';

export default function FriendRequestsList({ user, onUpdate }) {
  const [richieste, setRichieste] = useState([]);
  const [profiloMap, setProfiloMap] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    carica();
  }, [user]);

  const carica = async () => {
    const list = await getFriendRequests(user.uid);
    setRichieste(list);
    const profiles = await Promise.all(list.map(r => getUserProfile(r.fromUid)));
    const map = {};
    list.forEach((r, i) => { map[r.fromUid] = profiles[i]; });
    setProfiloMap(map);
  };

  const rispondi = async (friendshipId, azione) => {
    setBusy(true);
    try {
      const token = await user.getIdToken();
      if (azione === 'accept') {
        await fetch('/api/friends/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ friendshipId }),
        });
      } else {
        await fetch('/api/friends/remove', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ friendshipId }),
        });
      }
      await carica();
      onUpdate?.();
    } finally { setBusy(false); }
  };

  if (richieste.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 8, fontFamily: 'Orbitron', letterSpacing: 2, color: 'rgba(238,232,220,0.5)', marginBottom: 10 }}>
        RICHIESTE IN ARRIVO ({richieste.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {richieste.map(r => {
          const p = profiloMap[r.fromUid];
          return (
            <div key={r.id} style={{
              background: 'rgba(245,166,35,0.05)',
              border: '1px solid rgba(245,166,35,0.2)',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#f5a623', fontWeight: 700 }}>
                  {p?.nomeImpero || r.fromUid.slice(0, 8)}
                </div>
                <div style={{ fontSize: 9, opacity: 0.4, fontFamily: 'Orbitron', letterSpacing: 1, marginTop: 2 }}>
                  {p?.friendId}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={busy}
                  onClick={() => rispondi(r.id, 'accept')}
                  style={{
                    background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.4)',
                    borderRadius: 7, color: '#00e676',
                    fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer',
                  }}
                >✓ ACCETTA</button>
                <button
                  disabled={busy}
                  onClick={() => rispondi(r.id, 'reject')}
                  style={{
                    background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)',
                    borderRadius: 7, color: '#ff4d4d',
                    fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer',
                  }}
                >✕ RIFIUTA</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
