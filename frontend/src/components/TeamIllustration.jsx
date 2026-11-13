// Three students around a laptop — the Business Team sidebar image from
// the Figma, drawn in the same flat style as the other VetriOS cartoons.
// Motion (bob, blink, wave, glow) comes from the .ti-* classes in Sidebar.css.
function Student({ x, skin, hair, shirt, hairPath, glasses = false, delay = 0 }) {
  return (
    // Position lives on the outer <g>: the .ti-person bob animation sets a
    // CSS transform, which would otherwise override this translate and
    // stack every student at the left edge.
    <g transform={`translate(${x} 0)`}>
    <g className="ti-person" style={{ animationDelay: `${delay}s` }}>
      <path d="M-30 150 C-30 118 -16 104 0 104 C16 104 30 118 30 150 Z" fill={shirt} />
      <rect x="-6" y="88" width="12" height="18" rx="5" fill={skin} />
      <circle cx="0" cy="72" r="23" fill={skin} />
      <path d={hairPath} fill={hair} />
      <g className="ti-eyes" style={{ animationDelay: `${delay * 2}s` }}>
        <ellipse cx="-8" cy="74" rx="2.6" ry="3.3" fill="#1b1f3b" />
        <ellipse cx="8" cy="74" rx="2.6" ry="3.3" fill="#1b1f3b" />
      </g>
      {glasses && (
        <g stroke="#1b1f3b" strokeWidth="1.8" fill="none">
          <circle cx="-8" cy="74" r="6" />
          <circle cx="8" cy="74" r="6" />
          <path d="M-2 74 h4" />
        </g>
      )}
      <path d="M-7 84 Q0 90 7 84" stroke="#1b1f3b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="-14" cy="81" r="3.5" fill="#ff9f8a" opacity="0.5" />
      <circle cx="14" cy="81" r="3.5" fill="#ff9f8a" opacity="0.5" />
    </g>
    </g>
  );
}

function TeamIllustration() {
  return (
    <svg className="team-cartoon" viewBox="0 0 240 170" role="img" aria-label="Three students learning together">
      <ellipse cx="120" cy="164" rx="100" ry="6" fill="rgba(0, 10, 40, 0.35)" />

      {/* Sparkles */}
      <path className="ti-spark" d="M206 30 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z" fill="#ffb27a" />
      <path className="ti-spark s2" d="M24 40 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" fill="#9cc7ff" />

      <Student
        x={52} skin="#e8b48f" hair="#2a1d18" shirt="#e7510c" delay={0}
        hairPath="M-23 68 C-24 46 -8 40 4 42 C18 43 26 54 22 66 C14 56 4 52 -6 54 C-14 56 -20 60 -23 68 Z"
      />
      <Student
        x={188} skin="#d9a27c" hair="#1b1f3b" shirt="#0a3591" glasses delay={0.5}
        hairPath="M-22 66 C-22 46 -6 42 6 44 C20 46 24 58 22 64 C12 54 0 52 -10 56 C-16 58 -20 62 -22 66 Z"
      />

      {/* Middle student holding the laptop, slightly in front */}
      <g className="ti-person ti-middle">
        <path d="M90 154 C90 116 104 100 120 100 C136 100 150 116 150 154 Z" fill="#f5a524" />
        <path d="M94 74 C92 48 106 36 122 38 C140 40 150 56 146 80 L148 118 C140 112 136 98 136 86 L104 86 C104 100 100 112 92 118 Z" fill="#3b1f14" />
        <rect x="114" y="84" width="12" height="18" rx="5" fill="#f2c09d" />
        <circle cx="120" cy="68" r="23" fill="#f2c09d" />
        <path d="M97 64 C98 46 112 40 124 42 C138 44 144 54 143 64 C132 54 112 52 97 64 Z" fill="#3b1f14" />
        <g className="ti-eyes" style={{ animationDelay: "1.2s" }}>
          <ellipse cx="112" cy="70" rx="2.6" ry="3.3" fill="#1b1f3b" />
          <ellipse cx="128" cy="70" rx="2.6" ry="3.3" fill="#1b1f3b" />
        </g>
        <path d="M113 80 Q120 86 127 80" stroke="#1b1f3b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="106" cy="77" r="3.5" fill="#ff9f8a" opacity="0.5" />
        <circle cx="134" cy="77" r="3.5" fill="#ff9f8a" opacity="0.5" />

        {/* Laptop */}
        <rect x="92" y="118" width="56" height="34" rx="5" fill="#dfe8fa" stroke="#b9c9e8" strokeWidth="2" />
        <rect className="ti-screen" x="97" y="122" width="46" height="25" rx="3" fill="#2689ef" />
        <path d="M103 140 l8 -8 l7 5 l12 -11" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="84" y="150" width="72" height="6" rx="3" fill="#b9c9e8" />
      </g>

      {/* Waving hand on the left student */}
      <g className="ti-wave">
        <path d="M76 120 Q86 100 84 86" stroke="#e7510c" strokeWidth="11" strokeLinecap="round" fill="none" />
        <circle cx="84" cy="80" r="8" fill="#e8b48f" />
      </g>
    </svg>
  );
}

export default TeamIllustration;
