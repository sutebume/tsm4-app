import * as XLSX from 'xlsx';
import { formatDateKey, isWeekend } from './billing';

/**
 * Build a 2-D array of rows for one engineer's entries in a cycle.
 */
function buildEngineerRows(engineer, entries, workdayHours, weeks, cycleLabel) {
  const allDays = weeks.flat();

  const rows = [];

  // ── Header block ──────────────────────────────────────────
  rows.push(['TSM4 Billability Export']);
  rows.push(['Engineer:', engineer.name]);
  rows.push(['Cycle:', cycleLabel]);
  rows.push(['Exported:', new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })]);
  rows.push([]);

  // ── Column headers ────────────────────────────────────────
  rows.push(['Date', 'Day', 'Activity', 'Hours', 'WBS', 'OT']);

  // ── Data rows ─────────────────────────────────────────────
  let totalAvailable = 0;
  let totalLogged = 0;
  let wbsLogged = 0;

  for (const d of allDays) {
    const key = formatDateKey(d);
    const weekend = isWeekend(d);
    const defaultH = weekend ? 0 : 8;
    const availH = workdayHours[key] ?? defaultH;
    totalAvailable += availH;

    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayEntries = entries[key] || [];

    if (dayEntries.length === 0) {
      const note = availH === 0 ? (weekend ? 'Weekend' : 'Holiday / No hours') : '—';
      rows.push([dateLabel, dayLabel, note, '', '', '']);
    } else {
      for (const e of dayEntries) {
        const h = parseFloat(e.hours) || 0;
        totalLogged += h;
        if (e.wbs === 'yes') wbsLogged += h;
        rows.push([
          dateLabel,
          dayLabel,
          e.activity,
          h,
          e.wbs === 'yes' ? 'Yes' : 'No',
          e.ot  === 'yes' ? 'Yes' : 'No',
        ]);
      }
    }
  }

  // ── Summary block ─────────────────────────────────────────
  const billability = totalAvailable > 0 ? Math.round((totalLogged / totalAvailable) * 100) : 0;
  const missing80   = Math.max(0, totalAvailable * 0.8 - totalLogged);

  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['Total Available Hours', totalAvailable]);
  rows.push(['Total Logged Hours',    totalLogged]);
  rows.push(['WBS Hours',             wbsLogged]);
  rows.push(['Non-WBS Hours',         parseFloat((totalLogged - wbsLogged).toFixed(2))]);
  rows.push(['Billability',           `${billability}%`]);
  rows.push(['Missing to reach 80%',  missing80 > 0 ? `${missing80.toFixed(1)}h` : 'Target met ✓']);

  return rows;
}

/** Shared column widths for every sheet. */
const COL_WIDTHS = [
  { wch: 22 }, // Date
  { wch: 5  }, // Day
  { wch: 42 }, // Activity
  { wch: 8  }, // Hours
  { wch: 6  }, // WBS
  { wch: 6  }, // OT
];

/**
 * Export a single engineer's entries for the current cycle.
 * @param {string} cycleLabel  — e.g. "Apr 26 – May 25, 2026"
 */
export function exportEngineerEntries(engineer, entries, workdayHours, weeks, cycleLabel) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildEngineerRows(engineer, entries, workdayHours, weeks, cycleLabel));
  ws['!cols'] = COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, ws, engineer.name.substring(0, 31));

  const safeCycle = cycleLabel.replace(/[^a-z0-9]/gi, '-');
  const safeName  = engineer.name.replace(/\s+/g, '-');
  XLSX.writeFile(wb, `tsm4-${safeName}-${safeCycle}.xlsx`);
}

/**
 * Export all engineers in a single workbook (one sheet per engineer).
 * @param {string} cycleLabel  — e.g. "Apr 26 – May 25, 2026"
 */
export function exportAllEngineers(engineers, allEntries, engineerWorkdayHours, weeks, cycleLabel) {
  const wb = XLSX.utils.book_new();

  for (const engineer of engineers) {
    const entries      = allEntries[engineer.id]           || {};
    const workdayHours = engineerWorkdayHours[engineer.id] || {};
    const ws = XLSX.utils.aoa_to_sheet(buildEngineerRows(engineer, entries, workdayHours, weeks, cycleLabel));
    ws['!cols'] = COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, engineer.name.substring(0, 31));
  }

  const safeCycle = cycleLabel.replace(/[^a-z0-9]/gi, '-');
  XLSX.writeFile(wb, `tsm4-all-engineers-${safeCycle}.xlsx`);
}
