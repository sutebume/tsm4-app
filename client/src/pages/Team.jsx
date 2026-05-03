import { useState } from 'react';
import {
  getCycleStartMonth, getBillingCycleDatesFromMonth, getCycleLabel,
  offsetCycle, getWorkdays, formatDateKey, calcWeekBillability, isWeekend
} from '../utils/billing';
import RingsChart from '../components/RingsChart';

export default function Team({ engineers, allEntries, workdayHours }) {
  const today = new Date();
  const currentCycleMonth = getCycleStartMonth(today);
  const [cycleMonth, setCycleMonth] = useState(currentCycleMonth);

  const isCurrentCycle =
    cycleMonth.getFullYear() === currentCycleMonth.getFullYear() &&
    cycleMonth.getMonth() === currentCycleMonth.getMonth();

  const weeks = getBillingCycleDatesFromMonth(cycleMonth);
  const allDays = weeks.flat();

  const engineerStats = engineers.map(e => {
    const entries = allEntries[e.id] || {};
    const weekPcts = weeks.map(days => calcWeekBillability(entries, workdayHours, days));
    const totalAvailable = allDays.reduce((s, d) => {
      const defaultH = isWeekend(d) ? 0 : 8;
      return s + (workdayHours[formatDateKey(d)] ?? defaultH);
    }, 0);
    const totalLogged = allDays.reduce((s, d) => {
      const dayEntries = entries[formatDateKey(d)] || [];
      return s + dayEntries.reduce((r, en) => r + (parseFloat(en.hours) || 0), 0);
    }, 0);
    const avg = totalAvailable > 0 ? Math.round((totalLogged / totalAvailable) * 100) : 0;
    return { ...e, weekPcts, avg };
  });

  const teamWeekPcts = [0, 1, 2, 3].map(w =>
    engineerStats.length > 0
      ? Math.round(engineerStats.reduce((s, e) => s + (e.weekPcts[w] || 0), 0) / engineerStats.length)
      : 0
  );

  const teamTotalAvailable = allDays.reduce((s, d) => {
    const defaultH = isWeekend(d) ? 0 : 8;
    return s + (workdayHours[formatDateKey(d)] ?? defaultH);
  }, 0) * (engineers.length || 1);
  const teamTotalLogged = engineerStats.reduce((sum, e) =>
    sum + getWorkdays(allDays).reduce((s, d) => {
      const dayEntries = (allEntries[e.id] || {})[formatDateKey(d)] || [];
      return s + dayEntries.reduce((r, en) => r + (parseFloat(en.hours) || 0), 0);
    }, 0), 0);
  const teamAvg = teamTotalAvailable > 0
    ? Math.round((teamTotalLogged / teamTotalAvailable) * 100) : 0;

  return (
    <div>
      {/* Cycle navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, background: 'var(--gray-50)',
        border: '1px solid var(--gray-200)', borderRadius: 10, padding: '8px 12px',
      }}>
        <button onClick={() => setCycleMonth(m => offsetCycle(m, -1))}
          style={{ fontSize: 20, color: 'var(--red)', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)' }}>{getCycleLabel(cycleMonth)}</div>
          {isCurrentCycle && <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>● Current Cycle</div>}
        </div>
        <button onClick={() => setCycleMonth(m => offsetCycle(m, 1))} disabled={isCurrentCycle}
          style={{ fontSize: 20, color: isCurrentCycle ? 'var(--gray-300)' : 'var(--red)', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}>›</button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Team Overview</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <RingsChart weekPcts={teamWeekPcts} avg={teamAvg} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Individual Progress</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {engineerStats.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, minWidth: 80, color: 'var(--gray-700)' }}>{e.name}</div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ background: 'var(--gray-200)', borderRadius: 20, height: 12, overflow: 'visible', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '80%', top: -3, width: 2, height: 18, background: 'rgba(200,16,46,0.5)', zIndex: 2 }} />
                <div style={{
                  width: `${Math.min(e.avg, 100)}%`, height: '100%',
                  background: e.avg >= 80 ? 'var(--red)' : '#e8a0ac',
                  borderRadius: 20, transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', minWidth: 36, textAlign: 'right' }}>{e.avg}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
