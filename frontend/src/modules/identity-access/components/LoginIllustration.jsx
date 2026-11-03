// Cartoon for the Login brand panel: a teammate waving from their desk
// while working in VetriOS. All motion (wave, blink, typing, steam,
// speech bubble) is driven by the .lc-* classes in Login.css.
function LoginIllustration() {
  return (
    <svg
      className="login-cartoon"
      viewBox="0 0 300 300"
      role="img"
      aria-label="A Vetri teammate waving hello from their desk"
    >
      <defs>
        <linearGradient id="lc-shirt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8a4c" />
          <stop offset="100%" stopColor="#e7510c" />
        </linearGradient>
        <linearGradient id="lc-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5aa6ff" />
          <stop offset="100%" stopColor="#1d4fb8" />
        </linearGradient>
      </defs>

      <ellipse cx="150" cy="276" rx="104" ry="9" fill="rgba(0, 10, 40, 0.35)" />

      {/* Speech bubble */}
      <g className="lc-bubble">
        <rect x="22" y="40" width="86" height="36" rx="14" fill="#fff" />
        <path d="M86 74 L100 88 L96 72 Z" fill="#fff" />
        <text
          x="65"
          y="63"
          textAnchor="middle"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontWeight="800"
          fontSize="14"
          fill="#002673"
        >
          Hi there!
        </text>
      </g>

      {/* Sparkles */}
      <path className="lc-spark s1" d="M246 50 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="#ffb27a" />
      <path className="lc-spark s2" d="M40 150 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#9cc7ff" />
      <path className="lc-spark s3" d="M262 168 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z" fill="#fff" />

      <g className="lc-body">
        {/* Typing arm (behind laptop) */}
        <g className="lc-type">
          <path d="M114 172 Q96 204 124 218" stroke="url(#lc-shirt)" strokeWidth="17" strokeLinecap="round" fill="none" />
          <circle cx="128" cy="219" r="9" fill="#f6c39e" />
        </g>

        {/* Torso */}
        <rect x="106" y="148" width="88" height="84" rx="32" fill="url(#lc-shirt)" />
        <path d="M138 150 L150 166 L162 150" stroke="#fff" strokeWidth="4" strokeLinejoin="round" fill="none" opacity="0.85" />

        {/* Neck + head */}
        <rect x="141" y="130" width="18" height="24" rx="6" fill="#eab48d" />
        <circle cx="116" cy="110" r="7" fill="#f6c39e" />
        <circle cx="184" cy="110" r="7" fill="#f6c39e" />
        <circle cx="150" cy="106" r="35" fill="#f6c39e" />
        <path
          d="M114 104 C112 74 136 60 156 64 C180 66 192 86 186 106 C178 92 164 84 148 86 C134 88 122 94 114 104 Z"
          fill="#1b1f3b"
        />
        <g className="lc-eyes">
          <ellipse cx="137" cy="110" rx="3.6" ry="4.6" fill="#1b1f3b" />
          <ellipse cx="163" cy="110" rx="3.6" ry="4.6" fill="#1b1f3b" />
        </g>
        <circle cx="128" cy="123" r="5.5" fill="#ff9f8a" opacity="0.55" />
        <circle cx="172" cy="123" r="5.5" fill="#ff9f8a" opacity="0.55" />
        <path d="M139 124 Q150 135 161 124" stroke="#1b1f3b" strokeWidth="3.2" strokeLinecap="round" fill="none" />

        {/* Waving arm */}
        <g className="lc-wave">
          <path d="M186 168 Q212 150 222 122" stroke="url(#lc-shirt)" strokeWidth="17" strokeLinecap="round" fill="none" />
          <circle cx="224" cy="112" r="11" fill="#f6c39e" />
          <path d="M218 104 v-8 M224 102 v-10 M230 104 v-8" stroke="#f6c39e" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>

      {/* Desk */}
      <rect x="34" y="226" width="232" height="14" rx="7" fill="url(#lc-desk)" />
      <rect x="60" y="240" width="10" height="30" rx="4" fill="#1d4fb8" />
      <rect x="230" y="240" width="10" height="30" rx="4" fill="#1d4fb8" />

      {/* Laptop (back of the lid faces us) */}
      <rect x="112" y="174" width="76" height="52" rx="7" fill="#eef3fc" stroke="#c9d6ef" strokeWidth="2" />
      <circle cx="150" cy="200" r="13" fill="#e7510c" />
      <text
        x="150"
        y="205.5"
        textAnchor="middle"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="800"
        fontSize="15"
        fill="#fff"
      >
        V
      </text>
      <rect x="98" y="223" width="104" height="6" rx="3" fill="#c9d6ef" />

      {/* Coffee mug with steam */}
      <path className="lc-steam st1" d="M214 192 q-5 -7 0 -14 q5 -7 0 -14" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path className="lc-steam st2" d="M224 192 q-5 -7 0 -14 q5 -7 0 -14" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      <rect x="206" y="200" width="26" height="26" rx="6" fill="#fff" />
      <path d="M232 206 h5 a6 6 0 0 1 0 12 h-5" stroke="#fff" strokeWidth="4" fill="none" />
      <rect x="206" y="208" width="26" height="5" fill="#e7510c" />

      {/* Little plant */}
      <rect x="56" y="206" width="22" height="20" rx="5" fill="#fff1ea" />
      <g className="lc-plant">
        <path d="M67 206 C60 192 52 190 48 192 C52 200 60 204 67 206 Z" fill="#2ee6c4" />
        <path d="M67 206 C72 190 80 186 86 188 C82 198 74 204 67 206 Z" fill="#0fb9cc" />
        <path d="M67 206 C66 192 68 182 70 178" stroke="#0fb9cc" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default LoginIllustration;
