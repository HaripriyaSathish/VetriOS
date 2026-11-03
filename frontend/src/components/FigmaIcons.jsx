import { useId } from "react";

// Colourful, glossy icons drawn after the 3D icons in the VETRI OS Figma
// design (Vetri IT navy / blue / orange). Used wherever an exported Figma
// image isn't available — see src/assets/figma/README.md.

const NAVY = ["#2689ef", "#0a3591"];
const ORANGE = ["#ffb27a", "#e7510c"];

function Grad({ id, colors, x2 = 0, y2 = 1 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
      <stop offset="0%" stopColor={colors[0]} />
      <stop offset="100%" stopColor={colors[1]} />
    </linearGradient>
  );
}

function Icon({ children, size = 26, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`figma-icon ${className}`} aria-hidden="true">
      {children}
    </svg>
  );
}

export function ShieldIcon(props) {
  const id = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /></defs>
      <path d="M16 3 L27 7 V15 C27 22 22 27 16 29 C10 27 5 22 5 15 V7 Z" fill={`url(#${id})`} />
      <path d="M16 3 L27 7 V11 C21 9 12 13 5 11 V7 Z" fill="#fff" opacity="0.18" />
      <path d="M11 16 L14.5 19.5 L21.5 12.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Icon>
  );
}

export function GraduateIcon(props) {
  const id = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={ORANGE} /></defs>
      <path d="M7 30 C7 23 11 20 16 20 C21 20 25 23 25 30 Z" fill={`url(#${id})`} />
      <circle cx="16" cy="14" r="6" fill="#f6c39e" />
      <path d="M4 8 L16 3 L28 8 L16 13 Z" fill="#1b1f3b" />
      <path d="M10 10.5 V13 C13 15 19 15 22 13 V10.5 L16 13 Z" fill="#2b2f55" />
      <path d="M26 8.5 V14" stroke="#ff8a4c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="26" cy="15" r="1.6" fill="#ff8a4c" />
    </Icon>
  );
}

export function CalendarIcon(props) {
  const id = useId();
  const hid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={hid} colors={ORANGE} /></defs>
      <rect x="4" y="6" width="24" height="23" rx="5" fill={`url(#${id})`} />
      <path d="M4 11 C4 8 6 6 9 6 H23 C26 6 28 8 28 11 V12 H4 Z" fill={`url(#${hid})`} />
      <rect x="9" y="3" width="3" height="6" rx="1.5" fill="#e3e9f4" />
      <rect x="20" y="3" width="3" height="6" rx="1.5" fill="#e3e9f4" />
      {[9, 14.5, 20].map((x) => [16, 21].map((y) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3" rx="1" fill="#fff" opacity={x === 14.5 && y === 21 ? 1 : 0.75} />
      )))}
    </Icon>
  );
}

export function ChatIcon(props) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <path d="M20 13 H27 C28.7 13 30 14.3 30 16 V22 C30 23.7 28.7 25 27 25 H26 V28 L22.5 25 H20 C18.3 25 17 23.7 17 22 V16 C17 14.3 18.3 13 20 13 Z" fill={`url(#${oid})`} />
      <path d="M6 4 H20 C22.2 4 24 5.8 24 8 V16 C24 18.2 22.2 20 20 20 H11 L6 24 V20 C3.8 20 2 18.2 2 16 V8 C2 5.8 3.8 4 6 4 Z" fill={`url(#${id})`} />
      <path d="M6 4 H20 C22 4 24 5.6 24 8 C17 7 9 9 2 8 C2 5.8 3.8 4 6 4 Z" fill="#fff" opacity="0.18" />
      <circle cx="8" cy="12" r="1.7" fill="#fff" />
      <circle cx="13" cy="12" r="1.7" fill="#fff" />
      <circle cx="18" cy="12" r="1.7" fill="#fff" />
    </Icon>
  );
}

