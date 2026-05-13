'use client';
import { useState, useEffect, useCallback } from 'react';
import TradeIncomingModal from './TradeIncomingModal';
import TradePendingConfirmModal from './TradePendingConfirmModal';
import TradeReceiveAnimation from './TradeReceiveAnimation';

function TradeResetCountdown({ tradesResetAt }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const calc = () => {
      let target;
      if (tradesResetAt?.toDate) target = tradesResetAt.toDate();
      else if (tradesResetAt?.seconds) target = new Date(tradesResetAt.seconds * 1000);
      else if (tradesResetAt) target = new Date(tradesResetAt);
      else { setRemaining(''); return; }
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining('in aggiornamento…'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [tradesResetAt]);
  if (!remaining) return null;
  return <span style={{ color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 7 }}>⏱ reset {remaining}</span>;
}

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

const TRADES_PER_PAGE = 10;

function getStatusLabel(trade, uid) {
  if (trade.status === 'pending_response') return { text: 'In attesa di risposta', color: '#f5a623' };
  if (trade.status === 'pending_confirm')  return { text: 'In attesa di conferma', color: '#42a5f5' };
  if (trade.status === 'cancelled')        return { text: 'Annullato', color: '#9e9e9e' };
  if (trade.status === 'expired')          return { text: 'Scaduto', color: '#ff4d4d' };
  if (trade.status === 'completed') {
    const seenFrom = !!trade.seenByFromUid;
    const seenTo   = !!trade.seenByToUid;
    if (seenFrom && seenTo)  return { text: 'Completato 2/2 ✓', color: '#9e9e9e' };
    if (seenFrom || seenTo)  return { text: 'Completato 1/2', color: '#00e676' };
    return { text: 'Completato', color: '#00e676' };
  }
  return { text: trade.status, color: '#9e9e9e' };
}

const DAILY_LIMIT = 5;

export default function ScambiList({ user, profilo, collezione, waifuCat, initialData, onBadgeChange, onRefresh, onCollectionRefresh }) {
  const [trades, setTrades] = useState(initialData?.trades || []);
  const [loading, setLoading] = useState(!initialData);
  const [page, setPage] = useState(0); // paginazione client-side
  const [errore, setErrore] = useState(null);
  const [tradeAperto, setTradeAperto] = useState(null); // { trade, tipo: 'incoming' | 'confirm' }
  const [animazione, setAnimazione] = useState(null); // waifu ricevuta lato B
  const [viewedCompletedIds, setViewedCompletedIds] = useState(new Set()); // trade completed già visti

  // Aggiorna badge se initialData già disponibile
  useEffect(() => {
    if (initialData) {
      onBadgeChange?.(initialData.pendingCount || 0);
      setLoading(false);
    }
  }, []);

  const carica = useCallback(async () => {
    setLoading(true);
    setErrore(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento');
      const fetchedTrades = data.trades || [];
      setTrades(fetchedTrades);

      // Cerca completati non visti dove questo utente è B (toUid) — deve vedere l'animazione
      const newlyCompleted = fetchedTrades.filter(t =>
        t.status === 'completed' &&
        t.toUid === user.uid &&
        !viewedCompletedIds.has(t.id)
      );

      // Badge = pending + unseen completed per B
      const badge = (data.pendingCount || 0) + newlyCompleted.length;
      onBadgeChange?.(badge);

      // Se ci sono completati non visti, mostra animazione per il primo
      if (newlyCompleted.length > 0 && !animazione && !tradeAperto) {
        const trade = newlyCompleted[0];
        const receivedWaifuId = trade.fromWaifuId; // B riceve la waifu di A
        const received = waifuCat.find(w => w.id === receivedWaifuId);
        setViewedCompletedIds(prev => new Set([...prev, trade.id]));
        if (received) setAnimazione({ waifu: received, isNew: !collezione?.waifu?.[receivedWaifuId], tradeId: trade.id });
      }
    } catch (e) { setErrore(e.message); }
    finally { setLoading(false); }
  }, [user, waifuCat, collezione, viewedCompletedIds, animazione, tradeAperto]);

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
    carica(); // B ha risposto — aggiorna la lista
  };

  if (animazione) {
    return (
      <TradeReceiveAnimation
        waifu={animazione.waifu}
        isNew={animazione.isNew}
        onComplete={async () => {
          // Marca lo scambio come visto da questo utente → stato 1/2 o 2/2
          if (animazione.tradeId) {
            try {
              const token = await user.getIdToken();
              await fetch('/api/trades/seen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ tradeId: animazione.tradeId }),
              });
            } catch { /* non critico */ }
          }
          setAnimazione(null);
          onCollectionRefresh?.();
          carica();
        }}
      />
    );
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
        profilo={profilo}
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
        collezione={collezione}
        user={user}
        onDone={(esito) => {
          setTradeAperto(null);
          if (esito === 'completed') {
            // A ha già visto l'animazione in TradePendingConfirmModal — non mostrarne un'altra
            // Aggiorna solo la collezione e la lista scambi
            onCollectionRefresh?.();
            carica();
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
  // "completato 2/2" (entrambi hanno visto) → solo storici senza azioni
  const terminati = trades.filter(t => !['pending_response', 'pending_confirm'].includes(t.status));

  // Paginazione sui terminati (10 per pagina)
  const totalPages = Math.ceil(terminati.length / TRADES_PER_PAGE);
  const terminatiPagina = terminati.slice(page * TRADES_PER_PAGE, (page + 1) * TRADES_PER_PAGE);

  const TradeLine = ({ trade }) => {
    const colore = RARITA_COLORI[trade.rarita] || '#f5a623';
    const statusInfo = getStatusLabel(trade, uid);
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

  const haTradePass = profilo?.tradePass === true;
  const tradesToday = profilo?.tradesToday ?? 0;
  const tradesResetAt = profilo?.tradesResetAt;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Counter scambi giornalieri + countdown reset */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '8px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)', letterSpacing: 1 }}>SCAMBI OGGI</div>
        {haTradePass ? (
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#00e676' }}>✓ TRADE PASS — ILLIMITATI</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700 }}>
              <span style={{ color: tradesToday >= DAILY_LIMIT ? '#ff4d4d' : '#eedcd4' }}>{tradesToday}</span>
              <span style={{ color: 'rgba(238,232,220,0.35)' }}>/{DAILY_LIMIT}</span>
              {tradesToday < DAILY_LIMIT && (
                <span style={{ color: '#00e676', marginLeft: 6, fontSize: 8 }}>({DAILY_LIMIT - tradesToday} rimasti)</span>
              )}
            </div>
            {tradesResetAt && <TradeResetCountdown tradesResetAt={tradesResetAt} />}
          </div>
        )}
      </div>

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
            {terminatiPagina.map(t => <TradeLine key={t.id} trade={t} />)}
          </div>
          {/* Paginazione */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: page === 0 ? 'rgba(255,255,255,0.2)' : '#eedcd4', fontFamily: 'Orbitron', fontSize: 9, padding: '5px 12px', cursor: page === 0 ? 'not-allowed' : 'pointer' }}>← Prec</button>
              <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.5)' }}>{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: page >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : '#eedcd4', fontFamily: 'Orbitron', fontSize: 9, padding: '5px 12px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}>Succ →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
