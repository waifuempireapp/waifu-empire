// src/app/admin/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  listWaifu, listOutfit, listPose, listDrops,
  upsertWaifu, upsertOutfit, upsertPosa, upsertDrop,
  deleteCatalogo,
} from '@/lib/firestoreService';
import { uploadAsset, pathWaifu, pathOutfit, pathPosa } from '@/lib/storageService';
import {
  buildPromptPaperDoll, buildPromptCartaStatica, buildPromptCartaImmersiva,
  buildPromptOutfit, buildPromptPosa,
  ARCHETIPI, PALETTE, MOTORI_AI, suggerisciDiversificazione,
} from '@/lib/promptGenerator';
import { RARITA, COLORI_CAPELLI, SLOT_OUTFIT } from '@/lib/constants';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(null);
  const [tab, setTab] = useState('drops');
  const [waifu, setWaifu] = useState([]);
  const [outfit, setOutfit] = useState([]);
  const [pose, setPose] = useState([]);
  const [drops, setDrops] = useState([]);
  const [notif, setNotif] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase());
    const ok = adminEmails.includes(user.email?.toLowerCase());
    setAuthorized(ok);
    if (ok) carica();
  }, [user, loading]);

  const carica = async () => {
    const [w, o, p, d] = await Promise.all([listWaifu(), listOutfit(), listPose(), listDrops()]);
    setWaifu(w); setOutfit(o); setPose(p); setDrops(d);
  };

  const flash = (testo, colore = '#06d6a0') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2200);
  };

  if (loading || authorized === null) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glow-pulse" style={{ fontSize: 40, color: '#f59e0b' }}>♛</div>
    </div>;
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 16 }}>
        <div style={{ fontSize: 60 }}>🚫</div>
        <h2 style={{ fontFamily: 'Cinzel, serif', color: '#ef4444' }}>ACCESSO NEGATO</h2>
        <p style={{ color: '#d4c5b9' }}>La tua email <strong>{user.email}</strong> non è registrata come admin.</p>
        <p style={{ fontSize: 12, color: '#a0a0a0', maxWidth: 500, textAlign: 'center' }}>
          Aggiungi la tua email alla variabile d'ambiente <code>NEXT_PUBLIC_ADMIN_EMAILS</code> per accedere all'area amministrativa.
        </p>
        <button onClick={() => router.push('/gioco')} style={btnPrimario}>← TORNA AL GIOCO</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {notif && (
        <div style={{
          position: 'fixed', top: 16, left: '50%',
          background: 'rgba(0,0,0,0.92)',
          border: `1px solid ${notif.colore}`, color: notif.colore,
          padding: '10px 24px', borderRadius: 24,
          fontFamily: 'Cinzel, serif', letterSpacing: 2, fontSize: 12,
          zIndex: 200, animation: 'slideDown 0.3s ease-out',
          boxShadow: `0 0 25px ${notif.colore}50`,
        }}>
          ✦ {notif.testo} ✦
        </div>
      )}

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,5,21,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(245,158,11,0.3)',
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: 4, fontSize: 16 }}>⚙ AREA ADMIN</div>
          <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1 }}>Impero delle Waifu</div>
        </div>
        <a href="/gioco" style={{ ...btnPiccolo, textDecoration: 'none' }}>← AL GIOCO</a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '12px 16px', flexWrap: 'wrap', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
        {[
          { k: 'drops', l: '📦 Drops' },
          { k: 'waifu', l: '👑 Waifu' },
          { k: 'outfit', l: '✦ Outfit' },
          { k: 'pose', l: '⚜ Pose' },
          { k: 'distrib', l: '📊 Distribuzione' },
          { k: 'motori', l: '🤖 Motori AI' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '6px 16px',
            background: tab === t.k ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
            color: tab === t.k ? '#000' : '#f5e6d3',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, cursor: 'pointer',
            fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 1, fontWeight: 600,
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'drops' && <DropsTab drops={drops} waifu={waifu} outfit={outfit} pose={pose} ricarica={carica} flash={flash} />}
        {tab === 'waifu' && <WaifuTab waifu={waifu} ricarica={carica} flash={flash} />}
        {tab === 'outfit' && <OutfitTab outfit={outfit} ricarica={carica} flash={flash} />}
        {tab === 'pose' && <PoseTab pose={pose} waifu={waifu} ricarica={carica} flash={flash} />}
        {tab === 'distrib' && <DistribTab waifu={waifu} />}
        {tab === 'motori' && <MotoriTab />}
      </div>
    </div>
  );
}

