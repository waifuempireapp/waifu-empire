'use client';
import { useState, useEffect } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';

export default function OffersPanel({ user, onClose }) {
  const [offers, setOffers] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const loadOffers = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/mappa/offers', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setOffers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOffers(); }, []);

  const handleAction = async (offerId, action) => {
    setActing(offerId);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/mappa/offers/${offerId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await loadOffers();
    } finally {
      setActing(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.95)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase' }}>Territorio</div>
          <div style={{ fontFamily: FF.display, fontSize: 18, color: '#fff', fontWeight: 800 }}>Offerte</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(241,235,255,0.3)', padding: 40 }}>Caricamento…</div>
        ) : (
          <>
            {offers.incoming.length > 0 && (
              <Section title="Offerte in entrata" color={C.sakura}>
                {offers.incoming.map(o => (
                  <OfferCard key={o.id} offer={o} type="incoming" onAction={handleAction} acting={acting} />
                ))}
              </Section>
            )}
            {offers.outgoing.length > 0 && (
              <Section title="Tue offerte" color={C.aqua}>
                {offers.outgoing.map(o => (
                  <OfferCard key={o.id} offer={o} type="outgoing" onAction={handleAction} acting={acting} />
                ))}
              </Section>
            )}
            {offers.incoming.length === 0 && offers.outgoing.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(241,235,255,0.3)', padding: 60, fontFamily: FF.body, fontSize: 14 }}>
                Nessuna offerta in corso
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.2em', color, textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function OfferCard({ offer, type, onAction, acting }) {
  const statusColor = { pending: '#ffe9a8', accepted: '#58e0a3', rejected: '#ff5b6c', expired: '#6b6390' };
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(174,156,255,0.15)',
      borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: FF.mono, fontSize: 12, color: 'rgba(241,235,255,0.7)' }}>
          Pixel ({offer.pixelX}, {offer.pixelY})
        </div>
        <span style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: statusColor[offer.status] || '#ffe9a8' }}>
          {offer.status}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: type === 'incoming' && offer.status === 'pending' ? 12 : 0 }}>
        <KissesIcon size={14} />
        <span style={{ fontFamily: FF.display, fontSize: 16, color: '#f5c560', fontWeight: 700 }}>{offer.amount}</span>
        <span style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(241,235,255,0.4)' }}>kisses</span>
      </div>
      {type === 'incoming' && offer.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onAction(offer.id, 'accept')}
            disabled={acting === offer.id}
            style={actionBtn('#58e0a3', 'rgba(88,224,163,0.12)')}
          >✓ Accetta</button>
          <button
            onClick={() => onAction(offer.id, 'reject')}
            disabled={acting === offer.id}
            style={actionBtn('#ff5b6c', 'rgba(255,91,108,0.12)')}
          >✕ Rifiuta</button>
        </div>
      )}
    </div>
  );
}

function actionBtn(color, bg) {
  return {
    flex: 1, padding: '8px', background: bg,
    border: `1px solid ${color}55`, borderRadius: 10, color,
    fontFamily: "'Saira Condensed', sans-serif", fontSize: 11,
    letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
  };
}
