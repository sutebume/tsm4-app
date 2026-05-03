import { useState, useEffect } from 'react';

export default function CalendarEntry({ date, dateKey, engineerName, workdayHours, existingEntries, onBack, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (existingEntries && existingEntries.length > 0) {
      setRows(existingEntries.map(e => ({
        id: e.id || Date.now() + Math.random(),
        activity: e.activity,
        hours: String(e.hours),
        wbs: e.wbs,
      })));
    } else {
      setRows([{ id: Date.now(), activity: '', hours: '', wbs: 'no' }]);
    }
  }, []);

  const availableHours = workdayHours[dateKey] ?? 8;
  const wbsHours    = rows.filter(r => r.wbs === 'yes').reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const noWbsHours  = rows.filter(r => r.wbs === 'no').reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const loggedHours = wbsHours + noWbsHours;
  // Billability = ALL logged hours / available hours
  const billability = availableHours > 0 ? Math.round((loggedHours / availableHours) * 100) : 0;

  const addRow    = () => setRows(r => [...r, { id: Date.now(), activity: '', hours: '', wbs: 'no' }]);
  const removeRow = (id) => setRows(r => r.filter(row => row.id !== id));
  const updateRow = (id, field, value) => setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--gray-200)', fontSize: 16, color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            {date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{engineerName}</div>
        </div>
      </div>

      {/* Info pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {[
          ['Workday',     `${availableHours}h`],
          ['Logged',      `${loggedHours}h`],
          ['w/ WBS',      `${wbsHours}h`],
          ['w/o WBS',     `${noWbsHours}h`],
          ['Billability', `${billability}%`],
        ].map(([label, value]) => (
          <div key={label} style={{
            background: label === 'Billability' && billability >= 80 ? 'rgba(200,16,46,0.08)' : 'var(--gray-100)',
            border: `1px solid ${label === 'Billability' && billability >= 80 ? 'var(--red-mid)' : 'var(--gray-200)'}`,
            borderRadius: 20, padding: '5px 12px', fontSize: 12,
          }}>
            {label}: <span style={{ color: 'var(--red)', fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 44px', gap: 6, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: '8px 8px 0 0', padding: '8px 10px' }}>
        {['Activity Name', 'Hours', 'w/ WBS', ''].map(h => (
          <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {rows.map(row => (
        <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 44px', gap: 6, border: '1px solid var(--gray-200)', borderTop: 'none', background: 'white', padding: '8px 10px', alignItems: 'center' }}>
          <input
            type="text" placeholder="Activity..."
            value={row.activity}
            onChange={e => updateRow(row.id, 'activity', e.target.value)}
            style={{ border: '1px solid var(--gray-200)', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--gray-50)' }}
          />
          <input
            type="number" min={0} max={24} step={0.5}
            value={row.hours}
            onChange={e => updateRow(row.id, 'hours', e.target.value)}
            style={{ border: '1px solid var(--gray-200)', borderRadius: 6, padding: '6px 8px', fontSize: 12, textAlign: 'center', background: 'var(--gray-50)' }}
          />
          {/* WBS toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
            {['yes', 'no'].map(v => (
              <button key={v} onClick={() => updateRow(row.id, 'wbs', v)} style={{
                flex: 1, fontSize: 11, fontWeight: 600, padding: '5px 0',
                background: row.wbs === v ? 'var(--red)' : 'var(--gray-100)',
                color: row.wbs === v ? 'white' : 'var(--gray-500)',
                border: 'none',
              }}>
                {v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
          <button onClick={() => removeRow(row.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--gray-200)', fontSize: 14, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      ))}

      {/* Add row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, marginBottom: 20 }}>
        <button onClick={addRow} style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', border: '1px solid var(--red-mid)', borderRadius: 8, padding: '6px 14px', background: 'var(--red-light)' }}>
          + Add Row
        </button>
      </div>

      <button onClick={() => onSave(rows)} style={{ width: '100%', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Save
      </button>
    </div>
  );
}