// ============================================================
// TAB: DROPS
// ============================================================
function DropsTab({ drops, waifu, outfit, pose, ricarica, flash }) {
  const [ed, setEd] = useState(null);

  const nuovo = () => setEd({
    nome: 'Nuovo Drop',
    descrizione: '',
    inizio: new Date().toISOString().split('T')[0],
    fine: '',
    attivo: false,
    waifuIds: [],
    outfitIds: [],
    poseIds: [],
  });

  const salva = async (d) => {
    // Se attivo: disattiva tutti gli altri
    if (d.attivo) {
      for (const altro of drops) {
        if (altro.id !== d.id && altro.attivo) {
          await upsertDrop(altro.id, { ...altro, attivo: false });
        }
      }
    }
    await upsertDrop(d.id || null, { ...d, creato: d.creato || new Date() });
    flash('Drop salvato');
    setEd(null);
    ricarica();
  };

  const elimina = async (id) => {
    if (!confirm('Eliminare il drop? L\'azione è irreversibile.')) return;
    await deleteCatalogo('drops', id);
    flash('Drop eliminato');
    ricarica();
  };

  if (ed) {
    return <DropEditor drop={ed} setDrop={setEd} waifu={waifu} outfit={outfit} pose={pose}
      onSalva={salva} onAnnulla={() => setEd(null)} flash={flash} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>📦 GESTIONE DROP STAGIONALI</h2>
        <button onClick={nuovo} style={btnPrimario}>+ NUOVO DROP</button>
      </div>

      <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 12, marginBottom: 6 }}>ℹ COME FUNZIONANO I DROP</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.85 }}>
          Ogni drop è un set tematico di waifu, outfit e pose. <strong>Solo un drop alla volta può essere attivo</strong>.
          Quando un drop è attivo, i pacchetti pescano <strong>esclusivamente</strong> dai contenuti inclusi nel drop.
          I giocatori conservano per sempre i contenuti già ottenuti dai drop precedenti.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {drops.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>
            Nessun drop creato. Crea il tuo primo drop stagionale.
          </div>
        )}
        {drops.map(d => (
          <div key={d.id} style={{
            padding: 14, borderRadius: 10,
            background: 'rgba(0,0,0,0.4)',
            border: d.attivo ? '2px solid #06d6a0' : '1px solid rgba(245,158,11,0.2)',
            position: 'relative',
          }}>
            {d.attivo && (
              <div style={{ position: 'absolute', top: 8, right: 8, background: '#06d6a0', color: '#000', padding: '2px 8px', borderRadius: 12, fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>● ATTIVO</div>
            )}
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, color: '#f59e0b', letterSpacing: 1 }}>{d.nome}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{d.descrizione || 'Nessuna descrizione'}</div>
            <div style={{ fontSize: 11, marginTop: 8, color: '#a855f7' }}>
              👑 {d.waifuIds?.length || 0} waifu · ✦ {d.outfitIds?.length || 0} outfit · ⚜ {d.poseIds?.length || 0} pose
            </div>
            {d.inizio && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>📅 {d.inizio} {d.fine ? `→ ${d.fine}` : '(senza scadenza)'}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={() => setEd(d)} style={btnSecondario}>MODIFICA</button>
              <button onClick={() => elimina(d.id)} style={{ ...btnSecondario, borderColor: '#ef444480', color: '#ef4444' }}>ELIMINA</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DropEditor({ drop, setDrop, waifu, outfit, pose, onSalva, onAnnulla, flash }) {
  const [tabSel, setTabSel] = useState('waifu');

  const toggleId = (campo, id) => {
    const arr = drop[campo] || [];
    const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
    setDrop({ ...drop, [campo]: next });
  };

  // Suggerimenti diversificazione: solo waifu del drop
  const waifuDelDrop = waifu.filter(w => drop.waifuIds?.includes(w.id));
  const sugg = suggerisciDiversificazione(waifuDelDrop);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>📦 {drop.id ? 'MODIFICA' : 'NUOVO'} DROP</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onAnnulla} style={btnSecondario}>ANNULLA</button>
          <button onClick={() => onSalva(drop)} style={btnPrimario}>💾 SALVA</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Field label="Nome">
          <input value={drop.nome || ''} onChange={e => setDrop({ ...drop, nome: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Inizio">
          <input type="date" value={drop.inizio || ''} onChange={e => setDrop({ ...drop, inizio: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Fine (opzionale)">
          <input type="date" value={drop.fine || ''} onChange={e => setDrop({ ...drop, fine: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Stato">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(245,158,11,0.3)' }}>
            <input type="checkbox" checked={drop.attivo || false} onChange={e => setDrop({ ...drop, attivo: e.target.checked })} />
            <span style={{ fontSize: 12 }}>Drop ATTIVO (pescabile dai pacchetti)</span>
          </label>
        </Field>
      </div>

      <Field label="Descrizione">
        <textarea value={drop.descrizione || ''} onChange={e => setDrop({ ...drop, descrizione: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
      </Field>

      {/* Suggerimenti diversificazione */}
      {drop.waifuIds?.length > 0 && (
        <div style={{ marginTop: 14, padding: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8 }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 12, marginBottom: 8 }}>📊 ANTI-RIPETIZIONE</div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 6 }}><strong>Archetipi meno usati nel drop (suggeriti):</strong> {sugg.archetipiSuggeriti.slice(0, 3).map(a => `${a.nome} (${a.conta})`).join(', ')}</div>
            <div><strong>Palette meno usate nel drop (suggerite):</strong> {sugg.paletteSuggerite.slice(0, 3).map(p => `${p.nome} (${p.conta})`).join(', ')}</div>
          </div>
        </div>
      )}

      {/* Tabs selezione contenuti */}
      <div style={{ display: 'flex', gap: 6, marginTop: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { k: 'waifu', l: `👑 Waifu (${drop.waifuIds?.length || 0})`, items: waifu, campo: 'waifuIds' },
          { k: 'outfit', l: `✦ Outfit (${drop.outfitIds?.length || 0})`, items: outfit, campo: 'outfitIds' },
          { k: 'pose', l: `⚜ Pose (${drop.poseIds?.length || 0})`, items: pose, campo: 'poseIds' },
        ].map(t => (
          <button key={t.k} onClick={() => setTabSel(t.k)} style={{
            padding: '6px 14px',
            background: tabSel === t.k ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
            color: tabSel === t.k ? '#000' : '#f5e6d3',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, cursor: 'pointer',
            fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1, fontWeight: 600,
          }}>{t.l}</button>
        ))}
      </div>

      {[
        { k: 'waifu', items: waifu, campo: 'waifuIds' },
        { k: 'outfit', items: outfit, campo: 'outfitIds' },
        { k: 'pose', items: pose, campo: 'poseIds' },
      ].filter(t => t.k === tabSel).map(t => (
        <div key={t.k} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, maxHeight: 400, overflowY: 'auto', padding: 6 }}>
          {t.items.length === 0 && <div style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center', opacity: 0.6 }}>Nessun {t.k} creato. Crea {t.k} dalle altre tab.</div>}
          {t.items.map(item => {
            const sel = drop[t.campo]?.includes(item.id);
            const rar = RARITA[item.rarita] || RARITA.comune;
            return <div key={item.id} onClick={() => toggleId(t.campo, item.id)} style={{
              padding: 8, cursor: 'pointer',
              background: sel ? `linear-gradient(135deg, ${rar.colore}30, transparent)` : 'rgba(0,0,0,0.3)',
              border: sel ? `2px solid ${rar.colore}` : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={sel || false} readOnly style={{ accentColor: rar.colore }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{item.nome}</span>
              </div>
              <div style={{ fontSize: 10, color: rar.colore, marginTop: 2 }}>{'★'.repeat(rar.stelle)} {rar.nome}</div>
            </div>;
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TAB: WAIFU
// ============================================================
function WaifuTab({ waifu, ricarica, flash }) {
  const [ed, setEd] = useState(null);

  const nuova = () => setEd({
    nome: '',
    rarita: 'comune',
    tette: 3,
    taglia_piedi: 38,
    eta: 22,
    colore_capelli: 1,
    esperienza: 50,
    archetipo: ARCHETIPI[0].id,
    palette: PALETTE[0].id,
    fillers: { outfit: '', fanservice: '', posa: '' },
    asset_paperdoll: '',
    asset_statica: '',
    asset_immersiva: '',
  });

  const salva = async (w) => {
    const id = await upsertWaifu(w.id || null, w);
    flash('Waifu salvata');
    setEd(null);
    ricarica();
  };

  const elimina = async (id) => {
    if (!confirm('Eliminare la waifu?')) return;
    await deleteCatalogo('catalogo_waifu', id);
    flash('Waifu eliminata');
    ricarica();
  };

  if (ed) return <WaifuEditor waifu={ed} setWaifu={setEd} esistenti={waifu} onSalva={salva} onAnnulla={() => setEd(null)} flash={flash} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>👑 CATALOGO WAIFU ({waifu.length})</h2>
        <button onClick={nuova} style={btnPrimario}>+ NUOVA WAIFU</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {waifu.map(w => {
          const rar = RARITA[w.rarita] || RARITA.comune;
          const arch = ARCHETIPI.find(a => a.id === w.archetipo);
          const pal = PALETTE.find(p => p.id === w.palette);
          return <div key={w.id} style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${rar.colore}80`,
            boxShadow: `0 0 12px ${rar.glow}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontFamily: 'Cinzel, serif', color: rar.colore, fontSize: 14 }}>{w.nome}</div>
              <div style={{ fontSize: 11, color: rar.colore }}>{'★'.repeat(rar.stelle)}</div>
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.5 }}>
              {arch?.nome || '?'} · {pal?.nome || '?'}<br />
              {COLORI_CAPELLI[w.colore_capelli]?.nome} · capelli · età {w.eta}
            </div>
            <div style={{ fontSize: 10, marginTop: 6, opacity: 0.6 }}>
              Asset: {w.asset_paperdoll ? '✓' : '✗'} doll · {w.asset_statica ? '✓' : '✗'} stat · {w.asset_immersiva ? '✓' : '✗'} imm
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={() => setEd(w)} style={btnSecondario}>MODIFICA</button>
              <button onClick={() => elimina(w.id)} style={{ ...btnSecondario, borderColor: '#ef444480', color: '#ef4444' }}>✕</button>
            </div>
          </div>;
        })}
        {waifu.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>Nessuna waifu nel catalogo. Creane la prima.</div>}
      </div>
    </div>
  );
}

function WaifuEditor({ waifu, setWaifu, esistenti, onSalva, onAnnulla, flash }) {
  const [tab, setTab] = useState('dati');
  const [uploading, setUploading] = useState(null);

  const handleUpload = async (variante, file) => {
    if (!file) return;
    if (!waifu.id && !waifu.nome) { flash('Inserisci almeno il nome prima di caricare', '#ef4444'); return; }
    const tempId = waifu.id || `tmp_${waifu.nome.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    setUploading(variante);
    try {
      const url = await uploadAsset(`${pathWaifu(tempId, variante)}_${Date.now()}`, file);
      const campo = `asset_${variante}`;
      setWaifu({ ...waifu, [campo]: url });
      flash(`Asset ${variante} caricato`);
    } catch (e) {
      flash('Errore upload: ' + e.message, '#ef4444');
    } finally { setUploading(null); }
  };

  const promptDoll = buildPromptPaperDoll(waifu, waifu.fillers || {});
  const promptStat = buildPromptCartaStatica(waifu, waifu.fillers || {});
  const promptImm = buildPromptCartaImmersiva(waifu, waifu.fillers || {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>👑 {waifu.id ? 'MODIFICA' : 'NUOVA'} WAIFU</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onAnnulla} style={btnSecondario}>ANNULLA</button>
          <button onClick={() => onSalva(waifu)} disabled={!waifu.nome} style={{ ...btnPrimario, opacity: !waifu.nome ? 0.4 : 1 }}>💾 SALVA</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { k: 'dati', l: '📋 Dati' },
          { k: 'fillers', l: '✏ Filler (outfit/posa/fanservice)' },
          { k: 'paperdoll', l: '🎭 Prompt Paper-Doll' },
          { k: 'statica', l: '🖼 Prompt Carta Statica' },
          { k: 'immersiva', l: '✨ Prompt Carta Immersiva' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '6px 14px',
            background: tab === t.k ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.4)',
            color: tab === t.k ? '#000' : '#f5e6d3',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, cursor: 'pointer',
            fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1, fontWeight: 600,
          }}>{t.l}</button>
        ))}
      </div>

      {tab === 'dati' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="Nome"><input value={waifu.nome} onChange={e => setWaifu({ ...waifu, nome: e.target.value })} style={inputStyle} /></Field>
          <Field label="Rarità">
            <select value={waifu.rarita} onChange={e => setWaifu({ ...waifu, rarita: e.target.value })} style={inputStyle}>
              {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
            </select>
          </Field>
          <Field label="Archetipo">
            <select value={waifu.archetipo} onChange={e => setWaifu({ ...waifu, archetipo: e.target.value })} style={inputStyle}>
              {ARCHETIPI.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Field>
          <Field label="Palette">
            <select value={waifu.palette} onChange={e => setWaifu({ ...waifu, palette: e.target.value })} style={inputStyle}>
              {PALETTE.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Field>
          <Field label="Tette (1-7)"><input type="number" min="1" max="7" value={waifu.tette} onChange={e => setWaifu({ ...waifu, tette: +e.target.value })} style={inputStyle} /></Field>
          <Field label="Taglia piedi (33-44)"><input type="number" min="33" max="44" value={waifu.taglia_piedi} onChange={e => setWaifu({ ...waifu, taglia_piedi: +e.target.value })} style={inputStyle} /></Field>
          <Field label="Età (18-2000)"><input type="number" min="18" max="2000" value={waifu.eta} onChange={e => setWaifu({ ...waifu, eta: +e.target.value })} style={inputStyle} /></Field>
          <Field label="Colore capelli">
            <select value={waifu.colore_capelli} onChange={e => setWaifu({ ...waifu, colore_capelli: +e.target.value })} style={inputStyle}>
              {Object.entries(COLORI_CAPELLI).map(([k, v]) => <option key={k} value={k}>{k} - {v.nome}</option>)}
            </select>
          </Field>
          <Field label="Esperienza (0-250)"><input type="number" min="0" max="250" value={waifu.esperienza} onChange={e => setWaifu({ ...waifu, esperienza: +e.target.value })} style={inputStyle} /></Field>
        </div>
      )}

      {tab === 'fillers' && (
        <div>
          <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 12, lineHeight: 1.6 }}>
            Compila qui i tre placeholder che andranno inseriti nei prompt. Le parti tecniche/identitarie sono già pronte —
            tu controlli solo questi tre aspetti specifici di questa waifu.
          </p>
          <Field label="OUTFIT_DESCRIPTION (descrizione outfit completo in inglese, es. 'silk kimono with golden embroidery, flowing sleeves')">
            <textarea value={waifu.fillers?.outfit || ''} onChange={e => setWaifu({ ...waifu, fillers: { ...waifu.fillers, outfit: e.target.value } })} style={{ ...inputStyle, minHeight: 60 }} placeholder="describe the full outfit in english SD tags" />
          </Field>
          <Field label="FANSERVICE_LEVEL (livello di copertura/scollatura, es. 'modest coverage' / 'open back / 'high slit skirt')">
            <textarea value={waifu.fillers?.fanservice || ''} onChange={e => setWaifu({ ...waifu, fillers: { ...waifu.fillers, fanservice: e.target.value } })} style={{ ...inputStyle, minHeight: 60 }} placeholder="describe coverage/exposure level coherent with rarity" />
          </Field>
          <Field label="POSE_TYPE (descrizione posa, usata in carta statica e immersiva)">
            <textarea value={waifu.fillers?.posa || ''} onChange={e => setWaifu({ ...waifu, fillers: { ...waifu.fillers, posa: e.target.value } })} style={{ ...inputStyle, minHeight: 60 }} placeholder="es. 'hand on hip, looking back over shoulder'" />
          </Field>
          <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 11, lineHeight: 1.6 }}>
              <strong style={{ color: '#a855f7' }}>💡 Suggerimento:</strong> Compila i filler in inglese (sintassi tag SD) per risultati ottimali.
              Non lasciare vuoto: se vuoti, nei prompt resteranno i placeholder che dovrai sostituire manualmente prima di generare.
            </div>
          </div>
        </div>
      )}

      {tab === 'paperdoll' && (
        <PromptPanel
          titolo={promptDoll.titolo}
          note={promptDoll.note}
          prompt={promptDoll.prompt}
          negative={promptDoll.negative}
          parametri={promptDoll.parametri_consigliati}
          assetUrl={waifu.asset_paperdoll}
          onAssetChange={url => setWaifu({ ...waifu, asset_paperdoll: url })}
          onUpload={file => handleUpload('paperdoll', file)}
          uploading={uploading === 'paperdoll'}
          motoreConsigliato="ComfyUI o Automatic1111 con Animagine XL 4.0 o Pony Diffusion XL"
        />
      )}

      {tab === 'statica' && (
        <PromptPanel
          titolo={promptStat.titolo}
          note={promptStat.note}
          prompt={promptStat.prompt}
          negative={promptStat.negative}
          parametri={promptStat.parametri_consigliati}
          assetUrl={waifu.asset_statica}
          onAssetChange={url => setWaifu({ ...waifu, asset_statica: url })}
          onUpload={file => handleUpload('statica', file)}
          uploading={uploading === 'statica'}
          motoreConsigliato="ComfyUI o NovelAI v4 (per gacha card style)"
        />
      )}

      {tab === 'immersiva' && (
        <PromptPanel
          titolo={promptImm.titolo}
          note={promptImm.note}
          prompt={promptImm.prompt}
          negative={promptImm.negative}
          parametri={promptImm.parametri_consigliati}
          assetUrl={waifu.asset_immersiva}
          onAssetChange={url => setWaifu({ ...waifu, asset_immersiva: url })}
          onUpload={file => handleUpload('immersiva', file)}
          uploading={uploading === 'immersiva'}
          motoreConsigliato="ComfyUI con hires_fix per qualità cinematografica"
        />
      )}
    </div>
  );
}

// ============================================================
// PROMPT PANEL - condiviso per visualizzare/copiare prompt e gestire asset
// ============================================================
function PromptPanel({ titolo, note, prompt, negative, parametri, assetUrl, onAssetChange, onUpload, uploading, motoreConsigliato }) {
  const copia = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copiato negli appunti!');
  };

  return (
    <div>
      <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: 2, fontSize: 13, marginBottom: 4 }}>{titolo}</div>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>{note}</div>
        <div style={{ fontSize: 11, opacity: 0.85 }}>
          <strong>Motore AI consigliato:</strong> {motoreConsigliato} · vedi tab "Motori AI" per i link.
        </div>
      </div>

      <Field label="📝 PROMPT POSITIVO (copia in Stable Diffusion / NovelAI)">
        <textarea value={prompt} readOnly style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 11 }} />
        <button onClick={() => copia(prompt)} style={{ ...btnSecondario, marginTop: 4 }}>📋 COPIA PROMPT</button>
      </Field>

      <Field label="❌ NEGATIVE PROMPT">
        <textarea value={negative} readOnly style={{ ...inputStyle, minHeight: 60, fontFamily: 'monospace', fontSize: 11 }} />
        <button onClick={() => copia(negative)} style={{ ...btnSecondario, marginTop: 4 }}>📋 COPIA NEGATIVE</button>
      </Field>

      <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 12, marginTop: 12 }}>
        <div style={{ fontSize: 11, fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 1, marginBottom: 6 }}>⚙ PARAMETRI CONSIGLIATI</div>
        <div style={{ fontSize: 11, opacity: 0.85, fontFamily: 'monospace', lineHeight: 1.6 }}>
          {Object.entries(parametri).map(([k, v]) => (
            <div key={k}>· <strong>{k}:</strong> {String(v)}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, background: 'rgba(6,214,160,0.05)', border: '1px solid rgba(6,214,160,0.3)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontFamily: 'Cinzel, serif', color: '#06d6a0', letterSpacing: 2, marginBottom: 8 }}>📤 UPLOAD ASSET GENERATO</div>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>
          Una volta generata l'immagine con il prompt sopra, caricala qui. Verrà salvata su Firebase Storage e linkata a questa waifu.
        </div>
        <input type="file" accept="image/*" onChange={e => onUpload(e.target.files[0])} disabled={uploading} style={{
          width: '100%', padding: 10,
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(6,214,160,0.4)',
          borderRadius: 6, color: '#f5e6d3',
        }} />
        {uploading && <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 11 }}>⏳ Upload in corso...</div>}
        {assetUrl && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Asset corrente:</div>
            <img src={assetUrl} alt="asset" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)' }} />
            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
              <a href={assetUrl} target="_blank" rel="noopener" style={btnSecondario}>⬇ DOWNLOAD ORIGINALE</a>
              <button onClick={() => onAssetChange('')} style={{ ...btnSecondario, color: '#ef4444', borderColor: '#ef444480' }}>✕ RIMUOVI</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: OUTFIT
// ============================================================
function OutfitTab({ outfit, ricarica, flash }) {
  const [ed, setEd] = useState(null);

  const nuovo = () => setEd({
    nome: '',
    rarita: 'comune',
    slot: 'petto',
    forma: 'tshirt',
    colore: '#ec4899',
    fillers: { descrizione: '' },
    asset: '',
  });

  const salva = async (o) => {
    await upsertOutfit(o.id || null, o);
    flash('Outfit salvato');
    setEd(null);
    ricarica();
  };

  const elimina = async (id) => {
    if (!confirm('Eliminare l\'outfit?')) return;
    await deleteCatalogo('catalogo_outfit', id);
    flash('Outfit eliminato');
    ricarica();
  };

  if (ed) return <OutfitEditor outfit={ed} setOutfit={setEd} onSalva={salva} onAnnulla={() => setEd(null)} flash={flash} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>✦ CATALOGO OUTFIT ({outfit.length})</h2>
        <button onClick={nuovo} style={btnPrimario}>+ NUOVO OUTFIT</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {outfit.map(o => {
          const rar = RARITA[o.rarita] || RARITA.comune;
          return <div key={o.id} style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${rar.colore}80`,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: rar.colore, fontSize: 13 }}>{o.nome}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{SLOT_OUTFIT[o.slot]?.nome} · {o.forma}</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Asset: {o.asset ? '✓' : '✗'}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button onClick={() => setEd(o)} style={btnSecondario}>MOD</button>
              <button onClick={() => elimina(o.id)} style={{ ...btnSecondario, color: '#ef4444' }}>✕</button>
            </div>
          </div>;
        })}
        {outfit.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>Nessun outfit nel catalogo.</div>}
      </div>
    </div>
  );
}

function OutfitEditor({ outfit, setOutfit, onSalva, onAnnulla, flash }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (file) => {
    if (!file) return;
    if (!outfit.nome) { flash('Inserisci nome prima', '#ef4444'); return; }
    const tempId = outfit.id || `tmp_${outfit.nome.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    setUploading(true);
    try {
      const url = await uploadAsset(`${pathOutfit(tempId)}_${Date.now()}`, file);
      setOutfit({ ...outfit, asset: url });
      flash('Asset caricato');
    } catch (e) { flash('Errore: ' + e.message, '#ef4444'); }
    finally { setUploading(false); }
  };

  const promptInfo = buildPromptOutfit(outfit, outfit.fillers || {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>✦ {outfit.id ? 'MODIFICA' : 'NUOVO'} OUTFIT</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onAnnulla} style={btnSecondario}>ANNULLA</button>
          <button onClick={() => onSalva(outfit)} disabled={!outfit.nome} style={{ ...btnPrimario, opacity: !outfit.nome ? 0.4 : 1 }}>💾 SALVA</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Field label="Nome"><input value={outfit.nome} onChange={e => setOutfit({ ...outfit, nome: e.target.value })} style={inputStyle} /></Field>
        <Field label="Rarità">
          <select value={outfit.rarita} onChange={e => setOutfit({ ...outfit, rarita: e.target.value })} style={inputStyle}>
            {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          </select>
        </Field>
        <Field label="Slot">
          <select value={outfit.slot} onChange={e => setOutfit({ ...outfit, slot: e.target.value })} style={inputStyle}>
            {Object.entries(SLOT_OUTFIT).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          </select>
        </Field>
        <Field label="Forma SVG (per fallback senza asset)">
          <select value={outfit.forma} onChange={e => setOutfit({ ...outfit, forma: e.target.value })} style={inputStyle}>
            {outfit.slot === 'faccia' && ['glasses', 'tiara', 'earrings', 'hat', 'mask'].map(f => <option key={f} value={f}>{f}</option>)}
            {outfit.slot === 'petto' && ['tshirt', 'dress', 'bikini', 'corset', 'armor'].map(f => <option key={f} value={f}>{f}</option>)}
            {outfit.slot === 'gambe' && ['pants', 'skirt', 'tights'].map(f => <option key={f} value={f}>{f}</option>)}
            {outfit.slot === 'piedi' && ['sneakers', 'boots', 'heels', 'sandals'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Colore primario"><input type="color" value={outfit.colore} onChange={e => setOutfit({ ...outfit, colore: e.target.value })} style={{ ...inputStyle, padding: 4, height: 42 }} /></Field>
      </div>

      <Field label="Descrizione dettagliata (in inglese, per il prompt)">
        <textarea value={outfit.fillers?.descrizione || ''} onChange={e => setOutfit({ ...outfit, fillers: { ...outfit.fillers, descrizione: e.target.value } })} style={{ ...inputStyle, minHeight: 60 }} placeholder="es. 'long flowing kimono dress with cherry blossom embroidery, silk material, traditional cut'" />
      </Field>

      <PromptPanel
        titolo={promptInfo.titolo}
        note={promptInfo.note}
        prompt={promptInfo.prompt}
        negative={promptInfo.negative}
        parametri={promptInfo.parametri_consigliati}
        assetUrl={outfit.asset}
        onAssetChange={url => setOutfit({ ...outfit, asset: url })}
        onUpload={handleUpload}
        uploading={uploading}
        motoreConsigliato="ComfyUI con sfondo trasparente attivo (use mask)"
      />
    </div>
  );
}

// ============================================================
// TAB: POSE
// ============================================================
function PoseTab({ pose, waifu, ricarica, flash }) {
  const [ed, setEd] = useState(null);

  const nuova = () => setEd({
    nome: '',
    rarita: 'comune',
    waifu_id: '',
    transform: { braccio_sx: 'rotate(0)', braccio_dx: 'rotate(0)' },
    fillers: { tipo: '' },
    asset: '',
  });

  const salva = async (p) => {
    await upsertPosa(p.id || null, p);
    flash('Posa salvata');
    setEd(null);
    ricarica();
  };

  const elimina = async (id) => {
    if (!confirm('Eliminare la posa?')) return;
    await deleteCatalogo('catalogo_pose', id);
    flash('Posa eliminata');
    ricarica();
  };

  if (ed) return <PoseEditor pose={ed} setPose={setEd} waifu={waifu} onSalva={salva} onAnnulla={() => setEd(null)} flash={flash} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>⚜ CATALOGO POSE ({pose.length})</h2>
        <button onClick={nuova} style={btnPrimario}>+ NUOVA POSA</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {pose.map(p => {
          const rar = RARITA[p.rarita] || RARITA.comune;
          const w = waifu.find(x => x.id === p.waifu_id);
          return <div key={p.id} style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${rar.colore}80`,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: rar.colore, fontSize: 13 }}>{p.nome}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>per: {w?.nome || '⚠ waifu non trovata'}</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Asset: {p.asset ? '✓' : '✗'}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button onClick={() => setEd(p)} style={btnSecondario}>MOD</button>
              <button onClick={() => elimina(p.id)} style={{ ...btnSecondario, color: '#ef4444' }}>✕</button>
            </div>
          </div>;
        })}
        {pose.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>Nessuna posa.</div>}
      </div>
    </div>
  );
}

function PoseEditor({ pose, setPose, waifu, onSalva, onAnnulla, flash }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (file) => {
    if (!file) return;
    if (!pose.nome) { flash('Inserisci nome prima', '#ef4444'); return; }
    const tempId = pose.id || `tmp_${pose.nome.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    setUploading(true);
    try {
      const url = await uploadAsset(`${pathPosa(tempId)}_${Date.now()}`, file);
      setPose({ ...pose, asset: url });
      flash('Asset caricato');
    } catch (e) { flash('Errore: ' + e.message, '#ef4444'); }
    finally { setUploading(false); }
  };

  const w = waifu.find(x => x.id === pose.waifu_id);
  const promptInfo = buildPromptPosa(pose, w, pose.fillers || {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>⚜ {pose.id ? 'MODIFICA' : 'NUOVA'} POSA</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onAnnulla} style={btnSecondario}>ANNULLA</button>
          <button onClick={() => onSalva(pose)} disabled={!pose.nome || !pose.waifu_id} style={{ ...btnPrimario, opacity: (!pose.nome || !pose.waifu_id) ? 0.4 : 1 }}>💾 SALVA</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Field label="Nome posa"><input value={pose.nome} onChange={e => setPose({ ...pose, nome: e.target.value })} style={inputStyle} /></Field>
        <Field label="Rarità">
          <select value={pose.rarita} onChange={e => setPose({ ...pose, rarita: e.target.value })} style={inputStyle}>
            {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          </select>
        </Field>
        <Field label="Waifu target (la posa è specifica)">
          <select value={pose.waifu_id} onChange={e => setPose({ ...pose, waifu_id: e.target.value })} style={inputStyle}>
            <option value="">— scegli —</option>
            {waifu.map(w => <option key={w.id} value={w.id}>{w.nome}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Tipo posa (in inglese, descrizione)">
        <textarea value={pose.fillers?.tipo || ''} onChange={e => setPose({ ...pose, fillers: { ...pose.fillers, tipo: e.target.value } })} style={{ ...inputStyle, minHeight: 60 }} placeholder="es. 'arms crossed, looking sideways' / 'sitting on throne, leg crossed'" />
      </Field>

      <Field label="Transform per fallback SVG (opzionale)">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={pose.transform?.braccio_sx || ''} onChange={e => setPose({ ...pose, transform: { ...pose.transform, braccio_sx: e.target.value } })} style={inputStyle} placeholder="es. rotate(15 69 110)" />
          <input value={pose.transform?.braccio_dx || ''} onChange={e => setPose({ ...pose, transform: { ...pose.transform, braccio_dx: e.target.value } })} style={inputStyle} placeholder="es. rotate(-15 131 110)" />
        </div>
      </Field>

      <PromptPanel
        titolo={promptInfo.titolo}
        note={promptInfo.note + '. ' + (promptInfo.note_controlnet || '')}
        prompt={promptInfo.prompt}
        negative={promptInfo.negative}
        parametri={promptInfo.parametri_consigliati}
        assetUrl={pose.asset}
        onAssetChange={url => setPose({ ...pose, asset: url })}
        onUpload={handleUpload}
        uploading={uploading}
        motoreConsigliato="ComfyUI con ControlNet OpenPose attivo per skeleton riutilizzabili"
      />
    </div>
  );
}

// ============================================================
// TAB: DISTRIBUZIONE
// ============================================================
function DistribTab({ waifu }) {
  const sugg = suggerisciDiversificazione(waifu);
  return (
    <div>
      <h2 style={titoloSec}>📊 ANALISI DISTRIBUZIONE</h2>
      <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>
        Verifica la diversificazione delle waifu nel catalogo. Le waifu di un drop dovrebbero coprire archetipi e palette diversi
        per evitare ripetizioni e dare varietà al giocatore.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={cardStat}>
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 14 }}>📋 ARCHETIPI</h3>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {sugg.distribuzioneArche.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: a.conta === 0 ? 'rgba(6,214,160,0.1)' : 'transparent', borderRadius: 4, fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: a.conta === 0 ? '#06d6a0' : a.conta > 2 ? '#ef4444' : '#f5e6d3' }}>{a.nome}</span>
                <span style={{ fontWeight: 600 }}>{a.conta}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={cardStat}>
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 14 }}>🎨 PALETTE</h3>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {sugg.distribuzionePalette.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: p.conta === 0 ? 'rgba(6,214,160,0.1)' : 'transparent', borderRadius: 4, fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: p.conta === 0 ? '#06d6a0' : p.conta > 2 ? '#ef4444' : '#f5e6d3' }}>{p.nome}</span>
                <span style={{ fontWeight: 600 }}>{p.conta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: MOTORI AI
// ============================================================
function MotoriTab() {
  return (
    <div>
      <h2 style={titoloSec}>🤖 MOTORI AI CONSIGLIATI</h2>
      <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>
        Strumenti per generare gli asset a partire dai prompt che il sistema produce per ogni waifu/outfit/posa.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {MOTORI_AI.map((m, i) => (
          <div key={i} style={{ padding: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: 1, fontSize: 14, marginBottom: 4 }}>{m.nome}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}><strong>Tipo:</strong> {m.target}</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>{m.note}</div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 8 }}>
              <strong>Adatto per:</strong> {m.consigliato_per.join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <a href={m.link} target="_blank" rel="noopener" style={btnSecondario}>🔗 SOFTWARE</a>
              {m.modello_link && <a href={m.modello_link} target="_blank" rel="noopener" style={btnSecondario}>📦 MODELLO</a>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: 14, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8 }}>
        <h3 style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 13, marginTop: 0 }}>💡 WORKFLOW CONSIGLIATO</h3>
        <ol style={{ fontSize: 12, lineHeight: 1.8, opacity: 0.9 }}>
          <li>Scegli un motore AI (consiglio <strong>ComfyUI + Animagine XL 4.0</strong> per la massima qualità)</li>
          <li>Crea una nuova waifu nell'admin compilando dati e fillers (outfit/posa/fanservice)</li>
          <li>Vai nelle tab "Prompt Paper-Doll", "Prompt Carta Statica", "Prompt Carta Immersiva"</li>
          <li>Copia il prompt e il negative, incollali nel motore AI con i parametri consigliati</li>
          <li>Genera l'immagine, poi tornaci e caricala nell'apposito uploader</li>
          <li>Il sistema linkerà l'asset alla waifu e lo userà nel gioco</li>
        </ol>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#a855f7', letterSpacing: 1.5, marginBottom: 4, fontFamily: 'Cinzel, serif' }}>{label}</div>
      {children}
    </label>
  );
}

const titoloSec = { fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: 3, margin: 0 };
const inputStyle = { width: '100%', padding: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, color: '#f5e6d3', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' };
const btnPrimario = { padding: '8px 18px', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', border: 'none', color: '#000', fontWeight: 600, fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 2, borderRadius: 6, cursor: 'pointer' };
const btnSecondario = { padding: '5px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.4)', color: '#f5e6d3', fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1, borderRadius: 4, cursor: 'pointer', display: 'inline-block', textAlign: 'center' };
const btnPiccolo = { padding: '4px 10px', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', border: 'none', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1, borderRadius: 4, cursor: 'pointer', fontWeight: 600 };
const cardStat = { padding: 14, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 };
