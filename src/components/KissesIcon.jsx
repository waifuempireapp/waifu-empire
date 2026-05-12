export default function KissesIcon({ size = 16, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cuore rosa con la punta a forma di posteriore (due lobi in basso) */}
      <path
        d="M16 28 C16 28 3 18 3 10 C3 6 6 3 10 3 C12.5 3 14.5 4.5 16 6.5 C17.5 4.5 19.5 3 22 3 C26 3 29 6 29 10 C29 18 16 28 16 28Z"
        fill="#ff4d9e"
        stroke="#ff1a7a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Solco centrale (separa i due lobi inferiori per l'effetto posteriore) */}
      <path
        d="M16 22 C16 22 16 27 16 28"
        stroke="#ff1a7a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Perizoma — triangolo in basso */}
      <path
        d="M11.5 23 L16 26.5 L20.5 23 L16 21 Z"
        fill="white"
        opacity="0.85"
        stroke="rgba(255,26,122,0.5)"
        strokeWidth="0.5"
      />
      {/* Laccetti perizoma */}
      <path d="M11.5 23 Q9 20 10 17" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" fill="none" />
      <path d="M20.5 23 Q23 20 22 17" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" fill="none" />
      {/* Lucido */}
      <ellipse cx="12" cy="9" rx="3" ry="2" fill="white" opacity="0.25" transform="rotate(-20 12 9)" />
    </svg>
  );
}