export function ClipboardIcon({ clock = false, ...props }) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <rect x="5" y="5" width="20" height="25" rx="4" fill={`url(#${id})`} />
      <rect x="8" y="9" width="14" height="18" rx="2" fill="#fff" />
      <rect x="10" y="3" width="10" height="5" rx="2" fill={`url(#${oid})`} />
      <path d="M10.5 13.5 l1.5 1.5 l2.5 -2.5 M10.5 19 l1.5 1.5 l2.5 -2.5" stroke="#e7510c" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="16" y="13" width="4.5" height="1.6" rx="0.8" fill="#9fb4d9" />
      <rect x="16" y="18.5" width="4.5" height="1.6" rx="0.8" fill="#9fb4d9" />
      <rect x="10.5" y="23.5" width="10" height="1.6" rx="0.8" fill="#9fb4d9" />
      {clock && (
        <g>
          <circle cx="25" cy="24" r="6" fill={`url(#${oid})`} stroke="#fff" strokeWidth="1.5" />
          <path d="M25 21 V24 L27 25.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      )}
    </Icon>
  );
}

export function ProgressIcon(props) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <rect x="4" y="18" width="6" height="10" rx="2" fill={`url(#${id})`} />
      <rect x="13" y="13" width="6" height="15" rx="2" fill={`url(#${id})`} />
      <rect x="22" y="8" width="6" height="20" rx="2" fill={`url(#${oid})`} />
      <path d="M4 14 L12 8 L17 11 L26 3" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
      <path d="M4 14 L12 8 L17 11 L26 3" stroke="#e7510c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M21.5 3 H26 V7.5" stroke="#e7510c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Icon>
  );
}

export function NotebookIcon(props) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <rect x="5" y="3" width="19" height="26" rx="4" fill={`url(#${id})`} />
      <rect x="9" y="7" width="12" height="18" rx="1.5" fill="#fff" />
      {[3, 8, 13, 18, 23].map((y) => <rect key={y} x="3" y={y + 1} width="4" height="2" rx="1" fill="#e3e9f4" />)}
      <rect x="11" y="10" width="8" height="1.6" rx="0.8" fill="#9fb4d9" />
      <rect x="11" y="14" width="6" height="1.6" rx="0.8" fill="#9fb4d9" />
      <path d="M20 26 L28 13 L31 15 L23 28 L19.5 29 Z" fill={`url(#${oid})`} />
      <path d="M19.5 29 L20 26 L23 28 Z" fill="#1b1f3b" />
    </Icon>
  );
}

export function VideoIcon(props) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <rect x="2" y="6" width="28" height="20" rx="5" fill={`url(#${id})`} />
      <path d="M2 11 C2 8 4 6 7 6 H25 C28 6 30 8 30 11 C22 9 10 10 2 11 Z" fill="#fff" opacity="0.18" />
      <circle cx="16" cy="16" r="6.5" fill={`url(#${oid})`} />
      <path d="M14 13 L19.5 16 L14 19 Z" fill="#fff" />
      <rect x="6" y="28" width="20" height="2" rx="1" fill="#9fb4d9" />
    </Icon>
  );
}

export function ReportIcon(props) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <path d="M7 2 H19 L26 9 V27 C26 28.7 24.7 30 23 30 H7 C5.3 30 4 28.7 4 27 V5 C4 3.3 5.3 2 7 2 Z" fill="#fff" stroke="#c9d6ef" strokeWidth="1.2" />
      <path d="M19 2 V7 C19 8.1 19.9 9 21 9 H26 Z" fill="#c9d6ef" />
      <rect x="8" y="19" width="3.5" height="7" rx="1" fill={`url(#${id})`} />
      <rect x="13.5" y="15" width="3.5" height="11" rx="1" fill={`url(#${oid})`} />
      <rect x="19" y="12" width="3.5" height="14" rx="1" fill={`url(#${id})`} />
      <rect x="8" y="7" width="8" height="1.8" rx="0.9" fill="#9fb4d9" />
    </Icon>
  );
}

