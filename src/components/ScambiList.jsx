'use client';
import { useState, useEffect } from 'react';
import TradeIncomingModal from './TradeIncomingModal';
import TradePendingConfirmModal from './TradePendingConfirmModal';
import TradeReceiveAnimation from './TradeReceiveAnimation';

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

const STATUS_LABEL = {
  pending_response: { text: 'In attesa di risposta', color: '#f5a623' },
  pending_confirm: { text: 'In attesa di conferma', color: '#42a5f5' },
  completed: { text: 'Completato', color: '#00e676' },
  cancelled: { text: 'Annullato', color: '#9e9e9e' },
  expired: { text: 'Scaduto', color: '#ff4d4d' },
};

export default function ScambiList({ user, collezione, waifuCat, initialData, onBadgeChange, onRefresh }) {
  const [trades, setTrades] = useState(initialData?.trades || []);
  const [loading, setLoading] = useState(!initialData);
  const [errore, setErrore] = useState(null);
  const [tradeAperto, setTradeAperto] = useState(null); // { trade, tipo: 'incoming' | 'confirm' }
  const [animazione, setAnimazione] = useState(null); // waifu ricevuta lato B (badge "nuovo")

  // Aggiorna badge se initialData già disponibile
  useEffect(() => {
    if (initialData) {
      onBadgeChange?.(initialData.pendingCount || 0);
      setLoading(false);
    }
  }, []);

  const carica = async () => {
    setLoading(true);
    setErrore(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento');
      setTrades(data.trades || []);
      onBadgeChange?.(data.pendingCount || 0);
    } catch (e) { setErrore(e.message); }
    finally { setLoading(false); }
  };

  // Carica solo se non c'è initialData già disponibile
  useEffect(() => { if (!initialData) carica(); }, []);

  const apriTrade = (trade) => {
    const uid = user.uid;
    if (trade.status === 'pending_response' && trade.toUid === uid) {
      setTradeAperto({ trade, tipo: 'incoming' });
    } else if (trade.status === 'pending_confirm' && trade.fromUid === uid) {
      setTradeAperto({ trade, tipo: 'confirm' });
    }
  };

  const onTradeDone = (esito) => {
    setTradeAperto(null);
    carica();
  };

  if (animazione) {
    return <TradeReceiveAnimation waifu={animazione} onComplete={() => { setAnimazione(null); carica(); }} />;
  }

  if (tradeAperto?.tipo === 'incoming') {
    // Arricchisci il trade con info waifu dal catalogo
    const fromCat = waifuCat.find(w => w.id === tradeAperto.trade.fromWaifuId);
    const enrichedTrade = {
      ...tradeAperto.trade,
      fromWaifuNome: fromCat?.nome || tradeAperto.trade.fromWaifuId,
      fromWaifuImmagine: fromCat?.asset_statica || fromCat?.asset_immersiva || fromCat?.immagine || null,
    };
    return (
      <TradeIncomingModal
        trade={enrichedTrade}
        collezione={collezione}
        waifuCat={waifuCat}
        user={user}
        onDone={onTradeDone}
        onCancel={() => setTradeAperto(null)}
      />
    );
  }

  if (tradeAperto?.tipo === 'confirm') {
    return (
      <TradePendingConfirmModal
        trade={tradeAperto.trade}
        waifuCat={waifuCat}
        user={user}
        onDone={(esito) => {
          setTradeAperto(null);
          if (esito === 'completed') {
            // Mostra animazione per la waifu ricevuta
            const received = waifuCat.find(w => w.id === tradeAperto.trade.toWaifuId);
            if (received) setAnimazione(received);
            else carica();
          } else { carica(); }
        }}
        onCancel={() => setTradeAperto(null)}
      />
    );
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 10 }}>
      Caricamento scambi…
    </div>
  );

  if (errore) return (
    <div style={{ textAlign: 'center', padding: 20, color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 10 }}>
      {errore}
    </div>
  );

  const uid = user.uid;
  const pending = trades.filter(t => t.status === 'pending_response' || t.status === 'pending_confirm');
  const terminati = trades.filter(t => !['pending_response', 'pending_confirm'].includes(t.status));

  const TradeLine = ({ trade }) => {
    const colore = RARITA_COLORI[trade.rarita] || '#f5a623';
    const statusInfo = STATUS_LABEL[trade.status] || { text: trade.status, color: '#9e9e9e' };
    const isMioTurno =
      (trade.status === 'pending_response' && trade.toUid === uid) ||
      (trade.status === 'pending_confirm' && trade.fromUid === uid);
    const isAzione = isMioTurno;

    const fromCat = waifuCat.find(w => w.id === trade.fromWaifuId);
    const toCat = waifuCat.find(w => w.id === trade.toWaifuId);
    const fromImg = fromCat?.asset_statica || fromCat?.immagine || null;
    const toImg = toCat?.asset_statica || toCat?.immagine || null;
    const fromNome = fromCat?.nome || trade.fromWaifuId || '?';
    const toNome = toCat?.nome || trade.toWaifuId || '?';

    return (
      <div style={{
        background: isAzione ? 'rgba(255,77,158,0.06)' : 'rgba(6,3,15,0.5)',
        border: `1px solid ${isAzione ? 'rgba(255,77,158,0.3)' : `${colore}20`}`,
        borderRadius: 12, padding: '12px 14px', cursor: isAzione ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
        onClick={() => isAzione && apriTrade(trade)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: '#eedcd4' }}>
            {trade.fromUid === uid
              ? <>Tu → <strong style={{ color: '#ff4d9e' }}>{trade.toName}</strong></>
              : <><strong style={{ color: '#ff4d9e' }}>{trade.fromName}</strong> → Tu</>
            }
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: statusInfo.color, letterSpacing: 1 }}>
            {statusInfo.text}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fromImg ? (
            <img src={fromImg} alt={fromNome} style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 4, border: `1px solid ${colore}30` }} />
          ) : (
            <div style={{ width: 36, height: 50, background: `${colore}10`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: colore }}>◈</div>
          )}
          <span style={{ color: 'rgba(238,232,220,0.4)', fontSize: 14 }}>↔</span>
          {trade.toWaifuId ? (
            toImg ? (
              <img src={toImg} alt={toNome} style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 4, border: `1px solid ${colore}30` }} />
            ) : (
              <div style={{ width: 36, height: 50, background: `${colore}10`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: colore }}>◈</div>
            )
          ) : (
            <div style={{ width: 36, height: 50, background: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'rgba(238,232,220,0.25)' }}>?</div>
          )}
          <div style={{ marginLeft: 4 }}>
            <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: '#eedcd4' }}>{fromNome}</div>
            {trade.toWaifuId && <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: '#eedcd4', marginTop: 2 }}>{toNome}</div>}
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: colore, marginTop: 2 }}>{trade.rarita}</div>
          </div>
          {isAzione && (
            <div style={{ marginLeft: 'auto', background: 'rgba(255,77,158,0.15)', border: '1px solid rgba(255,77,158,0.4)', borderRadius: 6, fontFamily: 'Orbitron', fontSize: 8, color: '#ff4d9e', padding: '4px 8px', letterSpacing: 1 }}>
              AZIONE RICHIESTA
            </div>
          )}
        </div>
      </div>
    );
  };

  if (trades.length === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>↔</div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(238,232,220,0.4)' }}>Nessuno scambio ancora.</div>
      <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.3)', marginTop: 4 }}>Apri il dettaglio di una waifu e premi SCAMBIA!</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pending.length > 0 && (
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 8 }}>
            SCAMBI ATTIVI ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(t => <TradeLine key={t.id} trade={t} />)}
          </div>
        </div>
      )}
      {terminati.length > 0 && (
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 8, marginTop: pending.length > 0 ? 12 : 0 }}>
            STORICI ({terminati.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {terminati.map(t => <TradeLine key={t.id} trade={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}
