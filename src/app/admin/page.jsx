// src/app/admin/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  listWaifu, listOutfit, listPose, listDrops,
  upsertWaifu, upsertOutfit, upsertPosa, upsertDrop,
  deleteCatalogo, clearCatalogCache,
  getPrezziConfig, setPrezziConfig,
} from '@/lib/firestoreService';
import { uploadAsset, pathWaifu, pathOutfit, pathPosa, uploadLargeAsset } from '@/lib/storageService';
import {
  buildPromptPaperDoll, buildPromptCartaStatica, buildPromptCartaImmersiva,
  buildPromptOutfit, buildPromptPosa, buildPromptBustina,
  ARCHETIPI, PALETTE, MOTORI_AI, suggerisciDiversificazione,
} from '@/lib/promptGenerator';
import { RARITA, COLORI_CAPELLI, SLOT_OUTFIT, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT, OUTFIT_CONFIG_DEFAULT, ABILITA_TIPI, ABILITA_VALORI } from '@/lib/constants';
import { calcolaLivelloOutfit, calcolaNumArchetipi, autoGeneraAbilita } from '@/lib/gameLogic';
import { CartaWaifu } from '@/components/CartaWaifu';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => {
              clearCatalogCache();
              mostraNotif('Cache catalogo svuotata — gli utenti vedranno i dati aggiornati al prossimo caricamento.', '#00e676');
            }}
            style={{ ...btnPiccolo, background: 'rgba(0,230,118,0.08)', borderColor: 'rgba(0,230,118,0.4)', color: '#00e676' }}
            title="Invalida la cache localStorage del catalogo su questo browser"
          >🗑 Svuota cache</button>
          <a href="/gioco" style={{ ...btnPiccolo, textDecoration: 'none' }}>← AL GIOCO</a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '12px 16px', flexWrap: 'wrap', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
        {[
          { k: 'drops', l: '📦 Drops' },
          { k: 'waifu', l: '👑 Waifu' },
          { k: 'bulk', l: '🚀 Caricamento Massivo' },
          { k: 'outfit', l: '✦ Outfit' },
          { k: 'pose', l: '⚜ Pose' },
          { k: 'distrib', l: '📊 Distribuzione' },
          { k: 'motori', l: '🤖 Motori AI' },
          { k: 'config', l: '⚙ Config' },
          { k: 'prezzi', l: '💰 Prezzi' },
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
        {tab === 'waifu' && <WaifuTab waifu={waifu} drops={drops} ricarica={carica} flash={flash} />}
        {tab === 'bulk' && <BulkUploadTab waifu={waifu} ricarica={carica} flash={flash} />}
        {tab === 'outfit' && <OutfitTab outfit={outfit} ricarica={carica} flash={flash} />}
        {tab === 'pose' && <PoseTab pose={pose} waifu={waifu} ricarica={carica} flash={flash} />}
        {tab === 'distrib' && <DistribTab waifu={waifu} outfit={outfit} pose={pose} />}
        {tab === 'motori' && <MotoriTab />}
        {tab === 'config' && <ConfigTab waifu={waifu} ricarica={carica} flash={flash} />}
        {tab === 'prezzi' && <PrezziTab flash={flash} user={user} />}
      </div>
    </div>
  );
}

