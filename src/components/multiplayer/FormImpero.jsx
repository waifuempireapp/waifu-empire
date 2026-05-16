/**
 * FormImpero — form riutilizzabile per configurare nome e colore dell'impero.
 *
 * SRP: gestisce esclusivamente la raccolta dei dati di identità dell'impero.
 * DRY: usato sia in CreaPartita che in UniscitiPartita.
 */
'use client';
import { labelStyle, inputStyle } from './sharedStyles';

// Palette colori selezionabili (identica a quella del file principale)
const PALETTE_COLORI = [
  '#f5a623', '#00e676', '#ff2d78', '#9b59ff', '#00bcd4',
  '#ff6b35', '#c0ca33', '#26c6da', '#ab47bc', '#ef5350',
  '#42a5f5', '#66bb6a', '#ffa726', '#ec407a', '#7e57c2',
];

/**
 * Form per la scelta del nome e del colore dell'impero.
 *
 * @param {Object}   props
 * @param {string}   props.nomeImpero        - Valore corrente del nome.
 * @param {Function} props.setNomeImpero     - Setter per il nome.
 * @param {string}   props.coloreImpero      - Colore hex selezionato.
 * @param {Function} props.setColoreImpero   - Setter per il colore.
 * @param {string[]} [props.coloriBloccati]  - Colori già in uso in lobby (disabilitati).
 */
export default function FormImpero({ nomeImpero, setNomeImpero, coloreImpero, setColoreImpero, coloriBloccati = [] }) {
  return (
    <div>
      <label style={labelStyle}>NOME IMPERO</label>
      <input
        value={nomeImpero}
        onChange={e => setNomeImpero(e.target.value)}
        placeholder="Es: Drago Dorato"
        maxLength={30}
        style={inputStyle}
      />
      <label style={{ ...labelStyle, marginTop: 14 }}>COLORE IMPERO</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {PALETTE_COLORI.map(c => {
          const bloccato = coloriBloccati.includes(c);
          return (
            <button
              key={c}
              disabled={bloccato}
              onClick={() => !bloccato && setColoreImpero(c)}
              title={bloccato ? 'Già in uso' : c}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: c,
                border: coloreImpero === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.1)',
                cursor: bloccato ? 'not-allowed' : 'pointer',
                opacity: bloccato ? 0.25 : 1,
                boxShadow: coloreImpero === c ? `0 0 12px ${c}` : 'none',
                transition: 'all 0.15s',
              }}
            />
          );
        })}
      </div>
      {/* Preview nome + colore in tempo reale */}
      <div style={{ marginTop: 14, padding: '8px 14px', borderRadius: 8, background: `${coloreImpero}15`, border: `1px solid ${coloreImpero}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: coloreImpero }} />
        <span style={{ fontFamily: 'Orbitron', fontSize: 12, color: coloreImpero }}>{nomeImpero || 'Il tuo Impero'}</span>
      </div>
    </div>
  );
}