export function AlarmIcon(props) {
  const id = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={ORANGE} /></defs>
      <path d="M4 9 C4 5 7 3 10 4 Z M28 9 C28 5 25 3 22 4 Z" fill="#0a3591" />
      <path d="M8 29 L10 26 M24 29 L22 26" stroke="#0a3591" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="17" r="11" fill={`url(#${id})`} />
      <circle cx="16" cy="17" r="8" fill="#fff" />
      <path d="M16 12 V17 L19.5 19" stroke="#0a3591" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="12.5" cy="10.5" r="2" fill="#fff" opacity="0.45" />
    </Icon>
  );
}

export function EnvelopeIcon(props) {
  const id = useId();
  const oid = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={NAVY} /><Grad id={oid} colors={ORANGE} /></defs>
      <rect x="2" y="8" width="26" height="19" rx="4" fill={`url(#${id})`} />
      <path d="M3 10 L15 19 L27 10" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <path d="M2 12 C10 10 20 10 28 12 V11 C28 9.3 26.7 8 25 8 H5 C3.3 8 2 9.3 2 11 Z" fill="#fff" opacity="0.15" />
      <circle cx="26" cy="8" r="5" fill={`url(#${oid})`} stroke="#fff" strokeWidth="1.5" />
    </Icon>
  );
}

export function WarningIcon(props) {
  const id = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={["#ff8a6b", "#e0351c"]} /></defs>
      <path d="M16 3 C17.2 3 18 3.6 18.6 4.7 L29.4 24.6 C30.6 26.8 29.2 29 26.8 29 H5.2 C2.8 29 1.4 26.8 2.6 24.6 L13.4 4.7 C14 3.6 14.8 3 16 3 Z" fill={`url(#${id})`} />
      <path d="M16 3 C17.2 3 18 3.6 18.6 4.7 L21 9 C17 10 12 11 8 14 L13.4 4.7 C14 3.6 14.8 3 16 3 Z" fill="#fff" opacity="0.2" />
      <rect x="14.4" y="10" width="3.2" height="10" rx="1.6" fill="#fff" />
      <circle cx="16" cy="24" r="1.9" fill="#fff" />
    </Icon>
  );
}

// Calendar-with-ticks illustration ("Show up · Learn · Grow") from the
// Figma attendance chart panel.
export function CalendarIllustration({ className = "" }) {
  const id = useId();
  return (
    <svg className={`calendar-illustration ${className}`} viewBox="0 0 220 190" role="img" aria-label="Show up, learn, grow">
      <defs>
        <Grad id={`${id}n`} colors={["#2689ef", "#0a3591"]} />
        <Grad id={`${id}o`} colors={["#ffb27a", "#e7510c"]} />
      </defs>
      <circle className="ci-blob" cx="60" cy="96" r="44" fill="#cfe0fb" />
      <g className="ci-leaves">
        <path d="M168 120 C178 84 196 70 210 66 C206 92 192 112 168 120 Z" fill={`url(#${id}o)`} />
        <path d="M172 128 C190 108 206 104 216 106 C206 124 190 132 172 128 Z" fill="#ffb27a" />
      </g>
      <g className="ci-calendar">
        <rect x="56" y="34" width="112" height="98" rx="14" fill="#fff" stroke="#dbe5f7" strokeWidth="2" />
        <path d="M56 50 C56 41 63 34 72 34 H152 C161 34 168 41 168 50 V58 H56 Z" fill={`url(#${id}n)`} />
        <rect x="80" y="24" width="8" height="20" rx="4" fill="#0a3591" />
        <rect x="136" y="24" width="8" height="20" rx="4" fill="#0a3591" />
        {[0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => {
          const x = 70 + col * 24;
          const y = 68 + row * 20;
          const ticked = (row * 4 + col) % 3 !== 2;
          return ticked ? (
            <path key={`${row}-${col}`} className="ci-tick" style={{ animationDelay: `${(row * 4 + col) * 0.12}s` }}
              d={`M${x} ${y + 6} l4 4 l8 -9`} stroke="#e7510c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <rect key={`${row}-${col}`} x={x} y={y} width="12" height="10" rx="2" fill="#e3e9f4" />
          );
        }))}
      </g>
      <g className="ci-clock">
        <circle cx="160" cy="124" r="20" fill={`url(#${id}o)`} stroke="#fff" strokeWidth="3" />
        <circle cx="160" cy="124" r="14" fill="#fff" />
        <path className="ci-hand" d="M160 124 V114" stroke="#0a3591" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M160 124 L167 128" stroke="#0a3591" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <text x="110" y="166" textAnchor="middle" className="ci-text" transform="rotate(-6 110 166)">Show up</text>
      <text x="118" y="184" textAnchor="middle" className="ci-text ci-text-2" transform="rotate(-6 118 184)">Learn Grow</text>
    </svg>
  );
}

