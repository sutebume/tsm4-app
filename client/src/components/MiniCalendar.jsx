import { formatDateKey, isWeekend } from '../utils/billing';

export default function MiniCalendar({ month, entries, workdayHours, engineerId, engineerName, cycleWeeks, onDayClick }) {
  const today = new Date();
  const year = month.getFullYear();
  const mon = month.getMonth();

  const monthName = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();

  // Build set of date keys that belong to this billing cycle
  const cycleDayKeys = new Set(
    (cycleWeeks || []).flat().map(d => formatDateKey(d))
  );

  const getDayStatus = (day) => {
    const d = new Date(year, mon, day);
    const key = formatDateKey(d);

    // Days outside the cycle are not clickable
    if (cycleWeeks && !cycleDayKeys.has(key)) return 'out-of-cycle';

    const dayEntries = entries[key] || [];
    const available = workdayHours[key] ?? (isWeekend(d) ? 0 : 8);

    if (dayEntries.length === 0) return isWeekend(d) ? 'weekend-empty' : 'empty';

    const logged = dayEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    if (available > 0) {
      const pct = logged / available;
      if (pct >= 0.8) return 'full';
      if (pct > 0) return 'partial';
    }
    // Has entries but no available hours set (weekend with 0h) — show as logged
    return 'logged';
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'var(--red)', padding: '6px 8px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{monthName}</span>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--gray-100)', padding: '4px 0' }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 9, fontWeight: 700,
            // S and S columns subtly different
            color: i === 0 || i === 6 ? '#b0b0b0' : 'var(--gray-500)',
          }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 2px', gap: 1 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const d = new Date(year, mon, day);
          const key = formatDateKey(d);
          const status = getDayStatus(day);
          const isToday = key === formatDateKey(today);
          const weekend = isWeekend(d);
          const outOfCycle = status === 'out-of-cycle';
          const clickable = !outOfCycle && !!engineerId;

          let bg = weekend && !isToday ? 'rgba(0,0,0,0.02)' : 'transparent';
          let textColor = weekend ? '#b0b0b0' : 'var(--gray-700)';
          let opacity = outOfCycle ? 0.35 : 1;

          if (isToday) {
            bg = 'var(--red)';
            textColor = 'white';
          } else if (status === 'full') {
            bg = 'rgba(200,16,46,0.15)';
            textColor = 'var(--gray-700)';
          } else if (status === 'partial') {
            bg = 'rgba(200,16,46,0.07)';
            textColor = 'var(--gray-700)';
          }

          const hasData = ['full', 'partial', 'logged'].includes(status);

          return (
            <div
              key={day}
              onClick={() => clickable && onDayClick(engineerId, key, d, engineerName)}
              title={weekend && !outOfCycle ? 'Weekend — click to add entries' : undefined}
              style={{
                textAlign: 'center', fontSize: 10, padding: '3px 0',
                borderRadius: '50%',
                cursor: clickable ? 'pointer' : 'default',
                background: bg,
                color: textColor,
                opacity,
                fontWeight: isToday ? 700 : 400,
                position: 'relative',
              }}
            >
              {day}
              {hasData && !isToday && (
                <div style={{
                  width: 3, height: 3, borderRadius: '50%',
                  background: weekend ? '#aaa' : 'var(--red)',
                  margin: '0 auto', marginTop: 1,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
