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
        ot: e.ot || 'no',
      })));
    } else {
      setRows([{ id: Date.now(), activity: '', hours: '', wbs: 'no', ot: 'no' }]);
    }
  }, []);

  const availableHours = workdayHours[dateKey] ?? 8;
  const wbsHours   = rows.filter(r => r.wbs === 'yes').reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const noWbsHours = rows.filter(r => r.wbs === 'no').reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const otHours    = rows.filter(r => r.ot === 'yes').reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const loggedHours = wbsHours + noWbsHours;
  const billability = availableHours > 0 ? Math.round((loggedHours / availableHours) * 100) : 0;

  const addRow    = () => setRows(r => [...r, { id: Date.now(), activity: '', hours: '', wbs: 'no', ot: 'no' }]);
  const removeRow = (id) => setRows(r => r.filter(row => row.id !== id));
  const updateRow = (id, field, value) => setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const Toggle = ({ value, onChange, activeColor = 'var(--red)' }) => (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--gray-200)', height: 28 }}>
      {['yes', 'no'].map(v => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, fontSize: 10, fontWeight: 600,
          background: value === v ? activeColor : 'var(--gray-100)',
          color: value === v ? 'white' : 'var(--gray-500)',
          border: 'none', cursor: 'pointer',
        }}>
          {v === 'yes' ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {[
          ['Workday',     `${availableHours}h`,   false],
          ['Logged',      `${loggedHours}h`,       false],
          ['w/ WBS',      `${wbsHours}h`,          false],
          ['w/o WBS',     `${noWbsHours}h`,        false],
          ['OT',          `${otHours}h`,           otHours > 0],
          ['Billability', `${billability}%`,        billability >= 80],
        ].map(([label, value, highlight]) => (
          <div key={label} style={{
            background: highlight ? 'rgba(200,16,46,0.08)' : 'var(--gray-100)',
            border: `1px solid ${highlight ? 'var(--red-mid)' : 'var(--gray-200)'}`,
            borderRadius: 20, padding: '5px 10px', fontSize: 11,
          }}>
            {label}: <span style={{ color: 'var(--red)', fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Table header — 5 columns: Activity | Hours | WBS | OT | Delete */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 66px 66px 36px', gap: 4, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: '8px 8px 0 0', padding: '7px 8px' }}>
        {['Activity', 'Hours', 'WBS', 'OT', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {rows.map(row => (
        <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 66px 66px 36px', gap: 4, border: '1px solid var(--gray-200)', borderTop: 'none', background: 'white', padding: '6px 8px', alignItems: 'center' }}>
          <input
            type="text" placeholder="Activity..."
            value={row.activity}
            onChange={e => updateRow(row.id, 'activity', e.target.value)}
            style={{ border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 7px', fontSize: 12, background: 'var(--gray-50)', width: '100%' }}
          />
          <input
            type="number" min={0} max={24} step={0.5}
            value={row.hours}
            onChange={e => updateRow(row.id, 'hours', e.target.value)}
            style={{ border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 4px', fontSize: 12, textAlign: 'center', background: 'var(--gray-50)', width: '100%' }}
          />
          <Toggle value={row.wbs} onChange={v => updateRow(row.id, 'wbs', v)} />
          <Toggle value={row.ot} onChange={v => updateRow(row.id, 'ot', v)} activeColor='#1976D2' />
          <button onClick={() => removeRow(row.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--gray-200)', fontSize: 14, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>×</button>
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