// ============================================================
// TAB: DROPS
// ============================================================
function DropsTab({ drops, waifu, outfit, pose, ricarica, flash }) {
  const [ed, setEd] = useState(null);

  const nuovo = () => {
    // Prepopola con colori diversificati: ruota tra palette predefinite per non replicare
    const paletteColori = [
      { c1: '#9b59ff', c2: '#ff2d78' },
      { c1: '#f59e0b', c2: '#06d6a0' },
      { c1: '#3b82f6', c2: '#ec4899' },
      { c1: '#dc2626', c2: '#eab308' },
      { c1: '#14b8a6', c2: '#a855f7' },
      { c1: '#f97316', c2: '#8b5cf6' },
    ];
    // Scegli palette non usata dagli ultimi drop
    const usateC1 = new Set(drops.map(d => d.colore).filter(Boolean));
    const palette = paletteColori.find(p => !usateC1.has(p.c1)) || paletteColori[drops.length % paletteColori.length];

    // Stagioni/temi per nome autogenerato
    const stagioniBase = ['Primavera', 'Estate', 'Autunno', 'Inverno', 'Sakura', 'Notte', 'Aurora', 'Solstizio'];
    const nomiUsati = new Set(drops.map(d => (d.nome || '').split(' ')[0]));
    const stagione = stagioniBase.find(s => !nomiUsati.has(s)) || `Stagione ${drops.length + 1}`;

    // Data inizio oggi, fine +30 giorni
    const oggi = new Date();
    const fine = new Date(oggi);
    fine.setDate(fine.getDate() + 30);
    const fmt = d => d.toISOString().split('T')[0];

    setEd({
      nome: `Drop ${stagione}`,
      descrizione: `Collezione tematica ${stagione.toLowerCase()} con waifu esclusive.`,
      inizio: fmt(oggi),
      fine: fmt(fine),
      attivo: false,
      colore: palette.c1,
      colore2: palette.c2,
      waifuIds: [],
      outfitIds: [],
      poseIds: [],
    });
  };

  const salva = async (d) => {
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
    return <DropEditor drop={ed} setDrop={setEd} waifu={waifu} outfit={outfit} pose={pose} drops={drops}
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
          Ogni drop è un set tematico di waifu, outfit e pose. <strong>Possono essere attivi più drop contemporaneamente</strong>.
          Quando un drop è attivo, appare nella schermata di sbustamento e il giocatore può scegliere quale drop sbustare.
          I pacchetti pescano <strong>esclusivamente</strong> dai contenuti del drop selezionato.
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

function DropEditor({ drop, setDrop, waifu, outfit, pose, drops, onSalva, onAnnulla, flash }) {
  const [tabSel, setTabSel] = useState('waifu');
  // Filtri per la tab waifu
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [filtroPresenza, setFiltroPresenza] = useState('tutte'); // tutte | presenti | assenti
  const [filtroNome, setFiltroNome] = useState('');
  const [vistaCard, setVistaCard] = useState(false); // false=lista, true=card
  const [uploadMangaProgress, setUploadMangaProgress] = useState(null); // null | 0-100

  const toggleId = (campo, id) => {
    const arr = drop[campo] || [];
    const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
    setDrop({ ...drop, [campo]: next });
  };

  // Suggerimenti diversificazione: solo waifu del drop
  const waifuDelDrop = waifu.filter(w => drop.waifuIds?.includes(w.id));
  const sugg = suggerisciDiversificazione(waifuDelDrop);

  // Waifu presenti in qualsiasi drop esistente
  const waifuInQualsiasidrop = new Set(
    (drops || []).flatMap(d => d.waifuIds || [])
  );

  // Waifu filtrate
  const waifuFiltrate = waifu.filter(w => {
    if (filtroRarita !== 'tutte' && w.rarita !== filtroRarita) return false;
    if (filtroPresenza === 'presenti' && !drop.waifuIds?.includes(w.id)) return false;
    if (filtroPresenza === 'assenti' && waifuInQualsiasidrop.has(w.id)) return false;
    if (filtroNome && !w.nome?.toLowerCase().includes(filtroNome.toLowerCase())) return false;
    return true;
  });

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
        <Field label="Colore primario (hex)">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={drop.colore || '#9b59ff'} onChange={e => setDrop({ ...drop, colore: e.target.value })} style={{ ...inputStyle, padding: 4, height: 42, width: 56, cursor: 'pointer' }} />
            <input value={drop.colore || '#9b59ff'} onChange={e => setDrop({ ...drop, colore: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="#9b59ff" />
          </div>
        </Field>
        <Field label="Colore secondario (hex)">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={drop.colore2 || '#ff2d78'} onChange={e => setDrop({ ...drop, colore2: e.target.value })} style={{ ...inputStyle, padding: 4, height: 42, width: 56, cursor: 'pointer' }} />
            <input value={drop.colore2 || '#ff2d78'} onChange={e => setDrop({ ...drop, colore2: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="#ff2d78" />
          </div>
        </Field>
      </div>

      <Field label="Descrizione">
        <textarea value={drop.descrizione || ''} onChange={e => setDrop({ ...drop, descrizione: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
      </Field>

      {/* UPLOAD PDF MANGA */}
      <Field label="📖 Capitolo Manga (PDF) — sbloccato completando il drop">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept="application/pdf"
            disabled={uploadMangaProgress !== null}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setUploadMangaProgress(0);
                const url = await uploadLargeAsset(
                  'manga',
                  `drop_${drop.id || Date.now()}_manga`,
                  file,
                  (pct) => setUploadMangaProgress(pct),
                );
                setDrop({ ...drop, asset_manga: url });
                flash('PDF manga caricato!', '#06d6a0');
              } catch (err) {
                flash('Errore upload PDF: ' + err.message, '#ef4444');
              } finally {
                setUploadMangaProgress(null);
                e.target.value = '';
              }
            }}
            style={{ ...inputStyle, padding: 8, opacity: uploadMangaProgress !== null ? 0.4 : 1 }}
          />
          {drop.asset_manga && uploadMangaProgress === null && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ padding: '6px 12px', background: 'rgba(6,214,160,0.12)', border: '1px solid rgba(6,214,160,0.4)', borderRadius: 6, fontSize: 11, color: '#06d6a0' }}>
                📄 PDF caricato
              </div>
              <a href={drop.asset_manga} target="_blank" rel="noreferrer" style={{ ...btnSecondario, fontSize: 10, padding: '4px 8px', textDecoration: 'none' }}>👁 Anteprima</a>
              <button onClick={() => setDrop({ ...drop, asset_manga: '' })} style={{ ...btnSecondario, fontSize: 11, padding: '4px 8px', borderColor: '#ef444480', color: '#ef4444' }}>✕ Rimuovi</button>
            </div>
          )}
        </div>
        {/* Barra progresso upload */}
        {uploadMangaProgress !== null && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${uploadMangaProgress}%`,
                background: 'linear-gradient(90deg, #06d6a0, #3b82f6)',
                transition: 'width 0.2s ease',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#06d6a0', marginTop: 4 }}>
              {uploadMangaProgress < 100 ? `⏳ Upload in corso... ${uploadMangaProgress}%` : '✓ Elaborazione...'}
            </div>
          </div>
        )}
        {drop.asset_manga && uploadMangaProgress === null && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(245,230,211,0.45)', lineHeight: 1.5 }}>
            Gli utenti che collezionano <strong style={{ color: 'rgba(245,230,211,0.7)' }}>tutte le waifu, outfit e pose</strong> di questo drop sbloccano automaticamente il download del PDF.
          </div>
        )}
      </Field>

      {/* UPLOAD IMMAGINE BUSTINA */}
      <Field label="Immagine Bustina (opzionale)">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'bustine');
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload fallito');
                const data = await res.json();
                setDrop({ ...drop, asset_bustina: data.url });
                flash('Immagine bustina caricata!', '#06d6a0');
              } catch (err) {
                flash('Errore upload: ' + err.message, '#ef4444');
              }
            }}
            style={{ ...inputStyle, padding: 8 }}
          />
          {drop.asset_bustina && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <img src={drop.asset_bustina} alt="Bustina" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid #f59e0b' }} />
              <button onClick={() => setDrop({ ...drop, asset_bustina: '' })} style={{ ...btnSecondario, fontSize: 11, padding: '4px 8px' }}>✕ Rimuovi</button>
            </div>
          )}
        </div>
      </Field>

      {/* PROMPT BUSTINA AUTOGENERATO */}
      {drop.waifuIds?.length > 0 && (
        <Field label="Prompt Bustina Suggerito (per AI)">
          <div style={{ padding: 12, background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.3)', borderRadius: 8 }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: '#06d6a0', letterSpacing: 2, fontSize: 11, marginBottom: 8 }}>🎨 PROMPT AUTOGENERATO</div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: '#d4c5b9', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {buildPromptBustina(drop, waifu)}
            </div>
          </div>
        </Field>
      )}

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
          { k: 'waifu', l: `👑 Waifu (${drop.waifuIds?.length || 0})` },
          { k: 'outfit', l: `✦ Outfit (${drop.outfitIds?.length || 0})` },
          { k: 'pose', l: `⚜ Pose (${drop.poseIds?.length || 0})` },
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

      {/* ── BARRA FILTRI (solo tab waifu) ── */}
      {tabSel === 'waifu' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
          {/* Filtro nome */}
          <input
            value={filtroNome}
            onChange={e => setFiltroNome(e.target.value)}
            placeholder="🔍 Cerca per nome..."
            style={{ ...inputStyle, flex: '1 1 160px', minWidth: 140, padding: '6px 10px', fontSize: 12 }}
          />
          {/* Filtro rarità */}
          <select
            value={filtroRarita}
            onChange={e => setFiltroRarita(e.target.value)}
            style={{ ...inputStyle, flex: '0 0 auto', width: 'auto', padding: '6px 10px', fontSize: 12 }}
          >
            <option value="tutte">⭐ Tutte le rarità</option>
            {Object.entries(RARITA).map(([k, v]) => (
              <option key={k} value={k}>{'★'.repeat(v.stelle)} {v.nome}</option>
            ))}
          </select>
          {/* Filtro presenza nel drop */}
          <select
            value={filtroPresenza}
            onChange={e => setFiltroPresenza(e.target.value)}
            style={{ ...inputStyle, flex: '0 0 auto', width: 'auto', padding: '6px 10px', fontSize: 12 }}
          >
            <option value="tutte">📦 Tutte</option>
            <option value="presenti">✅ Nel drop</option>
            <option value="assenti">🆓 In nessun drop</option>
          </select>
          {/* Toggle vista */}
          <button
            onClick={() => setVistaCard(v => !v)}
            style={{ ...btnSecondario, padding: '6px 12px', fontSize: 11, background: vistaCard ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.4)' }}
            title="Alterna tra vista card e lista"
          >
            {vistaCard ? '☰ Lista' : '🃏 Card'}
          </button>
          {/* Contatore risultati */}
          <div style={{ fontSize: 11, opacity: 0.6, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
            {waifuFiltrate.length}/{waifu.length} waifu
          </div>
        </div>
      )}

      {/* ── LISTA WAIFU con filtri e card ── */}
      {tabSel === 'waifu' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: vistaCard
            ? 'repeat(auto-fill, minmax(200px, 1fr))'
            : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: vistaCard ? 12 : 6,
          maxHeight: vistaCard ? 640 : 420,
          overflowY: 'auto',
          padding: 6,
        }}>
          {waifuFiltrate.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center', opacity: 0.6 }}>
              Nessuna waifu corrisponde ai filtri selezionati.
            </div>
          )}
          {waifuFiltrate.map(item => {
            const sel = drop.waifuIds?.includes(item.id);
            const rar = RARITA[item.rarita] || RARITA.comune;
            if (vistaCard) {
              return (
                <div
                  key={item.id}
                  onClick={() => toggleId('waifuIds', item.id)}
                  style={{
                    cursor: 'pointer',
                    position: 'relative',
                    borderRadius: 10,
                    border: sel ? `2px solid ${rar.colore}` : '2px solid transparent',
                    boxShadow: sel ? `0 0 12px ${rar.glow}` : 'none',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                    overflow: 'hidden',
                  }}
                >
                  {/* Badge selezione */}
                  <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 10,
                    width: 22, height: 22, borderRadius: '50%',
                    background: sel ? rar.colore : 'rgba(0,0,0,0.6)',
                    border: `2px solid ${sel ? '#fff' : 'rgba(255,255,255,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', fontWeight: 700,
                  }}>
                    {sel ? '✓' : '+'}
                  </div>
                  {/* Carta waifu */}
                  <CartaWaifu waifu={item} dimensione="piccola" tipo="statica" />
                </div>
              );
            }
            // Vista lista
            return (
              <div key={item.id} onClick={() => toggleId('waifuIds', item.id)} style={{
                padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                background: sel ? `linear-gradient(135deg, ${rar.colore}22, transparent)` : 'rgba(0,0,0,0.3)',
                border: sel ? `2px solid ${rar.colore}` : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
              }}>
                {/* Miniatura immagine */}
                {item.asset_statica || item.asset_paperdoll ? (
                  <img
                    src={item.asset_statica || item.asset_paperdoll}
                    alt={item.nome}
                    style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4, border: `1px solid ${rar.colore}60`, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 40, height: 56, borderRadius: 4, background: `${rar.colore}20`, border: `1px solid ${rar.colore}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    👑
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={sel || false} readOnly style={{ accentColor: rar.colore, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</span>
                  </div>
                  <div style={{ fontSize: 10, color: rar.colore, marginTop: 2 }}>{'★'.repeat(rar.stelle)} {rar.nome}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── OUTFIT e POSE (tab non-waifu, invariate) ── */}
      {tabSel !== 'waifu' && (() => {
        const t = tabSel === 'outfit'
          ? { items: outfit, campo: 'outfitIds', label: 'outfit' }
          : { items: pose, campo: 'poseIds', label: 'pose' };
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, maxHeight: 400, overflowY: 'auto', padding: 6 }}>
            {t.items.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center', opacity: 0.6 }}>
                Nessun {t.label} creato. Crea {t.label} dalle altre tab.
              </div>
            )}
            {t.items.map(item => {
              const sel = drop[t.campo]?.includes(item.id);
              const rar = RARITA[item.rarita] || RARITA.comune;
              return (
                <div key={item.id} onClick={() => toggleId(t.campo, item.id)} style={{
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
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// TAB: WAIFU
// ============================================================
const WAIFU_PER_PAGE = 24;

function WaifuTab({ waifu, drops, ricarica, flash }) {
  const [ed, setEd] = useState(null);
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [filtroAsset, setFiltroAsset] = useState('tutti'); // tutti | presenti | mancanti
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroDropId, setFiltroDropId] = useState('tutti'); // tutti | <dropId> | '__nessuno__'
  const [vistaCard, setVistaCard] = useState(true); // true=card preview, false=list
  const [visibiliWaifu, setVisibiliWaifu] = useState(WAIFU_PER_PAGE);

  // Reset paginazione al cambio filtri
  useEffect(() => { setVisibiliWaifu(WAIFU_PER_PAGE); }, [filtroRarita, filtroAsset, filtroNome, filtroDropId, vistaCard]);

  const nuova = () => setEd({
    nome: '',
    rarita: 'comune',
    tette: 3,
    taglia_piedi: 38,
    eta: 22,
    colore_capelli: 1,
    esperienza: 0,
    archetipo: ARCHETIPI[0].id,
    palette: PALETTE[0].id,
    fillers: { outfit: '', fanservice: '', posa: '' },
    asset_paperdoll: '',
    asset_statica: '',
    asset_immersiva: '',
    asset_video: '', // ★ FASE 4: video per effetto Pokémon Pocket su carte immersive
    asset_video_hard: '', // ★ Video hard immersivo (visibile solo con pass acquistato)
    hot: false,           // ★ Contenuto Hot — visibile solo con Pass Hard
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

  // Apply filters
  let filtrate = waifu;
  if (filtroRarita !== 'tutte') filtrate = filtrate.filter(w => w.rarita === filtroRarita);
  if (filtroAsset === 'presenti') filtrate = filtrate.filter(w => w.asset_statica || w.asset_immersiva);
  if (filtroAsset === 'mancanti') filtrate = filtrate.filter(w => !w.asset_statica && !w.asset_immersiva);
  if (filtroNome) filtrate = filtrate.filter(w => w.nome.toLowerCase().includes(filtroNome.toLowerCase()));
  if (filtroDropId === '__nessuno__') {
    const tutteLeWaifuInDrop = new Set((drops || []).flatMap(d => d.waifuIds || []));
    filtrate = filtrate.filter(w => !tutteLeWaifuInDrop.has(w.id));
  } else if (filtroDropId !== 'tutti') {
    const dropSel = (drops || []).find(d => d.id === filtroDropId);
    filtrate = filtrate.filter(w => dropSel?.waifuIds?.includes(w.id));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>👑 CATALOGO WAIFU ({filtrate.length}/{waifu.length})</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setVistaCard(!vistaCard)} style={btnSecondario}>{vistaCard ? '📋 Lista' : '🃏 Carte'}</button>
          <button onClick={nuova} style={btnPrimario}>+ NUOVA WAIFU</button>
        </div>
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="🔍 Cerca nome..." style={{ ...inputStyle, width: 180, padding: 6, fontSize: 11 }} />
        <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={{ ...inputStyle, width: 130, padding: 6, fontSize: 11 }}>
          <option value="tutte">Tutte le rarità</option>
          {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome} {'★'.repeat(v.stelle)}</option>)}
        </select>
        <select value={filtroAsset} onChange={e => setFiltroAsset(e.target.value)} style={{ ...inputStyle, width: 140, padding: 6, fontSize: 11 }}>
          <option value="tutti">Tutti gli asset</option>
          <option value="presenti">✓ Con immagine</option>
          <option value="mancanti">✗ Senza immagine</option>
        </select>
        <select value={filtroDropId} onChange={e => setFiltroDropId(e.target.value)} style={{ ...inputStyle, width: 160, padding: 6, fontSize: 11 }}>
          <option value="tutti">📦 Tutti i drop</option>
          <option value="__nessuno__">🚫 Senza drop</option>
          {(drops || []).map(d => (
            <option key={d.id} value={d.id}>
              {d.attivo ? '● ' : ''}{d.nome || d.id}
            </option>
          ))}
        </select>
      </div>

      {(() => {
        const visibili = filtrate.slice(0, visibiliWaifu);
        const rimanenti = filtrate.length - visibiliWaifu;
        const caricaAltreBtn = rimanenti > 0 && (
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button
              onClick={() => setVisibiliWaifu(v => v + WAIFU_PER_PAGE)}
              style={{ ...btnSecondario, padding: '8px 20px', fontSize: 11 }}
            >
              Carica altre ({Math.min(rimanenti, WAIFU_PER_PAGE)} di {rimanenti} rimanenti)
            </button>
          </div>
        );
        return <>
      {vistaCard ? (
        /* CARD PREVIEW VIEW - Come le vedrebbe il giocatore */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {visibili.map(w => {
            const rar = RARITA[w.rarita] || RARITA.comune;
            return (
              <div key={w.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setEd(w)}>
                {/* Usa CartaWaifu importata dal componente */}
                <div style={{
                  width: 143, height: 215,
                  borderRadius: 8, overflow: 'hidden',
                  border: `2px solid ${rar.colore}80`,
                  boxShadow: `0 0 12px ${rar.glow}`,
                  background: `linear-gradient(160deg, #130a24, #06030f)`,
                  position: 'relative',
                }}>
                  {w.asset_statica || w.asset_immersiva ? (
                    <img src={w.asset_statica || w.asset_immersiva} alt={w.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: rar.colore, opacity: 0.15 }}>♛</div>
                  )}
                  {/* Top overlay - name */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent)' }}>
                    <div style={{ fontSize: 9, color: '#fff', fontWeight: 700, fontFamily: 'Orbitron', textShadow: '0 1px 3px #000' }}>{w.nome}</div>
                    <div style={{ fontSize: 7, color: rar.colore }}>{'★'.repeat(rar.stelle)}</div>
                  </div>
                  {/* Bottom overlay - stats */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 4px 4px', background: 'linear-gradient(0deg, rgba(0,0,0,0.85), transparent)', display: 'flex', justifyContent: 'space-around', fontSize: 8 }}>
                    {[
                      { icon: '💗', val: w.tette, col: '#ff6b9d' },
                      { icon: '🦶', val: w.taglia_piedi, col: '#64b5f6' },
                      { icon: '⏳', val: w.eta, col: '#ffd54f' },
                      { icon: '💇', val: w.colore_capelli, col: '#81c784' },
                      { icon: '⭐', val: w.esperienza, col: '#ce93d8' },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', lineHeight: 1 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: `0 0 4px ${s.col}`, fontFamily: 'Orbitron' }}>{s.val}</div>
                        <div style={{ fontSize: 7 }}>{s.icon}</div>
                      </div>
                    ))}
                  </div>
                  {/* No-asset badge */}
                  {!w.asset_statica && !w.asset_immersiva && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,61,61,0.8)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 8, fontWeight: 700 }}>NO IMG</div>
                  )}
                </div>
                {/* Edit hint */}
                <div style={{ textAlign: 'center', marginTop: 4, fontSize: 8, opacity: 0.4, fontFamily: 'Orbitron' }}>click per editare</div>
              </div>
            );
          })}
          {filtrate.length === 0 && <div style={{ padding: 30, opacity: 0.6, fontSize: 12 }}>Nessuna waifu corrisponde ai filtri.</div>}
        </div>
      ) : (
        /* LIST VIEW - Compact */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {visibili.map(w => {
            const rar = RARITA[w.rarita] || RARITA.comune;
            return <div key={w.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.4)', border: `1px solid ${rar.colore}60` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontFamily: 'Cinzel, serif', color: rar.colore, fontSize: 12, fontWeight: 600 }}>{w.nome}</div>
                <div style={{ fontSize: 10, color: rar.colore }}>{'★'.repeat(rar.stelle)}</div>
              </div>
              <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 6 }}>
                💗{w.tette} 🦶{w.taglia_piedi} ⏳{w.eta} 💇{w.colore_capelli} ⭐{w.esperienza}
                {' · '}Asset: {w.asset_statica ? '✓' : '✗'}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setEd(w)} style={{ ...btnSecondario, padding: '3px 8px', fontSize: 9 }}>MODIFICA</button>
                <button onClick={() => elimina(w.id)} style={{ ...btnSecondario, padding: '3px 8px', fontSize: 9, borderColor: '#ef444440', color: '#ef4444' }}>✕</button>
              </div>
            </div>;
          })}
          {filtrate.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>Nessuna waifu.</div>}
        </div>
      )}
      {caricaAltreBtn}
        </>;
      })()}
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
          <Field label="🔥 Contenuto Hot (solo con Pass Hard)">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!waifu.hot}
                onChange={e => setWaifu({ ...waifu, hot: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: '#ff4500', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: waifu.hot ? '#ff4500' : 'rgba(238,232,220,0.5)' }}>
                {waifu.hot ? '🔥 HOT — visibile solo con Pass Hard' : 'Standard (visibile a tutti)'}
              </span>
            </label>
          </Field>
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
          <Field label="Taglia piedi (34-45)"><input type="number" min="34" max="45" value={waifu.taglia_piedi} onChange={e => setWaifu({ ...waifu, taglia_piedi: +e.target.value })} style={inputStyle} /></Field>
          <Field label="Età (18-2000)"><input type="number" min="18" max="2000" value={waifu.eta} onChange={e => setWaifu({ ...waifu, eta: +e.target.value })} style={inputStyle} /></Field>
          <Field label="Colore capelli">
            <select value={waifu.colore_capelli} onChange={e => setWaifu({ ...waifu, colore_capelli: +e.target.value })} style={inputStyle}>
              {Object.entries(COLORI_CAPELLI).map(([k, v]) => <option key={k} value={k}>{k} - {v.nome}</option>)}
            </select>
          </Field>
          <Field label="Esperienza (0-5000)"><input type="number" min="0" max="5000" value={waifu.esperienza} onChange={e => setWaifu({ ...waifu, esperienza: +e.target.value })} style={inputStyle} /></Field>
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
        <>
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
          {/* ★ FASE 4: Video per carte immersive (Pokémon Pocket style) */}
          <div style={{ marginTop: 16, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: '#ec4899', letterSpacing: 2, fontSize: 13, marginBottom: 8 }}>
              🎬 VIDEO CARTA IMMERSIVA
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10, lineHeight: 1.5 }}>
              Video animato (MP4/WebM) per l'effetto Pokémon Pocket. Al click sulla carta statica, il video parte e gira dentro la grafica della carta nascondendo nome, rarità e statistiche. Al termine torna alla grafica normale.<br/>
              <strong style={{ color: 'rgba(236,72,153,0.8)' }}>Consigliato:</strong> 3–8 secondi, 9:16 o 1:1, senza audio.
            </div>
            {waifu.asset_video && (
              <div style={{ marginBottom: 10 }}>
                <video src={waifu.asset_video} style={{ maxWidth: 120, maxHeight: 180, borderRadius: 6, border: '1px solid rgba(236,72,153,0.4)' }} controls muted />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{waifu.asset_video.substring(0, 60)}…</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{
                background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.5)',
                color: '#ec4899', padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontFamily: 'Orbitron, sans-serif',
              }}>
                {uploading === 'video' ? '⏳ CARICAMENTO...' : '▶ CARICA VIDEO'}
                <input type="file" accept="video/mp4,video/webm" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && handleUpload('video', e.target.files[0])}
                  disabled={uploading === 'video'}
                />
              </label>
              {waifu.asset_video && (
                <button onClick={() => setWaifu({ ...waifu, asset_video: '' })}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10 }}>
                  ✕ Rimuovi video
                </button>
              )}
            </div>
          </div>
          {/* ★ Video HARD immersivo (visibile solo con pass acquistato) */}
          <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: '#ef4444', letterSpacing: 2, fontSize: 13, marginBottom: 8 }}>
              🔞 VIDEO CARTA HARD (pass richiesto)
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10, lineHeight: 1.5 }}>
              Video hard immersivo (MP4/WebM). Visibile solo agli utenti che hanno acquistato il pass. Il bottone "VEDI CARTA HARD" è sempre visibile nella collezione ma il video è bloccato senza pass.<br/>
              <strong style={{ color: 'rgba(239,68,68,0.8)' }}>Consigliato:</strong> 3–8 secondi, 9:16 o 1:1, senza audio.
            </div>
            {waifu.asset_video_hard && (
              <div style={{ marginBottom: 10 }}>
                <video src={waifu.asset_video_hard} style={{ maxWidth: 120, maxHeight: 180, borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)' }} controls muted />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{waifu.asset_video_hard.substring(0, 60)}…</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
                color: '#ef4444', padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontFamily: 'Orbitron, sans-serif',
              }}>
                {uploading === 'video_hard' ? '⏳ CARICAMENTO...' : '🔞 CARICA VIDEO HARD'}
                <input type="file" accept="video/mp4,video/webm" style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && handleUpload('video_hard', e.target.files[0])}
                  disabled={uploading === 'video_hard'}
                />
              </label>
              {waifu.asset_video_hard && (
                <button onClick={() => setWaifu({ ...waifu, asset_video_hard: '' })}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10 }}>
                  ✕ Rimuovi video hard
                </button>
              )}
            </div>
          </div>
        </>
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
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [filtroSlot, setFiltroSlot] = useState('tutti');
  const [filtroAsset, setFiltroAsset] = useState('tutti');
  const [filtroNome, setFiltroNome] = useState('');

  const nuovo = () => setEd({
    nome: '',
    rarita: 'comune',
    slot: 'petto',
    forma: 'tshirt',
    colore: '#ec4899',
    archetipi_compatibili: [],  // array invece di singolo archetipo_compatibile
    abilita: null,
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

  if (ed) return <OutfitEditor outfit={ed} setOutfit={setEd} onSalva={salva} onAnnulla={() => setEd(null)} flash={flash} outfitEsistenti={outfit} />;

  let filtrati = outfit;
  if (filtroRarita !== 'tutte') filtrati = filtrati.filter(o => o.rarita === filtroRarita);
  if (filtroSlot !== 'tutti') filtrati = filtrati.filter(o => o.slot === filtroSlot);
  if (filtroAsset === 'presenti') filtrati = filtrati.filter(o => o.asset);
  if (filtroAsset === 'mancanti') filtrati = filtrati.filter(o => !o.asset);
  if (filtroNome) filtrati = filtrati.filter(o => o.nome.toLowerCase().includes(filtroNome.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>✦ CATALOGO OUTFIT ({filtrati.length}/{outfit.length})</h2>
        <button onClick={nuovo} style={btnPrimario}>+ NUOVO OUTFIT</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="🔍 Cerca..." style={{ ...inputStyle, width: 140, padding: 5, fontSize: 10 }} />
        <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={{ ...inputStyle, width: 110, padding: 5, fontSize: 10 }}>
          <option value="tutte">Tutte rarità</option>
          {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
        </select>
        <select value={filtroSlot} onChange={e => setFiltroSlot(e.target.value)} style={{ ...inputStyle, width: 100, padding: 5, fontSize: 10 }}>
          <option value="tutti">Tutti slot</option>
          {Object.entries(SLOT_OUTFIT).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
        </select>
        <select value={filtroAsset} onChange={e => setFiltroAsset(e.target.value)} style={{ ...inputStyle, width: 120, padding: 5, fontSize: 10 }}>
          <option value="tutti">Tutti asset</option>
          <option value="presenti">✓ Con asset</option>
          <option value="mancanti">✗ Senza</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {filtrati.map(o => {
          const rar = RARITA[o.rarita] || RARITA.comune;
          return <div key={o.id} style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${rar.colore}80`,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: rar.colore, fontSize: 13 }}>{o.nome}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>{SLOT_OUTFIT[o.slot]?.nome} · {o.forma}</div>
            <div style={{ fontSize: 9, marginTop: 3, opacity: 0.55 }}>
              Archetipi: {(o.archetipi_compatibili || (o.archetipo_compatibile ? [o.archetipo_compatibile] : [])).length || 0} ⚜
            </div>
            {o.abilita && (
              <div style={{ fontSize: 9, color: rar.colore, marginTop: 2, opacity: 0.8 }}>
                ✨ {o.abilita.tipo === 'doppia' ? o.abilita.descrizione : o.abilita.descrizione || o.abilita.tipo}
              </div>
            )}
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Asset: {o.asset ? '✓' : '✗'}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button onClick={() => setEd(o)} style={btnSecondario}>MOD</button>
              <button onClick={() => elimina(o.id)} style={{ ...btnSecondario, color: '#ef4444' }}>✕</button>
            </div>
          </div>;
        })}
        {filtrati.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>Nessun outfit corrisponde ai filtri.</div>}
      </div>
    </div>
  );
}

function OutfitEditor({ outfit, setOutfit, onSalva, onAnnulla, flash, outfitEsistenti = [] }) {
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

  // Archetipi correnti (array)
  const archetipiCorr = outfit.archetipi_compatibili || (outfit.archetipo_compatibile ? [outfit.archetipo_compatibile] : []);
  const rarConf = OUTFIT_CONFIG_DEFAULT.rarità[outfit.rarita] || OUTFIT_CONFIG_DEFAULT.rarità.comune;
  const maxArchetipiAdmin = rarConf.archetipiMax < 0 ? ARCHETIPI.length : rarConf.archetipiMax;

  const toggleArchetipo = (id) => {
    const curr = [...archetipiCorr];
    const idx = curr.indexOf(id);
    if (idx >= 0) {
      curr.splice(idx, 1);
    } else {
      if (curr.length >= maxArchetipiAdmin) {
        flash(`Massimo ${maxArchetipiAdmin} archetipi per rarità ${outfit.rarita}`, '#f59e0b');
        return;
      }
      curr.push(id);
    }
    setOutfit({ ...outfit, archetipi_compatibili: curr, archetipo_compatibile: curr[0] || '' });
  };

  // Auto-generazione abilità
  const autoGenera = () => {
    if (outfit.rarita === 'comune') { flash('I comuni non hanno abilità', '#f59e0b'); return; }
    const abilita = autoGeneraAbilita(outfit.rarita, archetipiCorr[0] || '', outfitEsistenti);
    setOutfit({ ...outfit, abilita });
    flash('Abilità auto-generata! Puoi modificarla.', '#06d6a0');
  };

  // Abilità: gestione effetti (singolo o doppio)
  const isDoppia = outfit.rarita === 'leggendario' || outfit.rarita === 'immersivo';
  const STAT_OPTS = [
    { v: 'tette', l: '💗 Tette' }, { v: 'taglia_piedi', l: '🦶 Piedi' },
    { v: 'eta', l: '⏳ Età' }, { v: 'colore_capelli', l: '💇 Capelli' },
    { v: 'esperienza', l: '⭐ Esperienza' },
  ];
  const TIPO_OPTS = [
    { v: 'stat_up_self',   l: '↑ Boost stat propria' },
    { v: 'stat_down_self', l: '↓ Abbassa stat propria' },
    { v: 'stat_up_opp',   l: '⬆ Boost stat avversaria' },
    { v: 'stat_down_opp', l: '⬇ Abbassa stat avversaria' },
  ];

  const effetti = outfit.abilita?.tipo === 'doppia'
    ? (outfit.abilita.effetti || [{}, {}])
    : outfit.abilita ? [outfit.abilita] : [{}];

  const setEffetto = (i, patch) => {
    if (!isDoppia || (outfit.abilita?.tipo !== 'doppia' && i === 0)) {
      // abilità singola
      setOutfit({ ...outfit, abilita: { ...(outfit.abilita || {}), ...patch } });
    } else {
      const newEff = [...effetti];
      newEff[i] = { ...newEff[i], ...patch };
      const descParts = newEff.map(e => e.descrizione || `${e.tipo || ''} ${e.stat || ''}`).join(' | ');
      setOutfit({ ...outfit, abilita: { tipo: 'doppia', effetti: newEff, descrizione: descParts } });
    }
  };

  const switchTipoDoppia = (usaDoppia) => {
    if (usaDoppia) {
      const eff1 = { tipo: 'stat_up_self', stat: 'esperienza', valore: 2, descrizione: '+2 Esp.' };
      const eff2 = { tipo: 'stat_down_opp', stat: 'tette', valore: 1, descrizione: '-1 Tette avv.' };
      setOutfit({ ...outfit, abilita: { tipo: 'doppia', effetti: [eff1, eff2], descrizione: '+2 Esp. | -1 Tette avv.' } });
    } else {
      setOutfit({ ...outfit, abilita: { tipo: 'stat_up_self', stat: 'esperienza', valore: 2, descrizione: '+2 Esperienza' } });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>✦ {outfit.id ? 'MODIFICA' : 'NUOVO'} OUTFIT</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onAnnulla} style={btnSecondario}>ANNULLA</button>
          <button onClick={() => onSalva(outfit)} disabled={!outfit.nome} style={{ ...btnPrimario, opacity: !outfit.nome ? 0.4 : 1 }}>💾 SALVA</button>
        </div>
      </div>

      {/* Campi base */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Field label="Nome"><input value={outfit.nome} onChange={e => setOutfit({ ...outfit, nome: e.target.value })} style={inputStyle} /></Field>
        <Field label="Rarità">
          <select value={outfit.rarita} onChange={e => setOutfit({ ...outfit, rarita: e.target.value, archetipi_compatibili: [] })} style={inputStyle}>
            {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          </select>
        </Field>
        <Field label="Slot">
          <select value={outfit.slot} onChange={e => setOutfit({ ...outfit, slot: e.target.value })} style={inputStyle}>
            {Object.entries(SLOT_OUTFIT).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          </select>
        </Field>
        <Field label="Forma SVG (fallback senza asset)">
          <select value={outfit.forma} onChange={e => setOutfit({ ...outfit, forma: e.target.value })} style={inputStyle}>
            {outfit.slot === 'faccia' && ['glasses', 'tiara', 'earrings', 'hat', 'mask'].map(f => <option key={f} value={f}>{f}</option>)}
            {outfit.slot === 'petto' && ['tshirt', 'dress', 'bikini', 'corset', 'armor'].map(f => <option key={f} value={f}>{f}</option>)}
            {outfit.slot === 'gambe' && ['pants', 'skirt', 'tights'].map(f => <option key={f} value={f}>{f}</option>)}
            {outfit.slot === 'piedi' && ['sneakers', 'boots', 'heels', 'sandals'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Colore primario"><input type="color" value={outfit.colore} onChange={e => setOutfit({ ...outfit, colore: e.target.value })} style={{ ...inputStyle, padding: 4, height: 42 }} /></Field>
      </div>

      {/* ── ARCHETIPI COMPATIBILI ── */}
      <div style={{ background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.25)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: '#9b59ff', letterSpacing: 2, fontSize: 12 }}>
            ⚜ ARCHETIPI COMPATIBILI ({archetipiCorr.length}/{maxArchetipiAdmin})
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,230,211,0.4)', fontFamily: 'Orbitron' }}>
            {outfit.rarita === 'comune' ? 'Max 1 al Lv.1, fino a 5' :
             outfit.rarita === 'raro' ? 'Parte da 2, max 7' :
             outfit.rarita === 'epico' ? 'Parte da 2, max 10' :
             'Parte da 3 — Lv.10 = tutti'}
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(245,230,211,0.35)', marginBottom: 10, fontFamily: 'Orbitron' }}>
          L'ordine conta: il 1° è il principale. Gli archetipi si sbloccano col livello outfit (ogni {OUTFIT_CONFIG_DEFAULT.copiePerLivello} copie).
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ARCHETIPI.map(a => {
            const sel = archetipiCorr.includes(a.id);
            const posizione = archetipiCorr.indexOf(a.id);
            return (
              <button key={a.id} onClick={() => toggleArchetipo(a.id)} style={{
                padding: '4px 10px', fontSize: 10, borderRadius: 6, cursor: 'pointer',
                background: sel ? 'rgba(155,89,255,0.3)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sel ? '#9b59ff' : 'rgba(255,255,255,0.1)'}`,
                color: sel ? '#c084fc' : 'rgba(245,230,211,0.5)',
                fontFamily: 'Orbitron', fontWeight: sel ? 700 : 400,
              }}>
                {sel && <span style={{ color: '#ffd666', marginRight: 4 }}>#{posizione + 1}</span>}
                {a.nome}
              </button>
            );
          })}
        </div>
        {archetipiCorr.length === 0 && (
          <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 8, fontFamily: 'Orbitron' }}>
            ⚠ Nessun archetipo selezionato: l'outfit non potrà essere equipaggiato.
          </div>
        )}
      </div>

      {/* ── ABILITÀ OUTFIT (solo non-comune) ── */}
      {outfit.rarita && outfit.rarita !== 'comune' && (
        <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 12 }}>✦ ABILITÀ OUTFIT (IN BATTAGLIA)</div>
            <button onClick={autoGenera} style={{ ...btnSecondario, fontSize: 10, padding: '4px 10px' }}>🎲 AUTO-GENERA</button>
          </div>

          {/* Switch singola / doppia (solo leggendario/immersivo) */}
          {isDoppia && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={() => switchTipoDoppia(false)} style={{
                ...btnSecondario, fontSize: 10, padding: '4px 12px',
                background: outfit.abilita?.tipo !== 'doppia' ? 'rgba(168,85,247,0.25)' : 'transparent',
                border: `1px solid ${outfit.abilita?.tipo !== 'doppia' ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
              }}>1 Effetto</button>
              <button onClick={() => switchTipoDoppia(true)} style={{
                ...btnSecondario, fontSize: 10, padding: '4px 12px',
                background: outfit.abilita?.tipo === 'doppia' ? 'rgba(245,158,11,0.25)' : 'transparent',
                border: `1px solid ${outfit.abilita?.tipo === 'doppia' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
              }}>✦ 2 Effetti (Doppia)</button>
            </div>
          )}

          {/* Griglia effetti */}
          {(outfit.abilita?.tipo === 'doppia' ? [0, 1] : [0]).map(i => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 12, marginBottom: 8,
              border: i === 0 ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(245,158,11,0.3)',
            }}>
              {outfit.abilita?.tipo === 'doppia' && (
                <div style={{ fontSize: 9, color: i === 0 ? '#a855f7' : '#f59e0b', fontFamily: 'Orbitron', marginBottom: 8, letterSpacing: 1 }}>
                  {i === 0 ? '● EFFETTO 1' : '● EFFETTO 2'}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <Field label="Tipo">
                  <select value={effetti[i]?.tipo || ''} onChange={e => setEffetto(i, { tipo: e.target.value })} style={inputStyle}>
                    <option value="">— Nessuna —</option>
                    {TIPO_OPTS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </Field>
                <Field label="Statistica">
                  <select value={effetti[i]?.stat || ''} onChange={e => setEffetto(i, { stat: e.target.value })} style={inputStyle}>
                    <option value="">— Seleziona —</option>
                    {STAT_OPTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </Field>
                <Field label="Valore">
                  <input type="number" min={1} max={10}
                    value={effetti[i]?.valore || ''}
                    onChange={e => setEffetto(i, { valore: parseInt(e.target.value) || 0 })}
                    style={inputStyle} placeholder="es. 2" />
                </Field>
                <Field label="Descrizione (max 30 car)">
                  <input type="text" maxLength={30}
                    value={effetti[i]?.descrizione || ''}
                    onChange={e => setEffetto(i, { descrizione: e.target.value })}
                    style={inputStyle} placeholder="es. +2 Esperienza" />
                </Field>
              </div>
            </div>
          ))}

          {/* Anteprima abilità */}
          {outfit.abilita && (
            <div style={{ marginTop: 6, fontSize: 9, color: '#a855f7', fontFamily: 'Orbitron', letterSpacing: 1 }}>
              📋 Preview: {outfit.abilita.tipo === 'doppia'
                ? outfit.abilita.effetti?.map(e => e.descrizione || '-').join(' | ')
                : outfit.abilita.descrizione || `${outfit.abilita.tipo} su ${outfit.abilita.stat}`}
            </div>
          )}
        </div>
      )}

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
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [filtroAsset, setFiltroAsset] = useState('tutti');
  const [filtroNome, setFiltroNome] = useState('');

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

  let filtrate = pose;
  if (filtroRarita !== 'tutte') filtrate = filtrate.filter(p => p.rarita === filtroRarita);
  if (filtroAsset === 'presenti') filtrate = filtrate.filter(p => p.asset);
  if (filtroAsset === 'mancanti') filtrate = filtrate.filter(p => !p.asset);
  if (filtroNome) filtrate = filtrate.filter(p => p.nome.toLowerCase().includes(filtroNome.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={titoloSec}>⚜ CATALOGO POSE ({filtrate.length}/{pose.length})</h2>
        <button onClick={nuova} style={btnPrimario}>+ NUOVA POSA</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="🔍 Cerca..." style={{ ...inputStyle, width: 140, padding: 5, fontSize: 10 }} />
        <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={{ ...inputStyle, width: 110, padding: 5, fontSize: 10 }}>
          <option value="tutte">Tutte rarità</option>
          {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
        </select>
        <select value={filtroAsset} onChange={e => setFiltroAsset(e.target.value)} style={{ ...inputStyle, width: 120, padding: 5, fontSize: 10 }}>
          <option value="tutti">Tutti asset</option>
          <option value="presenti">✓ Con asset</option>
          <option value="mancanti">✗ Senza</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {filtrate.map(p => {
          const rar = RARITA[p.rarita] || RARITA.comune;
          const w = waifu.find(x => x.id === p.waifu_id);
          return <div key={p.id} style={{
            padding: 10, borderRadius: 8,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${rar.colore}80`,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: rar.colore, fontSize: 13 }}>{p.nome}</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>per: {w?.nome || '⚠ non trovata'}</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Asset: {p.asset ? '✓' : '✗'}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button onClick={() => setEd(p)} style={btnSecondario}>MOD</button>
              <button onClick={() => elimina(p.id)} style={{ ...btnSecondario, color: '#ef4444' }}>✕</button>
            </div>
          </div>;
        })}
        {filtrate.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, opacity: 0.6 }}>Nessuna posa corrisponde ai filtri.</div>}
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
function DistribTab({ waifu, outfit, pose }) {
  const sugg = suggerisciDiversificazione(waifu);

  // Waifu stats distributions
  const raritaCount = {};
  Object.keys(RARITA).forEach(k => { raritaCount[k] = 0; });
  waifu.forEach(w => { raritaCount[w.rarita] = (raritaCount[w.rarita] || 0) + 1; });

  const assetCount = { conImmagine: 0, senzaImmagine: 0 };
  waifu.forEach(w => { if (w.asset_statica || w.asset_immersiva) assetCount.conImmagine++; else assetCount.senzaImmagine++; });

  // Outfit distributions
  const outfitRarita = {}; Object.keys(RARITA).forEach(k => { outfitRarita[k] = 0; });
  const outfitSlot = {}; Object.keys(SLOT_OUTFIT).forEach(k => { outfitSlot[k] = 0; });
  const outfitAsset = { con: 0, senza: 0 };
  outfit.forEach(o => { outfitRarita[o.rarita] = (outfitRarita[o.rarita] || 0) + 1; outfitSlot[o.slot] = (outfitSlot[o.slot] || 0) + 1; if (o.asset) outfitAsset.con++; else outfitAsset.senza++; });

  // Pose distributions
  const poseRarita = {}; Object.keys(RARITA).forEach(k => { poseRarita[k] = 0; });
  const poseAsset = { con: 0, senza: 0 };
  pose.forEach(p => { poseRarita[p.rarita] = (poseRarita[p.rarita] || 0) + 1; if (p.asset) poseAsset.con++; else poseAsset.senza++; });

  // Bar chart helper
  const BarChart = ({ data, title, icon }) => {
    const maxVal = Math.max(1, ...data.map(d => d.value));
    return (
      <div style={cardStat}>
        <h3 style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 12, marginBottom: 12, marginTop: 0 }}>{icon} {title}</h3>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 80, fontSize: 10, color: d.color || '#f5e6d3', textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
            <div style={{ flex: 1, height: 16, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${(d.value / maxVal) * 100}%`, height: '100%',
                background: `linear-gradient(90deg, ${d.color || '#a855f7'}cc, ${d.color || '#a855f7'})`,
                borderRadius: 4, transition: 'width 0.5s',
                boxShadow: `0 0 8px ${d.color || '#a855f7'}40`,
              }} />
              <div style={{ position: 'absolute', right: 4, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }}>{d.value}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h2 style={titoloSec}>📊 DISTRIBUZIONE CATALOGO</h2>

      {/* SEZIONE WAIFU */}
      <div style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', letterSpacing: 3, fontSize: 14, marginTop: 16, marginBottom: 8 }}>👑 WAIFU ({waifu.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        <BarChart title="PER RARITÀ" icon="★" data={Object.entries(RARITA).map(([k, v]) => ({ label: v.nome, value: raritaCount[k] || 0, color: v.colore }))} />
        <BarChart title="ASSET IMMAGINI" icon="🖼" data={[
          { label: 'Con immagine', value: assetCount.conImmagine, color: '#06d6a0' },
          { label: 'Senza', value: assetCount.senzaImmagine, color: '#ef4444' },
        ]} />
        <BarChart title="ARCHETIPI" icon="📋" data={sugg.distribuzioneArche.slice(0, 10).map(a => ({ label: a.nome.substring(0, 14), value: a.conta, color: a.conta === 0 ? '#06d6a0' : a.conta > 2 ? '#ef4444' : '#a855f7' }))} />
        <BarChart title="PALETTE" icon="🎨" data={sugg.distribuzionePalette.map(p => ({ label: p.nome.substring(0, 14), value: p.conta, color: p.conta === 0 ? '#06d6a0' : p.conta > 2 ? '#ef4444' : '#3b82f6' }))} />
      </div>

      {/* SEZIONE OUTFIT */}
      <div style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 3, fontSize: 14, marginBottom: 8 }}>✦ OUTFIT ({outfit.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        <BarChart title="PER RARITÀ" icon="★" data={Object.entries(RARITA).map(([k, v]) => ({ label: v.nome, value: outfitRarita[k] || 0, color: v.colore }))} />
        <BarChart title="PER SLOT" icon="👔" data={Object.entries(SLOT_OUTFIT).map(([k, v]) => ({ label: v.nome, value: outfitSlot[k] || 0, color: '#ec4899' }))} />
        <BarChart title="ASSET" icon="🖼" data={[
          { label: 'Con asset', value: outfitAsset.con, color: '#06d6a0' },
          { label: 'Senza', value: outfitAsset.senza, color: '#ef4444' },
        ]} />
      </div>

      {/* SEZIONE POSE */}
      <div style={{ fontFamily: 'Cinzel, serif', color: '#ec4899', letterSpacing: 3, fontSize: 14, marginBottom: 8 }}>⚜ POSE ({pose.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <BarChart title="PER RARITÀ" icon="★" data={Object.entries(RARITA).map(([k, v]) => ({ label: v.nome, value: poseRarita[k] || 0, color: v.colore }))} />
        <BarChart title="ASSET" icon="🖼" data={[
          { label: 'Con asset', value: poseAsset.con, color: '#06d6a0' },
          { label: 'Senza', value: poseAsset.senza, color: '#ef4444' },
        ]} />
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
// TAB: CARICAMENTO MASSIVO
// Permette di caricare fino a 200 immagini e creare waifu automaticamente.
// Usa l'API Anthropic per analizzare le immagini e estrarre stats (tette, età, capelli)
// Se l'API non è disponibile, usa generazione random distribuita.
// ============================================================

// === NOMI WAIFU CASUALI (pool di ~250 nomi anime-style) ===
// ============================================================
// SISTEMA NOMI — capacità >2500 nomi unici stilisticamente coerenti
// Livello 1: pool di nomi singoli (~400)
// Livello 2: combinazioni Kanji-prefisso + suffisso giapponese (~900)
// Livello 3: titolo + nome dal pool (~800)
// Livello 4: nome + epiteto (~illimitato)
// ============================================================

const _NOMI_GIAPPONESI = [
  'Akira','Yuki','Sakura','Hana','Rei','Miku','Sora','Luna','Aria','Kaede','Aoi','Rin','Kira','Mei','Yui','Nana','Hime','Runa','Mio',
  'Tsubaki','Ayame','Shiori','Akane','Hotaru','Hinata','Asuka','Misaki','Nagisa','Chihiro','Izumi','Kohaku','Tamaki','Madoka','Sumire','Tsumugi','Kurumi','Shion','Amane','Hibiki',
  'Kazuha','Fubuki','Tsukiko','Hikari','Miyu','Nanami','Haruka','Kotone','Ayaka','Setsuna','Mitsuki','Suzume','Kaguya','Yuzuki','Chiaki','Minori','Tohka','Shinobu','Kokona','Kanon',
  'Miyako','Chiyo','Tomoe','Katsumi','Ryoko','Momiji','Utaha','Futaba','Ichika','Natsuki','Sayuri','Wakana','Suzuha','Mashiro','Tomoyo','Yuzuha','Kirari','Himari','Riko','Saki',
  'Raijin','Tsukuyomi','Amaterasu','Benzaiten','Kushinada','Tamamo','Inari','Komachi','Otohime','Murasaki','Kagero','Shizuka','Tokiwa','Yugiri','Koruri','Yaegashi',
  'Kohana','Asahi','Mizuki','Tsuki','Hoshi','Naomi','Fumika','Suzu','Akemi','Tomoka','Haruna','Kazane','Yukino','Kotoha','Satsuki','Futami','Asuka','Honoka','Kasumi','Akiha',
  'Yuna','Lulu','Tifa','Aerith','Rinoa','Garnet','Quistis','Fang','Vanille','Rem','Ram','Emilia','Beatrice','Shiro','Zero','Echidna','Petra','Felt','Crusch','Priscilla',
];

const _NOMI_FANTASY_OCCIDENTALI = [
  'Elysia','Vesper','Seraphina','Astrid','Freya','Morgana','Isolde','Celeste','Lilith','Vivienne','Cordelia','Evangeline','Artemis','Calypso','Ophelia','Rowena','Elara','Aurelia','Sylene','Nephira',
  'Valentina','Rosaria','Cassandra','Theodora','Lucretia','Anastasia','Gabriella','Isadora','Penelope','Seraphine','Lysandra','Demetria','Calliope','Andromeda','Persephone','Alcyone','Iphigenia','Xanthe','Melisande',
  'Lyra','Cleo','Thalia','Zoe','Selene','Athena','Hera','Aphrodite','Demeter','Hestia','Nike','Rhea','Gaia','Eos','Nyx','Tyche','Aura','Metis','Bia','Iris',
  'Titania','Gloriana','Bramble','Clover','Wren','Lark','Ivy','Fern','Dahlia','Jasmine','Violet','Orchid','Marigold','Heather','Laurel','Willow','Azalea','Camellia','Petunia','Wisteria',
  'Elira','Vespera','Soleil','Lunara','Stellara','Aurore','Celestine','Serenelle','Mirabelle','Vivara','Thalindra','Elyndra','Veloris','Sylvara','Arandel','Lirien','Faelith','Caldwen','Mirveth','Aerindel',
  'Beatrix','Rowena','Isolde','Gwendolyn','Imogen','Cecily','Rosalind','Guinevere','Elspeth','Matilda','Constance','Philippa','Meredith','Sybil','Aveline','Odette','Genevieve','Arabella','Claudine','Adeline',
];

const _NOMI_FANTASY_ORIENTALI = [
  'Zara','Kali','Indira','Priya','Lakshmi','Savitri','Radha','Durga','Parvati','Sita','Kamala','Ananya','Tara','Maya','Devi','Nisha','Asha','Chandra','Ganga','Saraswati',
  'Crimson','Velvet','Zephyra','Tempest','Eclipse','Solana','Nebula','Vortex','Blaze','Frost','Shadow','Ember','Dawn','Dusk','Storm','Crystal','Phantom','Raven','Phoenix',
  'Cipher','Neon','Pixel','Glitch','Chrome','Surge','Pulse','Flux','Hexa','Volt','Quartz','Nexus','Onyx','Prism','Zenith','Nova','Astra','Binary','Blade','Data',
  'Byakko','Suzaku','Genbu','Seiryu','Kirin','Raiju','Tengu','Yatagarasu','Baku','Kitsune','Tanuki','Yamabiko','Itachi','Karura','Mizuchi','Orochi','Ryujin','Fujin','Raiden','Izanami',
];

// Pool unico deduplicato (Livello 1: ~400 nomi)
const NOMI_POOL = [...new Set([..._NOMI_GIAPPONESI, ..._NOMI_FANTASY_OCCIDENTALI, ..._NOMI_FANTASY_ORIENTALI])];

// Livello 2: combinazioni kanji-radice + suffisso (~900 combinazioni)
const _RADICI = [
  'Aka','Ao','Haku','Kuro','Shiro','Kin','Gin','Hi','Tsuki','Hoshi','Yoru','Asa','Kaze','Umi','Yama',
  'Mizu','Tori','Hana','Sora','Kumo','Kage','Hono','Kori','Ishi','Kawa','Mori','Seki','Kusa','Yuki','Fune',
];
const _SUFFISSI = [
  'hime','ko','mi','ka','na','ra','ha','no','ki','ri','ya','sa','wa','ne','to',
  'yo','ru','me','chi','su','fu','ma','ho','re','ni','ta','se','ka','shi','zu',
];

// Livello 3: titoli + nome dal pool (~800 combinazioni)
const _TITOLI = [
  'Dark','Iron','Silver','Golden','Crimson','Shadow','Void','Star','Moon','Sun',
  'Storm','Frost','Flame','Night','Dawn','Dusk','Azure','Scarlet','Obsidian','Ivory',
  'Phantom','Crystal','Arcane','Divine','Fallen','Sacred','Ancient','Eternal','Celestial','Infernal',
];

// Livello 4: epiteti unici da appendere
const _EPITETI = [
  'the Unyielding','the Radiant','the Silent','the Fierce','the Wanderer','the Forgotten',
  'the Eternal','the Cursed','the Blessed','the Unbroken','the Vanished','the Reborn',
  'of the Abyss','of the Stars','of the Void','of the Dawn','of the Dusk','of the Storm',
  'the Undying','the Exiled','the Chosen','the Lost','the Awakened','the Sealed',
];

function generaNomeUnico(usati) {
  // Livello 1: pool diretto
  const disponibili = NOMI_POOL.filter(n => !usati.has(n));
  if (disponibili.length > 0) {
    return disponibili[Math.floor(Math.random() * disponibili.length)];
  }

  // Livello 2: radice + suffisso (~900 combinazioni)
  const radiciShuf = [..._RADICI].sort(() => Math.random() - 0.5);
  const sufShuf = [..._SUFFISSI].sort(() => Math.random() - 0.5);
  for (const r of radiciShuf) {
    for (const s of sufShuf) {
      const c = r.charAt(0).toUpperCase() + r.slice(1) + s;
      if (!usati.has(c)) return c;
    }
  }

  // Livello 3: titolo + nome dal pool (~800 combinazioni)
  const titoliShuf = [..._TITOLI].sort(() => Math.random() - 0.5);
  const nomiShuf = [...NOMI_POOL].sort(() => Math.random() - 0.5);
  for (const t of titoliShuf) {
    for (const n of nomiShuf) {
      const c = `${t} ${n}`;
      if (!usati.has(c)) return c;
    }
  }

  // Livello 4: nome + epiteto (~400 × 24 = ~9600 combinazioni, copre qualsiasi scenario)
  for (const n of nomiShuf) {
    for (const e of _EPITETI) {
      const c = `${n} ${e}`;
      if (!usati.has(c)) return c;
    }
  }

  // Ultimo fallback numerico (non raggiungibile in pratica)
  let i = 1;
  while (usati.has(`Waifu ${i}`)) i++;
  return `Waifu ${i}`;
}

// === DISTRIBUZIONE RARITÀ BILANCIATA ===
function assegnaRaritaDistribuita(indice, totale) {
  // Distribuzione: ~55% comune, ~27% raro, ~12% epico, ~5% legg, ~1% immersivo
  const pct = indice / totale;
  if (pct < 0.55) return 'comune';
  if (pct < 0.82) return 'raro';
  if (pct < 0.94) return 'epico';
  if (pct < 0.99) return 'leggendario';
  return 'immersivo';
}

// === GENERAZIONE STATS RANDOM CON DISTRIBUZIONE ===
function generaStatsRandom(indice, totale) {
  // Distribuzione variata per evitare clustering
  const seed = indice * 7919 + 1013; // numeri primi per distribuzione
  return {
    tette:          Math.max(1,  Math.min(7,    1  + ((seed)      % 7))),   // 1-7
    taglia_piedi:   Math.max(34, Math.min(45,   34 + ((seed >> 3) % 12))),  // 34-45
    eta:            Math.max(1,  Math.min(5000, 1  + ((seed >> 5) % 100))), // 1-5000 (inizialmente valori ragionevoli 1-100)
    colore_capelli: Math.max(1,  Math.min(10,   1  + ((seed >> 8) % 10))),  // 1-10
    esperienza:     Math.max(0,  Math.min(5000, 0  + ((seed >> 10) % 201))),// 0-5000 (inizialmente 0-200)
  };
}

// === PROMPT PER ANALISI AI ===
const ANALYSIS_SYSTEM_PROMPT = `Sei un analizzatore di immagini anime. Data un'immagine di un personaggio anime, devi stimare queste statistiche. Rispondi SOLO con un JSON valido, niente altro testo.

Il JSON deve avere questi campi:
- "tette": intero da 1 a 7 (1=piatte/petite, 3=medie, 5=grandi, 7=enormi fantasy)
- "eta": intero tra 1 e 5000 (età apparente, la maggior parte 14-30; valori > 100 per creature antiche/non umane)
- "colore_capelli": intero da 1 a 10 (1=castano, 2=nero, 3=biondo, 4=rosso, 5=argento, 6=blu, 7=viola, 8=rosa, 9=bicolore, 10=fantasy/arcobaleno)
- "hot": boolean — true se l'immagine/contesto suggerisce contenuto erotico, seduttivo o adulto (posa provocante, abbigliamento molto succinto, contesto sessuale esplicito o implicito); false altrimenti

Esempio di risposta: {"tette":4,"eta":22,"colore_capelli":3,"hot":false}`;

function BulkUploadTab({ waifu, ricarica, flash }) {
  const [files, setFiles] = useState([]);          // File[] delle immagini selezionate
  const [previews, setPreviews] = useState([]);     // {file, url, nome, stats, rarita, status}[]
  const [fase, setFase] = useState('select');       // 'select' | 'preview' | 'uploading' | 'done'
  const [progresso, setProgresso] = useState({ fatto: 0, totale: 0, errori: 0 });
  const [usaAI, setUsaAI] = useState(true);
  const [aiAnalisi, setAiAnalisi] = useState(false); // sta analizzando con AI?
  const [risultati, setRisultati] = useState([]);    // waifu create con successo

  const nomiUsati = new Set(waifu.map(w => w.nome));

  // Seleziona file
  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    if (selected.length > 200) {
      flash('Massimo 200 immagini alla volta!', '#ef4444');
      return;
    }
    setFiles(selected);

    // Genera previews con stats random iniziali e nomi
    const nomiLocali = new Set([...nomiUsati]);
    const shuffled = [...Array(selected.length).keys()].sort(() => Math.random() - 0.5);

    const prev = selected.map((file, i) => {
      const nome = generaNomeUnico(nomiLocali);
      nomiLocali.add(nome);
      const stats = generaStatsRandom(shuffled[i], selected.length);
      const rarita = assegnaRaritaDistribuita(shuffled[i], selected.length);
      return {
        file,
        url: URL.createObjectURL(file),
        nome,
        stats,
        rarita,
        archetipo: ARCHETIPI[i % ARCHETIPI.length].id,
        palette: PALETTE[i % PALETTE.length].id,
        status: 'pending',   // pending | analyzing | ready | uploading | done | error
        aiStats: null,
      };
    });
    setPreviews(prev);
    setFase('preview');
  };

  // Analisi AI delle immagini (opzionale)
  const analizzaConAI = async () => {
    setAiAnalisi(true);
    const aggiornati = [...previews];
    let analizzati = 0;

    for (let i = 0; i < aggiornati.length; i++) {
      aggiornati[i].status = 'analyzing';
      setPreviews([...aggiornati]);

      try {
        // Converti l'immagine in base64
        const base64 = await fileToBase64(aggiornati[i].file);
        const mediaType = aggiornati[i].file.type || 'image/jpeg';

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            system: ANALYSIS_SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                { type: 'text', text: 'Analizza questa immagine anime e stima le statistiche. Rispondi SOLO con il JSON.' }
              ]
            }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.content?.map(c => c.text || '').join('') || '';
          const clean = text.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(clean);

          // Valida e clamp i valori sui nuovi range
          aggiornati[i].stats = {
            ...aggiornati[i].stats,
            tette: Math.max(1, Math.min(7, parsed.tette || aggiornati[i].stats.tette)),
            eta: Math.max(1, Math.min(5000, parsed.eta || aggiornati[i].stats.eta)),
            colore_capelli: Math.max(1, Math.min(10, parsed.colore_capelli || aggiornati[i].stats.colore_capelli)),
          };
          // Campo hot rilevato dall'AI
          if (parsed.hot !== undefined) aggiornati[i].hot = !!parsed.hot;
          aggiornati[i].aiStats = parsed;
          aggiornati[i].status = 'ready';
          analizzati++;
        } else {
          aggiornati[i].status = 'ready'; // Fallback: usa stats random
        }
      } catch (err) {
        console.warn(`Analisi AI fallita per ${aggiornati[i].nome}:`, err.message);
        aggiornati[i].status = 'ready'; // Fallback: usa stats random
      }

      setPreviews([...aggiornati]);

      // Piccola pausa per non saturare l'API
      if (i < aggiornati.length - 1) await sleep(300);
    }

    setAiAnalisi(false);
    flash(`Analisi completata: ${analizzati}/${aggiornati.length} con AI`, '#06d6a0');
  };

  // Upload massivo + creazione waifu
  const avviaUpload = async () => {
    // Controlla unicità nomi prima di partire
    const nomiNelBatch = previews.map(p => p.nome);
    const duplicatiNelBatch = nomiNelBatch.filter((n, i) => nomiNelBatch.indexOf(n) !== i);
    const duplicatiConFirestore = nomiNelBatch.filter(n => nomiUsati.has(n));
    const tuttiDuplicati = [...new Set([...duplicatiNelBatch, ...duplicatiConFirestore])];
    if (tuttiDuplicati.length > 0) {
      flash(`Nomi duplicati: ${tuttiDuplicati.slice(0, 3).join(', ')}${tuttiDuplicati.length > 3 ? ` +${tuttiDuplicati.length - 3} altri` : ''}. Correggi prima di caricare.`, '#ef4444');
      return;
    }
    setFase('uploading');
    setProgresso({ fatto: 0, totale: previews.length, errori: 0 });
    const riusciti = [];
    let errori = 0;

    for (let i = 0; i < previews.length; i++) {
      const p = previews[i];
      try {
        // 1) Upload immagine su Cloudinary
        const formData = new FormData();
        formData.append('file', p.file);
        formData.append('folder', 'waifu');
        formData.append('publicId', `bulk_${p.nome.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`);

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Upload immagine fallito');
        const { url } = await uploadRes.json();

        // 2) Crea waifu in Firestore
        const waifuData = {
          nome: p.nome,
          rarita: p.rarita,
          tette: p.stats.tette,
          taglia_piedi: p.stats.taglia_piedi,
          eta: p.stats.eta,
          colore_capelli: p.stats.colore_capelli,
          esperienza: p.stats.esperienza,
          archetipo: p.archetipo,
          palette: p.palette,
          asset_statica: url,
          asset_paperdoll: '',
          asset_immersiva: p.rarita === 'leggendario' || p.rarita === 'immersivo' ? url : '',
          fillers: { outfit: '', fanservice: '', posa: '' },
          hot: p.hot === true, // rilevato da AI o impostato manualmente
        };

        const newId = await upsertWaifu(null, waifuData);
        riusciti.push({ ...waifuData, id: newId, imageUrl: url });

        // Aggiorna preview
        previews[i].status = 'done';
        setPreviews([...previews]);
      } catch (err) {
        console.error(`Errore waifu ${p.nome}:`, err);
        previews[i].status = 'error';
        setPreviews([...previews]);
        errori++;
      }

      setProgresso({ fatto: i + 1, totale: previews.length, errori });

      // Piccola pausa per non sovraccaricare
      if (i < previews.length - 1) await sleep(200);
    }

    setRisultati(riusciti);
    setFase('done');
    ricarica();
    flash(`${riusciti.length} waifu create! (${errori} errori)`, errori > 0 ? '#f59e0b' : '#06d6a0');
  };

  // Modifica singola preview
  const aggiornaPreview = (index, campo, valore) => {
    const nuovo = [...previews];
    if (campo.startsWith('stats.')) {
      const statKey = campo.split('.')[1];
      nuovo[index].stats[statKey] = parseInt(valore) || 0;
    } else {
      nuovo[index][campo] = valore;
    }
    setPreviews(nuovo);
  };

  // Nomi duplicati: set di nomi che compaiono più di una volta nel batch o già in Firestore
  const nomiDuplicati = (() => {
    const contatore = {};
    previews.forEach(p => { contatore[p.nome] = (contatore[p.nome] || 0) + 1; });
    const duplicatiNelBatch = new Set(Object.keys(contatore).filter(n => contatore[n] > 1));
    const duplicatiInFirestore = new Set(previews.map(p => p.nome).filter(n => nomiUsati.has(n)));
    return new Set([...duplicatiNelBatch, ...duplicatiInFirestore]);
  })();

  // Rimuovi singola preview
  const rimuoviPreview = (index) => {
    const nuovo = previews.filter((_, i) => i !== index);
    setPreviews(nuovo);
  };

  // Rigenerazione random di tutte le stats
  const rigeneraStats = () => {
    const shuffled = [...Array(previews.length).keys()].sort(() => Math.random() - 0.5);
    const nuovo = previews.map((p, i) => ({
      ...p,
      stats: generaStatsRandom(shuffled[i] + Date.now(), previews.length),
      rarita: assegnaRaritaDistribuita(shuffled[i], previews.length),
    }));
    setPreviews(nuovo);
    flash('Stats rigenerate!');
  };

  // Reset
  const reset = () => {
    setFiles([]); setPreviews([]); setFase('select');
    setProgresso({ fatto: 0, totale: 0, errori: 0 }); setRisultati([]);
  };

  // ======== RENDER ========

  // FASE: SELEZIONE FILE
  if (fase === 'select') {
    return (
      <div>
        <h2 style={titoloSec}>🚀 CARICAMENTO MASSIVO WAIFU</h2>
        <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: 14, marginBottom: 16, marginTop: 12 }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', letterSpacing: 2, fontSize: 12, marginBottom: 6 }}>ℹ COME FUNZIONA</div>
          <div style={{ fontSize: 12, lineHeight: 1.8, opacity: 0.85 }}>
            1. <strong>Seleziona fino a 200 immagini</strong> di waifu/personaggi anime<br/>
            2. Il sistema <strong>genera automaticamente</strong> nome, statistiche e rarità per ogni waifu<br/>
            3. <strong>(Opzionale)</strong> L'AI analizza le immagini e stima tette, età e colore capelli dall'immagine<br/>
            4. <strong>Puoi rivedere e modificare</strong> manualmente ogni waifu prima del caricamento<br/>
            5. <strong>Caricamento in batch</strong>: upload immagine su Cloudinary + creazione waifu in Firestore
          </div>
        </div>

        <div style={{
          border: '3px dashed rgba(245,158,11,0.4)',
          borderRadius: 16, padding: 60, textAlign: 'center',
          background: 'rgba(245,158,11,0.03)',
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
          onClick={() => document.getElementById('bulk-file-input').click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.background = 'rgba(245,158,11,0.03)'; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)';
            e.currentTarget.style.background = 'rgba(245,158,11,0.03)';
            const dt = e.dataTransfer;
            const input = document.getElementById('bulk-file-input');
            input.files = dt.files;
            handleFileSelect({ target: { files: dt.files } });
          }}
        >
          <div style={{ fontSize: 60, marginBottom: 12 }}>📁</div>
          <div style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: 18, letterSpacing: 3, marginBottom: 8 }}>
            TRASCINA O CLICCA
          </div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Seleziona fino a 200 immagini (.jpg, .png, .webp)
          </div>
          <input id="bulk-file-input" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, opacity: 0.5 }}>
          Waifu attuali nel catalogo: <strong>{waifu.length}</strong>
        </div>
      </div>
    );
  }

  // FASE: PREVIEW / REVISIONE
  if (fase === 'preview') {
    const countByRarity = {};
    previews.forEach(p => { countByRarity[p.rarita] = (countByRarity[p.rarita] || 0) + 1; });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={titoloSec}>🔍 REVISIONE ({previews.length} waifu)</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={reset} style={btnSecondario}>← INDIETRO</button>
            <button onClick={rigeneraStats} style={btnSecondario}>🎲 RIGENERA STATS</button>
            {!aiAnalisi && (
              <button onClick={analizzaConAI} style={{ ...btnPrimario, background: 'linear-gradient(135deg, #a855f7, #3b82f6)' }}>
                🤖 ANALIZZA CON AI ({previews.length} img)
              </button>
            )}
            <button onClick={avviaUpload} style={{ ...btnPrimario, opacity: (aiAnalisi || nomiDuplicati.size > 0) ? 0.5 : 1 }} disabled={aiAnalisi || nomiDuplicati.size > 0}>
              🚀 CARICA TUTTE ({previews.length}){nomiDuplicati.size > 0 ? ` — ⚠ ${nomiDuplicati.size} duplicati` : ''}
            </button>
          </div>
        </div>

        {/* Distribuzione rarità */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.entries(RARITA).map(([k, v]) => (
            <div key={k} style={{ padding: '4px 12px', borderRadius: 12, border: `1px solid ${v.colore}60`, fontSize: 11, color: v.colore }}>
              {'★'.repeat(v.stelle)} {v.nome}: <strong>{countByRarity[k] || 0}</strong>
            </div>
          ))}
        </div>

        {/* AI Analysis progress */}
        {aiAnalisi && (
          <div style={{ padding: 12, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#a855f7', fontWeight: 600, marginBottom: 6 }}>
              🤖 Analisi AI in corso... {previews.filter(p => p.status === 'ready' || p.status === 'done').length}/{previews.length}
            </div>
            <div style={{ height: 4, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(previews.filter(p => p.status !== 'pending' && p.status !== 'analyzing').length / previews.length) * 100}%`,
                height: '100%', background: 'linear-gradient(90deg, #a855f7, #3b82f6)', transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {/* Banner duplicati */}
        {nomiDuplicati.size > 0 && (
          <div style={{ marginBottom: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Cinzel, serif', color: '#ef4444', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                {nomiDuplicati.size} {nomiDuplicati.size === 1 ? 'nome duplicato' : 'nomi duplicati'} — correggi per poter caricare
              </div>
              <div style={{ fontSize: 10, color: 'rgba(239,68,68,0.7)' }}>
                {[...nomiDuplicati].slice(0, 5).join(', ')}{nomiDuplicati.size > 5 ? ` +${nomiDuplicati.size - 5} altri` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Griglia waifu preview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: '70vh', overflowY: 'auto', padding: 4 }}>
          {previews.map((p, i) => {
            const rar = RARITA[p.rarita] || RARITA.comune;
            const nomeDuplicato = nomiDuplicati.has(p.nome);
            return (
              <div key={i} style={{
                padding: 8, borderRadius: 8,
                background: nomeDuplicato ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${nomeDuplicato ? '#ef4444' : p.status === 'analyzing' ? '#a855f7' : p.status === 'error' ? '#ef4444' : rar.colore}60`,
                opacity: p.status === 'analyzing' ? 0.7 : 1,
                position: 'relative',
              }}>
                {/* Status badge */}
                {p.status === 'analyzing' && <div style={{ position: 'absolute', top: 4, right: 4, background: '#a855f7', color: '#fff', padding: '2px 6px', borderRadius: 8, fontSize: 8, letterSpacing: 1 }}>🤖 AI...</div>}
                {p.aiStats && !nomeDuplicato && <div style={{ position: 'absolute', top: 4, right: 4, background: '#06d6a0', color: '#000', padding: '2px 6px', borderRadius: 8, fontSize: 8, letterSpacing: 1 }}>✓ AI</div>}
                {nomeDuplicato && <div style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 8, fontSize: 8, letterSpacing: 1 }}>⚠ DUPLICATO</div>}

                {/* Preview immagine */}
                <img src={p.url} alt={p.nome} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />

                {/* Nome (editabile) */}
                <input value={p.nome} onChange={e => aggiornaPreview(i, 'nome', e.target.value)}
                  style={{ ...inputStyle, padding: 4, fontSize: 11, marginBottom: nomeDuplicato ? 2 : 4, fontWeight: 600, borderColor: nomeDuplicato ? '#ef4444' : undefined }} />
                {nomeDuplicato && (
                  <div style={{ fontSize: 9, color: '#ef4444', marginBottom: 4, lineHeight: 1.3 }}>
                    {nomiUsati.has(p.nome) ? '⚠ Esiste già in catalogo' : '⚠ Duplicato nel batch'}
                  </div>
                )}

                {/* Rarità */}
                <select value={p.rarita} onChange={e => aggiornaPreview(i, 'rarita', e.target.value)}
                  style={{ ...inputStyle, padding: 3, fontSize: 10, marginBottom: 4 }}>
                  {Object.entries(RARITA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
                </select>

                {/* Stats mini */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span>💗</span>
                    <input type="number" min="1" max="7" value={p.stats.tette}
                      onChange={e => aggiornaPreview(i, 'stats.tette', e.target.value)}
                      style={{ ...inputStyle, padding: 2, fontSize: 9, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span>🦶</span>
                    <input type="number" min="34" max="44" value={p.stats.taglia_piedi}
                      onChange={e => aggiornaPreview(i, 'stats.taglia_piedi', e.target.value)}
                      style={{ ...inputStyle, padding: 2, fontSize: 9, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span>⏳</span>
                    <input type="number" min="18" max="100" value={p.stats.eta}
                      onChange={e => aggiornaPreview(i, 'stats.eta', e.target.value)}
                      style={{ ...inputStyle, padding: 2, fontSize: 9, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span>💇</span>
                    <input type="number" min="1" max="10" value={p.stats.colore_capelli}
                      onChange={e => aggiornaPreview(i, 'stats.colore_capelli', e.target.value)}
                      style={{ ...inputStyle, padding: 2, fontSize: 9, width: '100%' }} />
                  </div>
                </div>

                {/* Bottone rimuovi */}
                <button onClick={() => rimuoviPreview(i)} style={{ ...btnSecondario, width: '100%', marginTop: 4, padding: '3px 0', fontSize: 9, borderColor: '#ef444440', color: '#ef4444' }}>✕ RIMUOVI</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // FASE: UPLOADING
  if (fase === 'uploading') {
    const pct = progresso.totale > 0 ? Math.round((progresso.fatto / progresso.totale) * 100) : 0;
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>🚀</div>
        <h2 style={{ ...titoloSec, marginBottom: 12 }}>CARICAMENTO IN CORSO...</h2>
        <div style={{ maxWidth: 400, margin: '0 auto' }}>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #06d6a0)', transition: 'width 0.3s', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 24, fontFamily: 'Cinzel, serif', color: '#f59e0b', fontWeight: 700 }}>{pct}%</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            {progresso.fatto} / {progresso.totale} completate
            {progresso.errori > 0 && <span style={{ color: '#ef4444' }}> · {progresso.errori} errori</span>}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>Non chiudere questa pagina durante il caricamento</div>
        </div>
      </div>
    );
  }

  // FASE: COMPLETATO
  if (fase === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
        <h2 style={{ ...titoloSec, marginBottom: 12, color: '#06d6a0' }}>CARICAMENTO COMPLETATO!</h2>
        <div style={{ fontSize: 14, marginBottom: 6 }}>
          <span style={{ color: '#06d6a0', fontWeight: 700 }}>{risultati.length}</span> waifu create con successo
        </div>
        {progresso.errori > 0 && (
          <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{progresso.errori} errori durante il caricamento</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={reset} style={btnPrimario}>📁 CARICA ALTRE</button>
          <button onClick={() => setFase('select')} style={btnSecondario}>← TORNA</button>
        </div>

        {/* Anteprima risultati */}
        {risultati.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: '#a855f7', letterSpacing: 2, marginBottom: 8 }}>ULTIME CREATE:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
              {risultati.slice(-20).map((w, i) => (
                <div key={i} style={{ padding: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: `1px solid ${RARITA[w.rarita]?.colore || '#666'}40` }}>
                  <img src={w.imageUrl} alt={w.nome} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 4 }} />
                  <div style={{ fontSize: 10, fontWeight: 600, color: RARITA[w.rarita]?.colore }}>{w.nome}</div>
                  <div style={{ fontSize: 9, opacity: 0.6 }}>{'★'.repeat(RARITA[w.rarita]?.stelle || 1)} {RARITA[w.rarita]?.nome}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

// Helper: File -> Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

// ============================================================
// TAB: CONFIGURAZIONE RANGE E UPGRADE STEPS
// ============================================================
function ConfigTab({ waifu, ricarica, flash }) {
  const STAT_KEYS = [
    { key: 'tette',          label: 'Tette',        icon: '✦' },
    { key: 'colore_capelli', label: 'Capelli',       icon: '✿' },
    { key: 'eta',            label: 'Età',           icon: '⌛' },
    { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘' },
    { key: 'esperienza',     label: 'Esperienza',    icon: '★' },
  ];

  const [ranges, setRanges] = useState({ ...STAT_RANGES_DEFAULT });
  const [steps, setSteps] = useState({ ...UPGRADE_STEPS_DEFAULT });
  const [outfitConf, setOutfitConf] = useState({ ...OUTFIT_CONFIG_DEFAULT });
  const [godPackProb, setGodPackProb] = useState(0.005); // default 0.5%
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bonifica, setBonifica] = useState(null); // null | { inCorso, risultati[] }

  useEffect(() => {
    (async () => {
      try {
        const rDoc = await getDoc(doc(db, 'config', 'stat_ranges'));
        if (rDoc.exists()) setRanges({ ...STAT_RANGES_DEFAULT, ...rDoc.data() });
        const sDoc = await getDoc(doc(db, 'config', 'upgrade_steps'));
        if (sDoc.exists()) setSteps({ ...UPGRADE_STEPS_DEFAULT, ...sDoc.data() });
        const oDoc = await getDoc(doc(db, 'config', 'outfit_config'));
        if (oDoc.exists()) setOutfitConf({ ...OUTFIT_CONFIG_DEFAULT, ...oDoc.data() });
        const gDoc = await getDoc(doc(db, 'config', 'pack_config'));
        if (gDoc.exists() && gDoc.data().god_pack_prob !== undefined) {
          setGodPackProb(Number(gDoc.data().god_pack_prob));
        }
      } catch (e) { /* usa defaults */ }
      setLoading(false);
    })();
  }, []);

  const salvaConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'stat_ranges'), ranges);
      await setDoc(doc(db, 'config', 'upgrade_steps'), steps);
      await setDoc(doc(db, 'config', 'outfit_config'), outfitConf);
      await setDoc(doc(db, 'config', 'pack_config'), { god_pack_prob: Number(godPackProb) });
      flash('Configurazione salvata!', '#06d6a0');
    } catch (e) { flash('Errore salvataggio: ' + e.message, '#ef4444'); }
    setSaving(false);
  };

  const avviaBonifica = async () => {
    if (!confirm(`Bonificare ${waifu.length} waifu con i range correnti?\nLe statistiche fuori range saranno clampate.`)) return;
    setBonifica({ inCorso: true, risultati: [] });
    const risultati = [];
    for (const w of waifu) {
      const patch = {};
      const dettagli = {}; // { key: { prima, dopo } }
      let modificata = false;
      for (const { key } of STAT_KEYS) {
        const r = ranges[key];
        if (!r) continue;
        const val = w[key];
        if (val === undefined || val === null) continue;
        const clamped = Math.max(r.min, Math.min(r.max, val));
        if (clamped !== val) {
          patch[key] = clamped;
          dettagli[key] = { prima: val, dopo: clamped };
          modificata = true;
        }
      }
      if (modificata) {
        try {
          await upsertWaifu(w.id, patch);
          risultati.push({ nome: w.nome, patch, dettagli, ok: true });
        } catch (e) {
          risultati.push({ nome: w.nome, dettagli, errore: e.message, ok: false });
        }
      }
    }
    setBonifica({ inCorso: false, risultati });
    ricarica();
    flash(`Bonifica completata: ${risultati.filter(r => r.ok).length} waifu corrette`, '#06d6a0');
  };

  const resetDefaults = () => {
    setRanges({ ...STAT_RANGES_DEFAULT });
    setSteps({ ...UPGRADE_STEPS_DEFAULT });
    setOutfitConf({ ...OUTFIT_CONFIG_DEFAULT });
    flash('Valori resettati ai default (non ancora salvati)', '#f59e0b');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#f59e0b', fontFamily: 'Cinzel, serif' }}>⏳ Caricamento configurazione...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ ...titoloSec, marginBottom: 6 }}>⚙ CONFIGURAZIONE</h2>
      <p style={{ color: 'rgba(245,230,211,0.5)', fontSize: 12, marginBottom: 24 }}>
        Modifica i range delle statistiche e gli step di upgrade. Dopo aver salvato, usa la bonifica per correggere le waifu esistenti.
      </p>

      {/* Range statistiche */}
      <div style={{ ...cardStat, marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', fontSize: 13, letterSpacing: 2, marginBottom: 16 }}>📊 RANGE STATISTICHE</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          {STAT_KEYS.map(({ key, label, icon }) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 10, alignItems: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', color: '#f5e6d3', fontSize: 11 }}>{icon} {label}</div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: '#a855f7', marginBottom: 3, fontFamily: 'Cinzel, serif' }}>MIN</label>
                <input type="number" value={ranges[key]?.min ?? ''} style={{ ...inputStyle, padding: '6px 8px' }}
                  onChange={e => setRanges(r => ({ ...r, [key]: { ...r[key], min: +e.target.value } }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: '#a855f7', marginBottom: 3, fontFamily: 'Cinzel, serif' }}>MAX</label>
                <input type="number" value={ranges[key]?.max ?? ''} style={{ ...inputStyle, padding: '6px 8px' }}
                  onChange={e => setRanges(r => ({ ...r, [key]: { ...r[key], max: +e.target.value } }))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step upgrade */}
      <div style={{ ...cardStat, marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Cinzel, serif', color: '#a855f7', fontSize: 13, letterSpacing: 2, marginBottom: 16 }}>⚡ STEP UPGRADE (valore per +/-)</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {STAT_KEYS.map(({ key, label, icon }) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 200px', gap: 10, alignItems: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', color: '#f5e6d3', fontSize: 11 }}>{icon} {label}</div>
              <input type="number" min="1" value={steps[key] ?? ''} style={{ ...inputStyle, padding: '6px 8px' }}
                onChange={e => setSteps(s => ({ ...s, [key]: +e.target.value }))} />
              <div style={{ fontSize: 10, color: 'rgba(245,230,211,0.4)', fontFamily: 'Cinzel, serif' }}>
                range: {ranges[key]?.min}–{ranges[key]?.max}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONFIGURAZIONE OUTFIT ── */}
      <div style={{ background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.2)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'Cinzel, serif', color: '#9b59ff', fontSize: 13, letterSpacing: 2, marginBottom: 6 }}>✦ CONFIGURAZIONE OUTFIT</h3>
        <p style={{ fontSize: 10, color: 'rgba(245,230,211,0.4)', marginBottom: 16, fontFamily: 'Orbitron' }}>
          Modifica le soglie di livello e archetipi degli outfit. Le modifiche si applicano al nuovo calcolo live.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Field label="Copie per salire di livello">
            <input type="number" min={1} max={100}
              value={outfitConf.copiePerLivello ?? OUTFIT_CONFIG_DEFAULT.copiePerLivello}
              onChange={e => setOutfitConf({ ...outfitConf, copiePerLivello: parseInt(e.target.value) || 15 })}
              style={inputStyle} />
          </Field>
        </div>

        {/* Tabella rarità */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ color: 'rgba(245,230,211,0.5)', fontFamily: 'Orbitron', letterSpacing: 1, fontSize: 9 }}>
                {['RARITÀ', 'MAX LIV', 'ARCHE. START (Lv.1)', 'ARCHE. MAX', 'ARCHE./LIV'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(RARITA).map(([rk, rv]) => {
                const def = OUTFIT_CONFIG_DEFAULT.rarità[rk] || {};
                const curr = outfitConf.rarità?.[rk] || def;
                const set = (patch) => setOutfitConf(prev => ({
                  ...prev,
                  rarità: { ...prev.rarità, [rk]: { ...curr, ...patch } },
                }));
                const isSpeciale = rk === 'leggendario' || rk === 'immersivo';
                return (
                  <tr key={rk} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 10px', color: rv.colore, fontFamily: 'Cinzel, serif', fontWeight: 700 }}>{rv.nome}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <input type="number" min={1} max={15} value={curr.maxLivello ?? def.maxLivello}
                        onChange={e => set({ maxLivello: parseInt(e.target.value) || def.maxLivello })}
                        style={{ ...inputStyle, width: 60, padding: '4px 6px' }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input type="number" min={1} max={20} value={curr.archetipiStart ?? def.archetipiStart}
                        onChange={e => set({ archetipiStart: parseInt(e.target.value) || def.archetipiStart })}
                        style={{ ...inputStyle, width: 60, padding: '4px 6px' }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {isSpeciale
                        ? <span style={{ color: '#ffd666', fontFamily: 'Orbitron', fontSize: 9 }}>TUTTI (Lv.10)</span>
                        : <input type="number" min={1} max={20} value={curr.archetipiMax ?? def.archetipiMax}
                            onChange={e => set({ archetipiMax: parseInt(e.target.value) || def.archetipiMax })}
                            style={{ ...inputStyle, width: 60, padding: '4px 6px' }} />
                      }
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input type="number" min={1} max={5} value={curr.archetipiPerLivello ?? def.archetipiPerLivello}
                        onChange={e => set({ archetipiPerLivello: parseInt(e.target.value) || def.archetipiPerLivello })}
                        style={{ ...inputStyle, width: 60, padding: '4px 6px' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(245,230,211,0.3)', marginTop: 10, fontFamily: 'Orbitron', lineHeight: 1.6 }}>
          ℹ Leggendario/Immersivo: logica speciale — Lv.8→9: 10→15 archetipi, Lv.9→10: 15→TUTTI
        </div>
      </div>

      {/* God Pack / Waifu Pack */}
      <div style={{ ...cardStat, marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Cinzel, serif', color: '#f59e0b', fontSize: 13, letterSpacing: 2, marginBottom: 8 }}>
          ✦ WAIFU PACK (God Pack)
        </h3>
        <p style={{ color: 'rgba(245,230,211,0.5)', fontSize: 11, marginBottom: 16, lineHeight: 1.6 }}>
          Aprendo qualsiasi pacchetto, c'è una probabilità di trovare un <strong style={{ color: '#f59e0b' }}>Waifu Pack</strong>:
          invece di 2 waifu + 2 outfit + 1 posa, il giocatore trova <strong style={{ color: '#f59e0b' }}>5 waifu</strong>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
          <label style={{ fontFamily: 'Cinzel, serif', color: '#f5e6d3', fontSize: 12 }}>
            🎴 Probabilità Waifu Pack
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min="0" max="1" step="0.001"
              value={godPackProb}
              onChange={e => setGodPackProb(Math.max(0, Math.min(1, Number(e.target.value))))}
              style={{
                width: 100, padding: '6px 10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 6, color: '#f5e6d3',
                fontFamily: 'Orbitron, monospace', fontSize: 12,
              }}
            />
            <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f59e0b' }}>
              = {(godPackProb * 100).toFixed(2)}%
            </span>
            <span style={{ fontSize: 10, color: 'rgba(245,230,211,0.4)', fontFamily: 'Cinzel, serif' }}>
              (0 = disabilitato, 0.005 = default 0.5%)
            </span>
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(245,230,211,0.3)', marginTop: 10, fontFamily: 'Orbitron', lineHeight: 1.6 }}>
          ℹ Valore tra 0 e 1. Esempio: 0.01 = 1% di probabilità ad ogni apertura.
        </div>
      </div>

      {/* Azioni */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button onClick={salvaConfig} disabled={saving} style={btnPrimario}>
          {saving ? '⏳ Salvataggio...' : '💾 SALVA CONFIGURAZIONE'}
        </button>
        <button onClick={resetDefaults} style={btnSecondario}>↺ RESET DEFAULT</button>
        <button onClick={avviaBonifica} disabled={bonifica?.inCorso} style={{
          ...btnSecondario, borderColor: 'rgba(239,68,68,0.5)', color: '#fca5a5',
        }}>
          {bonifica?.inCorso ? '⏳ Bonifica in corso...' : `🔧 BONIFICA WAIFU (${waifu.length})`}
        </button>
      </div>

      {/* Risultati bonifica */}
      {bonifica && !bonifica.inCorso && (
        <div style={{ ...cardStat }}>
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#06d6a0', fontSize: 12, letterSpacing: 2, marginBottom: 12 }}>
            ✅ RISULTATI BONIFICA ({bonifica.risultati.length} waifu modificate)
          </h3>
          {bonifica.risultati.length === 0 ? (
            <div style={{ color: 'rgba(245,230,211,0.5)', fontSize: 12, fontFamily: 'Cinzel, serif' }}>
              Nessuna waifu fuori range — catalogo già conforme! ✓
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {bonifica.risultati.map((r, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 6,
                  background: r.ok ? 'rgba(6,214,160,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${r.ok ? 'rgba(6,214,160,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  fontSize: 11, fontFamily: 'Cinzel, serif',
                }}>
                  <span style={{ color: r.ok ? '#06d6a0' : '#fca5a5', marginRight: 8 }}>{r.ok ? '✓' : '✗'}</span>
                  <span style={{ color: '#f5e6d3' }}>{r.nome}</span>
                  {r.ok && r.dettagli && (
                    <div style={{ marginLeft: 8, display: 'inline-flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {Object.entries(r.dettagli).map(([k, { prima, dopo }]) => {
                        const statLabel = STAT_KEYS.find(s => s.key === k)?.label || k;
                        return (
                          <span key={k} style={{ color: 'rgba(245,230,211,0.6)', fontSize: 10 }}>
                            <span style={{ color: '#a0a0a0' }}>{statLabel}:</span>{' '}
                            <span style={{ color: '#fca5a5', fontWeight: 700 }}>{prima}</span>
                            <span style={{ color: '#a0a0a0' }}> → </span>
                            <span style={{ color: '#06d6a0', fontWeight: 700 }}>{dopo}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {r.errore && <span style={{ color: '#fca5a5', marginLeft: 8 }}>— {r.errore}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: PREZZI — configurazione prezzi Negozio da DB
// ============================================================
function PrezziTab({ flash, user }) {
  const [prezzi, setPrezzi] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPrezziConfig().then(setPrezzi); }, []);

  const aggiorna = async (path, value) => {
    const keys = path.split('.');
    setPrezzi(p => {
      const next = JSON.parse(JSON.stringify(p));
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const salva = async () => {
    setBusy(true);
    try {
      await setPrezziConfig(prezzi);
      // Invalida la cache server-side tramite API (autenticato)
      const token = await user.getIdToken();
      await fetch('/api/admin/clear-prezzi-cache', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      flash('Prezzi salvati!');
    } catch (e) { flash('Errore: ' + e.message, '#ff4d4d'); }
    finally { setBusy(false); }
  };

  if (!prezzi) return <div style={{ padding: 20, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', fontSize: 10 }}>Caricamento prezzi…</div>;

  const inputStyle = {
    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: 6, color: '#f5e6d3', fontFamily: 'Orbitron', fontSize: 11,
    padding: '5px 8px', width: 90,
  };
  const labelStyle = { fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.5)', letterSpacing: 1, marginBottom: 3 };
  const sectionStyle = {
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 12, padding: '16px 18px', marginBottom: 14,
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#f5a623', marginBottom: 16, fontWeight: 700 }}>💰 GESTIONE PREZZI</div>

      {/* Tagli Kisses */}
      <div style={sectionStyle}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', marginBottom: 12, fontWeight: 700 }}>Pacchetti Kisses (PayPal)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(prezzi.tagli_kisses || {}).map(([id, t]) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', width: 20, textAlign: 'right' }}>{id.toUpperCase()}</span>
              <div>
                <div style={labelStyle}>Kisses</div>
                <input type="number" value={t.kisses} onChange={e => aggiorna(`tagli_kisses.${id}.kisses`, Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>€ EUR</div>
                <input type="text" value={t.price_eur} onChange={e => aggiorna(`tagli_kisses.${id}.price_eur`, e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Label</div>
                <input type="text" value={t.label || ''} onChange={e => aggiorna(`tagli_kisses.${id}.label`, e.target.value)} style={{ ...inputStyle, width: 130 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pass */}
      <div style={sectionStyle}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', marginBottom: 12, fontWeight: 700 }}>Pass (una tantum)</div>
        {[
          { id: 'pass_hard', label: '🔞 Hard Pass' },
          { id: 'pass_scambi', label: '🔓 Trade Pass' },
        ].map(({ id, label }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', width: 110 }}>{label}</span>
            <div>
              <div style={labelStyle}>Kisses</div>
              <input type="number" value={prezzi[id]?.kisses || 0} onChange={e => aggiorna(`${id}.kisses`, Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>€ EUR</div>
              <input type="text" value={prezzi[id]?.price_eur || ''} onChange={e => aggiorna(`${id}.price_eur`, e.target.value)} style={inputStyle} />
            </div>
          </div>
        ))}
      </div>

      {/* Beni Kisses */}
      <div style={sectionStyle}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', marginBottom: 12, fontWeight: 700 }}>Beni con Kisses</div>
        {[
          { id: 'pack_sfida', label: '🎁 Pack Sfida' },
          { id: 'energia', label: '⚡ Energia' },
        ].map(({ id, label }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', width: 110 }}>{label}</span>
            <div>
              <div style={labelStyle}>Kisses</div>
              <input type="number" value={prezzi.beni?.[id]?.kisses || 0} onChange={e => aggiorna(`beni.${id}.kisses`, Number(e.target.value))} style={inputStyle} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={salva} disabled={busy} style={{
        background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
        border: 'none', borderRadius: 10, color: '#000',
        fontFamily: 'Orbitron', fontSize: 11, padding: '10px 28px',
        cursor: busy ? 'wait' : 'pointer', fontWeight: 700,
      }}>
        {busy ? 'Salvataggio…' : '💾 SALVA PREZZI'}
      </button>
    </div>
  );
}
