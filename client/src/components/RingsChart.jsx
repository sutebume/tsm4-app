export default function RingsChart({ weekPcts, avg }) {
  const size = 280;
  const cx = 140, cy = 140;

  // Outermost = Wk4, innermost = Wk1
  const rings = [
    { rOuter: 134, rInner: 108, wkIdx: 3, opacity: 0.85 },
    { rOuter: 102, rInner:  78, wkIdx: 2, opacity: 0.75 },
    { rOuter:  72, rInner:  50, wkIdx: 1, opacity: 0.65 },
    { rOuter:  44, rInner:  26, wkIdx: 0, opacity: 0.55 },
  ];

  function polarToXY(r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: +(cx + r * Math.cos(rad)).toFixed(4),
      y: +(cy + r * Math.sin(rad)).toFixed(4),
    };
  }

  function annulusPath(rOuter, rInner) {
    const o1 = polarToXY(rOuter, 0.01);
    const o2 = polarToXY(rOuter, 180);
    const i1 = polarToXY(rInner, 0.01);
    const i2 = polarToXY(rInner, 180);
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${o2.x} ${o2.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${o1.x} ${o1.y}`,
      `Z`,
      `M ${i1.x} ${i1.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i2.x} ${i2.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i1.x} ${i1.y}`,
      `Z`,
    ].join(' ');
  }

  function sectorPath(rOuter, rInner, pct) {
    if (pct <= 0) return null;
    // Cap visual fill at 100% but allow label to show >100%
    const visualPct = Math.min(pct, 100);
    if (visualPct >= 100) return annulusPath(rOuter, rInner);
    const angle = (visualPct / 100) * 360;
    const large = angle > 180 ? 1 : 0;
    const outerStart = polarToXY(rOuter, 0);
    const outerEnd   = polarToXY(rOuter, angle);
    const innerStart = polarToXY(rInner, 0);
    const innerEnd   = polarToXY(rInner, angle);
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
      `Z`,
    ].join(' ');
  }

  const centerFill = avg > 0
    ? `rgba(200,16,46,${Math.max(0.4, Math.min(0.9, avg / 100))})`
    : 'white';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', overflow: 'hidden' }}
    >
      {rings.map(({ rOuter, rInner, wkIdx, opacity }, i) => {
        const pct = weekPcts[wkIdx] || 0;
        const rMid = (rOuter + rInner) / 2;
        const hasData = pct > 0;

        // Label: show percentage if has data, otherwise show week number
        const label = hasData ? `${pct}%` : `Wk${wkIdx + 1}`;
        // Shrink font for large numbers (e.g. 100%)
        const fontSize = label.length > 4 ? 7 : 8.5;

        return (
          <g key={i}>
            {/* Grey background annulus */}
            <path
              d={annulusPath(rOuter, rInner)}
              fill="#f0f0f0"
              stroke="#c8c8c8"
              strokeWidth={1}
              fillRule="evenodd"
            />
            {/* Red filled sector */}
            {pct > 0 && (
              <path
                d={sectorPath(rOuter, rInner, pct)}
                fill={`rgba(200,16,46,${opacity})`}
                fillRule="evenodd"
              />
            )}
            {/* Label: % when has data, week number when empty */}
            <text
              x={cx}
              y={cy - rMid}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fontWeight={700}
              fill={hasData ? 'white' : '#888'}
              fontFamily="DM Sans, sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Center circle — running average */}
      <circle cx={cx} cy={cy} r={22} fill={centerFill} stroke="#e0e0e0" strokeWidth={1} />
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={avg >= 100 ? 13 : 16}
        fontWeight={700}
        fill={avg > 0 ? 'white' : '#c8102e'}
        fontFamily="DM Sans, sans-serif"
      >
        {avg}%
      </text>
    </svg>
  );
}
