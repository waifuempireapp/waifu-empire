'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile } from '@/lib/firestoreService';
import FriendIdDisplay from '@/components/FriendIdDisplay';
import AddFriendForm from '@/components/AddFriendForm';
import FriendRequestsList from '@/components/FriendRequestsList';
import FriendsList from '@/components/FriendsList';

export default function AmiciPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profilo, setProfilo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (user) getUserProfile(user.uid).then(p => { if (!p) router.replace('/onboarding'); else setProfilo(p); });
  }, [user, loading]);

  if (loading || !profilo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 40, color: '#ff2d78', fontFamily: 'Orbitron' }}>♥</div>
    </div>
  );

  const onUpdate = () => setRefreshKey(k => k + 1);

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(6,3,15)', padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/gioco')}
          style={{
            background: 'none', border: '1px solid rgba(245,166,35,0.3)',
            borderRadius: 8, color: '#f5a623',
            fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer',
          }}
        >← GIOCO</button>
        <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 900, color: '#ff2d78', letterSpacing: 3 }}>
          AMICI
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FriendIdDisplay friendId={profilo.friendId} />
        <AddFriendForm user={user} />
        <FriendRequestsList key={`req-${refreshKey}`} user={user} onUpdate={onUpdate} />
        <FriendsList key={`list-${refreshKey}`} user={user} />
      </div>
    </div>
  );
}
