require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { getDB, initDB } = require('../db');
const { sendMessage } = require('../telegram');

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function formatDisplay(dateKey) {
  const [y, m, d] = dateKey.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function getCycleDaysUntilYesterday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const day = today.getDate();
  const cycleStartMonth = day < 26
    ? new Date(today.getFullYear(), today.getMonth() - 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const year = cycleStartMonth.getFullYear();
  const month = cycleStartMonth.getMonth();

  const cycleDays = [];
  let d = new Date(year, month, 26);
  const cycleEnd = new Date(year, month + 1, 25);

  while (d <= cycleEnd && d <= yesterday) {
    cycleDays.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }

  return cycleDays;
}

function buildMessage(template, vars) {
  return template
    .replace('{name}', vars.name)
    .replace('{count}', vars.count)
    .replace('{days}', vars.count === 1 ? 'day' : 'days')
    .replace('{day_list}', vars.day_list)
    .replace('{app_url}', vars.app_url);
}

async function runReminders() {
  initDB();
  const db = getDB();

  console.log(`[TSM4 Reminder] Running at ${new Date().toLocaleString()}`);

  // Load reminder config from DB
  const configRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('app_url','reminder_message')").all();
  const config = {};
  configRows.forEach(r => { config[r.key] = r.value; });

  const appUrl = config.app_url || process.env.APP_URL || '';
  const messageTemplate = config.reminder_message || [
    `⏰ <b>TSM4 Billability Reminder</b>`,
    ``,
    `Hi <b>{name}</b>! 👋`,
    ``,
    `You have <b>{count} missing {days}</b> in the current billing cycle:`,
    ``,
    `{day_list}`,
    ``,
    `Please open TSM4 and log your activities:`,
    `🔗 {app_url}`,
    ``,
    `🎯 Target: <b>80%</b> billability per cycle`,
  ].join('\n');

  // Get all engineers with linked users that have a telegram_id
  const engineers = db.prepare(`
    SELECT e.id as engineer_id, e.name as engineer_name,
           u.telegram_id, u.name as user_name
    FROM engineers e
    JOIN users u ON u.engineer_id = e.id
    WHERE u.telegram_id IS NOT NULL AND u.telegram_id != ''
  `).all();

  if (engineers.length === 0) {
    console.log('[TSM4 Reminder] No engineers with Telegram IDs found.');
    return;
  }

  const cycleDays = getCycleDaysUntilYesterday();

  if (cycleDays.length === 0) {
    console.log('[TSM4 Reminder] No past cycle days to check yet.');
    return;
  }

  let sent = 0;

  for (const eng of engineers) {
    const emptyDays = [];

    for (const d of cycleDays) {
      const key = formatDateKey(d);
      const wh = db.prepare('SELECT hours FROM workday_hours WHERE date = ?').get(key);
      const defaultHours = isWeekend(d) ? 0 : 8;
      const availableHours = wh ? wh.hours : defaultHours;
      if (availableHours === 0) continue;

      const entries = db.prepare(
        'SELECT COUNT(*) as count FROM entries WHERE engineer_id = ? AND date = ?'
      ).get(eng.engineer_id, key);

      if (entries.count === 0) emptyDays.push(key);
    }

    if (emptyDays.length === 0) {
      console.log(`[TSM4 Reminder] ${eng.engineer_name} — all days logged, skipping`);
      continue;
    }

    const dayLines = emptyDays.map(key => `  • ${formatDisplay(key)}`).join('\n');

    const message = buildMessage(messageTemplate, {
      name: eng.user_name,
      count: emptyDays.length,
      day_list: dayLines,
      app_url: appUrl,
    });

    try {
      await sendMessage(eng.telegram_id, message);
      console.log(`[TSM4 Reminder] ✓ Sent to ${eng.engineer_name} — ${emptyDays.length} empty days`);
      sent++;
    } catch (err) {
      console.error(`[TSM4 Reminder] ✗ Failed for ${eng.engineer_name}: ${err.message}`);
    }
  }

  console.log(`[TSM4 Reminder] Done — sent ${sent} reminder(s)`);
}

runReminders().catch(console.error);
