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
      <path
        d="M16 27 C16 27 3 17.5 3 10 C3 6 6.5 3 10.5 3 C12.8 3 14.8 4.2 16 6 C17.2 4.2 19.2 3 21.5 3 C25.5 3 29 6 29 10 C29 17.5 16 27 16 27Z"
        fill="#ff4d9e"
        stroke="#ff1a7a"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <ellipse cx="11.5" cy="9" rx="2.8" ry="1.8" fill="white" opacity="0.28" transform="rotate(-20 11.5 9)" />
    </svg>
  );
}
