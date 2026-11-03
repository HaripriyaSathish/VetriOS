import { useEffect, useState } from "react";

// Animated donut used by the trainee pages (overall score, course
// progress). `percent` null shows a dash with an empty ring.
function ScoreRing({ percent, size = 120, stroke = 13, caption, color = "#2689ef", track = "#eef3fc" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(percent ?? 0));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" stroke={track} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" stroke={color}
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={circumference - (shown / 100) * circumference}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="score-ring-value"
      />
      <text x="50%" y={caption ? "46%" : "50%"} textAnchor="middle" dominantBaseline="central" className="score-ring-text">
        {percent != null ? `${percent}%` : "—"}
      </text>
      {caption && (
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" className="score-ring-caption">
          {caption}
        </text>
      )}
    </svg>
  );
}

export default ScoreRing;