export function SparkleIcon(props) {
  const id = useId();
  return (
    <Icon {...props}>
      <defs><Grad id={id} colors={ORANGE} /></defs>
      <path d="M13 4 L15.5 12.5 L24 15 L15.5 17.5 L13 26 L10.5 17.5 L2 15 L10.5 12.5 Z" fill={`url(#${id})`} />
      <path d="M25 3 L26.2 6.8 L30 8 L26.2 9.2 L25 13 L23.8 9.2 L20 8 L23.8 6.8 Z" fill="#ffb27a" />
    </Icon>
  );
}

// Floating extras around the dashboard banner cartoon, as in the Figma:
// a chart card, a glowing bulb and a paper plane with a dotted trail.
export function HeroExtras() {
  const id = useId();
  return (
    <>
      <svg className="sd-extra sd-extra-chart" viewBox="0 0 48 44" aria-hidden="true">
        <defs><Grad id={`${id}c`} colors={NAVY} /></defs>
        <rect x="1" y="1" width="46" height="42" rx="9" fill="#fff" />
        <rect x="9" y="26" width="6" height="10" rx="1.5" fill={`url(#${id}c)`} />
        <rect x="19" y="20" width="6" height="16" rx="1.5" fill={`url(#${id}c)`} />
        <rect x="29" y="14" width="6" height="22" rx="1.5" fill="#e7510c" />
        <path d="M8 20 L18 12 L25 15 L38 7" stroke="#e7510c" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33 7 H38 V12" stroke="#e7510c" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="sd-extra sd-extra-bulb" viewBox="0 0 40 48" aria-hidden="true">
        <g className="sd-bulb-rays" stroke="#ffd36b" strokeWidth="2.4" strokeLinecap="round">
          <path d="M20 2 V6 M6 8 L9 11 M34 8 L31 11 M2 21 H6 M34 21 H38" />
        </g>
        <circle cx="20" cy="22" r="11" fill="#ffc83d" />
        <circle cx="16.5" cy="18.5" r="3.5" fill="#fff" opacity="0.6" />
        <rect x="15" y="31" width="10" height="5" rx="1.5" fill="#9fb4d9" />
        <rect x="16" y="36" width="8" height="4" rx="1.5" fill="#7b88a6" />
      </svg>
      <svg className="sd-extra sd-extra-plane" viewBox="0 0 64 56" aria-hidden="true">
        <path className="sd-plane-trail" d="M6 52 C14 36 30 46 30 32 C30 24 22 24 26 18" stroke="#fff" strokeWidth="2" strokeDasharray="3 4" fill="none" strokeLinecap="round" opacity="0.7" />
        <g className="sd-plane">
          <path d="M28 18 L62 2 L44 34 L38 24 Z" fill="#ff8a4c" />
          <path d="M38 24 L62 2 L42 28 Z" fill="#e7510c" />
          <path d="M38 24 L40 32 L44 28 Z" fill="#c9450a" />
        </g>
      </svg>
    </>
  );
}
