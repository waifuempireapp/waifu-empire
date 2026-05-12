'use client';
import { useState, useEffect } from 'react';
import { getFriendsList, getFriendshipDoc } from '@/lib/firestoreService';

export default function FriendsList({ user }) {
  const [amici, setAmici] = useState([]);

  useEffect(() => {
    if (!user) return;
    carica();
  }, [user]);

  const carica = async () => {
    const list = await getFriendsList(user.uid);
    setAmici(list);
  };

  const rimuovi = async (amicoUid) => {
    const friendship = await getFriendshipDoc(user.uid, amicoUid);
    if (!friendship) return;
    const token = await user.getIdToken();
    await fetch('/api/friends/remove', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendshipId: friendship.id }),
    });
    await carica();
  };

  return (
    <div>
      <div style={{ fontSize: 8, fontFamily: 'Orbitron', letterSpacing: 2, color: 'rgba(238,232,220,0.5)', marginBottom: 10 }}>
        AMICI ({amici.length})
      </div>
      {amici.length === 0 ? (
        <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.35)', fontFamily: 'Fredoka', textAlign: 'center', padding: '20px 0' }}>
          Nessun amico ancora. Condividi il tuo Friend ID!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {amici.map(a => (
            <div key={a.id} style={{
              background: 'rgba(6,3,15,0.5)',
              border: '1px solid rgba(245,166,35,0.15)',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#eedcd4', fontWeight: 700 }}>
                  {a.nomeImpero || a.id.slice(0, 8)}
                </div>
                <div style={{ fontSize: 9, opacity: 0.4, fontFamily: 'Orbitron', letterSpacing: 1, marginTop: 2 }}>
                  {a.friendId}
                </div>
              </div>
              <button
                onClick={() => rimuovi(a.id)}
                style={{
                  background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.25)',
                  borderRadius: 7, color: '#ff4d4d',
                  fontFamily: 'Orbitron', fontSize: 8, padding: '5px 10px', cursor: 'pointer',
                }}
              >RIMUOVI</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
