/** The Wes mark: waveform resolving into a rising tick. Inherits currentColor. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-label="Wes logo">
      <g stroke="currentColor" strokeWidth={44} strokeLinecap="round" fill="none">
        <line x1={96} y1={216} x2={96} y2={296} />
        <line x1={176} y1={166} x2={176} y2={346} />
        <line x1={256} y1={196} x2={256} y2={316} />
      </g>
      <path
        d="M310 308 L348 350 L416 176"
        stroke="currentColor"
        strokeWidth={44}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
