// src/app/gioco/_redesign/Amici.jsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { getFriendsList, getFriendRequests } from '@/lib/firestoreService';
import FriendIdDisplay from '@/components/FriendIdDisplay';
import AddFriendForm from '@/components/AddFriendForm';
import FriendRequestsList from '@/components/FriendRequestsList';
import FriendsList from '@/components/FriendsList';
import ScambiList from '@/components/ScambiList';
import { C, FF, ScreenTitle, SubTabBar } from './_shared';

export function AmiciTab({ user, profilo, collezione, waifuCat, onCollectionRefresh }) {
  const [subTab, setSubTab] = useState('amici');
  const [scambiBadge, setScambiBadge] = useState(0);
  const tradeEnabled = process.env.NEXT_PUBLIC_TRADE_ENABLED === 'true';

  const [amici, setAmici] = useState(null);
  const [richieste, setRichieste] = useState(null);
  const [tradesInitialData, setTradesInitialData] = useState(null);

  const caricaAmici = useCallback(async () => {
    const [friendList, reqList] = await Promise.all([
      getFriendsList(user.uid).catch(() => []),
      getFriendRequests(user.uid).catch(() => []),
    ]);
    setAmici(friendList);
    setRichieste(reqList);
  }, [user.uid]);

  const caricaScambi = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/list', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTradesInitialData({ trades: data.trades || [], pendingCount: data.pendingCount || 0 });
        setScambiBadge(data.pendingCount || 0);
      }
    } catch { /* ignora */ }
  }, [user]);

  useEffect(() => {
    caricaAmici();
    if (tradeEnabled) caricaScambi();
  }, [caricaAmici, caricaScambi, tradeEnabled]);

  return (
    <div className="fade-in" style={{
      maxWidth: 540, margin: '0 auto', paddingTop: 14,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <ScreenTitle
        kicker="Network · Stagione 7"
        title={<><span style={{ color: C.sakura }}>♥</span> <span className="shimmer-text">Amici & Scambi</span></>}
        sub={tradeEnabled
          ? 'Connetti il tuo impero, scambia carte e cresci insieme.'
          : 'Aggiungi amici per vedere le loro attività e crescere insieme.'}
        color={C.sakura}
      />

      {tradeEnabled && (
        <SubTabBar
          value={subTab}
          onChange={setSubTab}
          tabs={[
            { value: 'amici', label: '👥 Amici' },
            { value: 'scambi', label: '↔ Scambi', badge: scambiBadge },
          ]}
        />
      )}

      {subTab === 'amici' ? (
        amici === null ? (
          <LoadingHint label="Caricamento amici…" color={C.sakura}/>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FriendIdDisplay friendId={profilo?.friendId} />
            <AddFriendForm user={user} />
            <FriendRequestsList richieste={richieste || []} user={user} onUpdate={caricaAmici} />
            <FriendsList amici={amici} user={user} onUpdate={caricaAmici} />
          </div>
        )
      ) : (
        <ScambiList
          user={user}
          profilo={profilo}
          collezione={collezione}
          waifuCat={waifuCat || []}
          initialData={tradesInitialData}
          onBadgeChange={(n) => setScambiBadge(n)}
          onRefresh={caricaScambi}
          onCollectionRefresh={onCollectionRefresh}
        />
      )}
    </div>
  );
}

function LoadingHint({ label, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: '32px 16px',
      color: 'rgba(241,235,255,0.45)',
      fontFamily: FF.label, fontSize: 10,
      letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700,
    }}>
      <span style={{
        display: 'inline-block', width: 18, height: 18,
        borderRadius: '50%', border: `2px solid ${color}`,
        borderTopColor: 'transparent', verticalAlign: 'middle',
        marginRight: 10, animation: 'spinSlow 1s linear infinite',
      }}/>
      {label}
    </div>
  );
}
