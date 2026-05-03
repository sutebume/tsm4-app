// Billing cycle: 26th of month → 25th of next month
// Wk1: 26–32 (7d), Wk2: 33–39 (7d), Wk3: 40–46 (7d), Wk4: 47–25th of next month
// ALL days (including weekends) can have entries and count toward billability

export function getCycleStartMonth(referenceDate = new Date()) {
  const d = referenceDate.getDate();
  const m = referenceDate.getMonth();
  const y = referenceDate.getFullYear();
  if (d < 26) return new Date(y, m - 1, 1);
  return new Date(y, m, 1);
}

export function getBillingCycleDatesFromMonth(cycleStartMonth) {
  const year = cycleStartMonth.getFullYear();
  const month = cycleStartMonth.getMonth();
  const weeks = [];

  // Wk1–Wk3: 7 days each
  for (let w = 0; w < 3; w++) {
    const days = [];
    const startOffset = 26 + w * 7;
    for (let d = 0; d < 7; d++) {
      days.push(new Date(year, month, startOffset + d));
    }
    weeks.push(days);
  }

  // Wk4: day 47 of cycle month up to the 25th of next month
  const wk4 = [];
  let day = new Date(year, month, 47);
  const cycleEnd = new Date(year, month + 1, 25);
  while (day <= cycleEnd) {
    wk4.push(new Date(day));
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  weeks.push(wk4);

  return weeks;
}

export function getBillingCycleDates(referenceDate = new Date()) {
  return getBillingCycleDatesFromMonth(getCycleStartMonth(referenceDate));
}

// All days in the cycle (including weekends)
export function getAllDays(dates) {
  return dates;
}

// Weekday-only days (kept for reference/display, NOT used for billability calc)
export function getWorkdays(dates) {
  return dates.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
}

export function getCycleMonths(weeks) {
  const seen = new Set();
  const months = [];
  for (const week of weeks) {
    for (const d of week) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(key)) {
        seen.add(key);
        months.push(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }
  return months;
}

export function getCycleLabel(cycleStartMonth) {
  const weeks = getBillingCycleDatesFromMonth(cycleStartMonth);
  const firstDay = weeks[0][0];
  const lastDay = weeks[3][weeks[3].length - 1];
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(firstDay)} – ${fmt(lastDay)}, ${lastDay.getFullYear()}`;
}

export function offsetCycle(cycleStartMonth, offset) {
  return new Date(cycleStartMonth.getFullYear(), cycleStartMonth.getMonth() + offset, 1);
}

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function formatDisplayDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Billability = ALL logged hours / available hours
// Weekdays default to 8h if not configured, weekends default to 0h unless explicitly set
export function calcWeekBillability(entries, workdayHoursMap, weekDates) {
  const availableHours = weekDates.reduce((sum, d) => {
    const key = formatDateKey(d);
    const isWE = d.getDay() === 0 || d.getDay() === 6;
    // Weekdays default 8h, weekends default 0h — only count weekend if admin set hours > 0
    const h = workdayHoursMap[key] ?? (isWE ? 0 : 8);
    return sum + h;
  }, 0);

  if (availableHours === 0) return 0;

  const loggedHours = weekDates.reduce((sum, d) => {
    const key = formatDateKey(d);
    const dayEntries = entries[key] || [];
    return sum + dayEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  }, 0);

  return Math.round((loggedHours / availableHours) * 100);
}
