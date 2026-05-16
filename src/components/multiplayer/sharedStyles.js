/**
 * Stili condivisi per i componenti della sezione Multiplayer.
 *
 * SRP: gli stili sono separati dalla logica UI.
 * DRY: definiti una volta, usati ovunque.
 */

/**
 * Genera lo stile inline per i bottoni della UI Multiplayer.
 *
 * @param {string} color - Colore principale del bottone (es. '#9b59ff').
 * @param {boolean} [secondary=false] - Se true, applica lo stile secondario (ghost).
 * @returns {Object} Oggetto stile React.
 */
export const btnStyle = (color, secondary = false) => ({
  flex: secondary ? undefined : 1,
  padding: '10px 16px',
  background: secondary
    ? 'rgba(255,255,255,0.04)'
    : `linear-gradient(${color}50, ${color}1a)`,
  border: secondary
    ? '0.8px solid rgba(167,139,250,0.2)'
    : `0.8px solid ${color}99`,
  borderRadius: 12,
  cursor: 'pointer',
  color: secondary ? 'rgba(241,235,255,0.5)' : color === 'rgb(42,31,0)' ? 'rgb(42,31,0)' : '#f1ebff',
  fontFamily: "'Saira Condensed', Saira, sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  textAlign: 'center',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  transition: 'all 0.15s',
});

/**
 * Stile per le label dei form della UI Multiplayer.
 * @type {Object}
 */
export const labelStyle = {
  display: 'block',
  fontSize: 10,
  color: 'rgba(167,139,250,0.7)',
  fontFamily: "'Saira Condensed', Saira, sans-serif",
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  marginBottom: 6,
};

/**
 * Stile per gli input testuali della UI Multiplayer.
 * @type {Object}
 */
export const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(167,139,250,0.06)',
  border: '0.8px solid rgba(167,139,250,0.25)',
  borderRadius: 10,
  color: '#f1ebff',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
