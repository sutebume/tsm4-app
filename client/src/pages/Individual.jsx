import { useState, useEffect } from 'react';
import {
  getCycleStartMonth, getBillingCycleDatesFromMonth, getCycleMonths,
  getCycleLabel, offsetCycle, getWorkdays, formatDateKey, calcWeekBillability, isWeekend
} from '../utils/billing';
import { exportEngineerEntries, exportAllEngineers } from '../utils/exportExcel';
import RingsChart from '../components/RingsChart';
import MiniCalendar from '../components/MiniCalendar';

export default function Individual({ engineers, allEntries, engineerWorkdayHours, onDayClick, user }) {
  const isEngineer = user?.role === 'engineer';
  const today = new Date();
  const currentCycleMonth = getCycleStartMonth(today);

  const getInitialIdx = () => {
    if (isEngineer && user?.engineer_id) {
      const idx = engineers.findIndex(e => e.id === user.engineer_id);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  };

  const [activeEng, setActiveEng] = useState(0);
  const [cycleMonth, setCycleMonth] = useState(currentCycleMonth);

  useEffect(() => { setActiveEng(getInitialIdx()); }, [engineers, user]);

  const isCurrentCycle =
    cycleMonth.getFullYear() === currentCycleMonth.getFullYear() &&
    cycleMonth.getMonth() === currentCycleMonth.getMonth();

  const weeks = getBillingCycleDatesFromMonth(cycleMonth);
  const engineer = engineers[activeEng];
  const entries = engineer ? (allEntries[engineer.id] || {}) : {};
  const workdayHours = (engineer && engineerWorkdayHours[engineer.id]) || {};

  const weekPcts = weeks.map(days => calcWeekBillability(entries, workdayHours, days));

  const allCycleDays = weeks.flat();
  const totalAvailable = allCycleDays.reduce((s, d) => {
    const defaultH = isWeekend(d) ? 0 : 8;
    return s + (workdayHours[formatDateKey(d)] ?? defaultH);
  }, 0);
  const totalLogged = allCycleDays.reduce((s, d) => {
    const dayEntries = entries[formatDateKey(d)] || [];
    return s + dayEntries.reduce((r, e) => r + (parseFloat(e.hours) || 0), 0);
  }, 0);
  const avg = totalAvailable > 0 ? Math.round((totalLogged / totalAvailable) * 100) : 0;

  const activeWeekIdx = isCurrentCycle
    ? weeks.findIndex(days => days.some(d => formatDateKey(d) === formatDateKey(today)))
    : -1;

  // Always exactly 2 months from the cycle
  const cycleCalMonths = getCycleMonths(weeks); // guaranteed 2

  const renderEngineerSelector = () => {
    if (isEngineer) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, background: 'var(--red)', color: 'white', border: '1px solid var(--red)' }}>
            {engineer?.name || '—'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Your profile</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {engineers.map((e, i) => (
          <button key={e.id} onClick={() => setActiveEng(i)} style={{
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
            background: activeEng === i ? 'var(--red)' : 'var(--gray-50)',
            color: activeEng === i ? 'white' : 'var(--gray-700)',
            border: `1px solid ${activeEng === i ? 'var(--red)' : 'var(--gray-200)'}`,
          }}>{e.name}</button>
        ))}
      </div>
    );
  };

  return (
    <div>
      {renderEngineerSelector()}

      {/* Cycle navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, background: 'var(--gray-50)',
        border: '1px solid var(--gray-200)', borderRadius: 10, padding: '8px 12px',
      }}>
        <button
          onClick={() => setCycleMonth(m => offsetCycle(m, -1))}
          style={{ fontSize: 20, color: 'var(--red)', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)' }}>
            {getCycleLabel(cycleMonth)}
          </div>
          {isCurrentCycle && (
            <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>● Current Cycle</div>
          )}
        </div>
        <button
          onClick={() => setCycleMonth(m => offsetCycle(m, 1))}
          disabled={isCurrentCycle}
          style={{ fontSize: 20, color: isCurrentCycle ? 'var(--gray-300)' : 'var(--red)', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
        >›</button>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => exportEngineerEntries(engineer, entries, workdayHours, weeks, getCycleLabel(cycleMonth))}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            background: 'var(--gray-50)', border: '1px solid var(--gray-200)', color: 'var(--gray-700)',
            cursor: 'pointer',
          }}
        >
          📥 Export {isEngineer ? 'My' : engineer?.name?.split(' ')[0] + "'s"} Entries
        </button>
        {!isEngineer && (
          <button
            onClick={() => exportAllEngineers(engineers, allEntries, engineerWorkdayHours, weeks, getCycleLabel(cycleMonth))}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              background: 'var(--red)', border: 'none', color: 'white',
              cursor: 'pointer',
            }}
          >
            📥 Export All Engineers
          </button>
        )}
      </div>

      {/* Week chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {weeks.map((days, i) => (
          <div key={i} style={{
            flex: 1,
            background: i === activeWeekIdx ? 'var(--red-light)' : 'var(--gray-100)',
            border: `1px solid ${i === activeWeekIdx ? 'var(--red-mid)' : 'var(--gray-200)'}`,
            borderRadius: 8, padding: '6px 4px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-500)' }}>Wk{i + 1}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{weekPcts[i]}%</div>
          </div>
        ))}
      </div>

      {/* Rings chart */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <RingsChart weekPcts={weekPcts} avg={avg} />
      </div>

      {/* Always 2 mini calendars — derived from actual cycle months */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {cycleCalMonths.map(month => (
          <MiniCalendar
            key={`${month.getFullYear()}-${month.getMonth()}`}
            month={month}
            entries={entries}
            workdayHours={workdayHours}
            engineerId={engineer?.id}
            engineerName={engineer?.name}
            cycleWeeks={weeks}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      {/* Cycle summary */}
      <CycleSummary weeks={weeks} entries={entries} workdayHours={workdayHours} />
    </div>
  );
}

function CycleSummary({ weeks, entries, workdayHours }) {
  const allDays = weeks.flat();

  const totalAvailable = allDays.reduce((s, d) => {
    const defaultH = isWeekend(d) ? 0 : 8;
    return s + (workdayHours[formatDateKey(d)] ?? defaultH);
  }, 0);

  let wbsHours = 0;
  let noWbsHours = 0;
  let otHours = 0;

  for (const d of allDays) {
    const key = formatDateKey(d);
    const dayEntries = entries[key] || [];
    for (const e of dayEntries) {
      const h = parseFloat(e.hours) || 0;
      if (e.wbs === 'yes') wbsHours += h;
      else noWbsHours += h;
      if (e.ot === 'yes') otHours += h;
    }
  }

  const totalLogged = wbsHours + noWbsHours;
  const missingToComplete = Math.max(0, totalAvailable - totalLogged);

  // Hours needed to reach 80% billability target
  const target80Hours = totalAvailable * 0.8;
  const missingTo80 = Math.max(0, target80Hours - totalLogged);
  const currentPct = totalAvailable > 0 ? Math.round((totalLogged / totalAvailable) * 100) : 0;
  const above80 = currentPct >= 80;

  const row = (icon, label, value, valueColor = 'var(--gray-900)', last = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: last ? 'none' : '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--gray-700)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: valueColor }}>{value}</span>
    </div>
  );

  return (
    <div style={{ marginTop: 16, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '4px 16px 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.8, padding: '10px 0 4px' }}>
        Cycle Summary
      </div>
      {row('✅', 'Hours w/ WBS', `${wbsHours.toFixed(1)}h`, 'var(--red)')}
      {row('📋', 'Hours w/o WBS', `${noWbsHours.toFixed(1)}h`, 'var(--gray-700)')}
      {row('🕐', 'Overtime (OT) Hours', `${otHours.toFixed(1)}h`, otHours > 0 ? '#1976D2' : 'var(--gray-400)')}
      {row('⏱️', 'Total Logged', `${totalLogged.toFixed(1)}h`, 'var(--gray-900)')}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--gray-200)', margin: '4px 0' }} />

      {/* Missing to 80% */}
      {row(
        above80 ? '🎯' : '📈',
        'Missing hours to reach 80%',
        above80 ? 'Target met ✓' : `${missingTo80.toFixed(1)}h`,
        above80 ? '#27ae60' : '#e67e22',
      )}

      {/* Missing to complete cycle */}
      {row(
        missingToComplete === 0 ? '✨' : '⚠️',
        'Missing hours to complete cycle',
        missingToComplete === 0 ? 'Complete ✓' : `${missingToComplete.toFixed(1)}h`,
        missingToComplete === 0 ? '#27ae60' : '#c0392b',
        true,
      )}
    </div>
  );
}
