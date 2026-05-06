const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const { auth } = require('./auth');

const router = express.Router();

// Admin-only middleware
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// GET /api/settings/engineers  (public — used by login page for engineer count)
router.get('/engineers', (req, res) => {
  const db = getDB();
  const engineers = db.prepare('SELECT * FROM engineers ORDER BY sort_order ASC').all();
  res.json(engineers);
});

// PUT /api/settings/engineers  (update names)
router.put('/engineers', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { engineers } = req.body;
  const stmt = db.prepare('UPDATE engineers SET name = ? WHERE id = ?');
  const updateAll = db.transaction(() => {
    for (const e of engineers) stmt.run(e.name, e.id);
  });
  updateAll();
  res.json({ success: true });
});

// POST /api/settings/engineers  (add new engineer)
router.post('/engineers', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM engineers').get();
  const sortOrder = (maxOrder.m ?? -1) + 1;
  const result = db.prepare('INSERT INTO engineers (name, sort_order, hours_group_id) VALUES (?, ?, 1)').run(name, sortOrder);
  res.json({ id: result.lastInsertRowid, name, sort_order: sortOrder, hours_group_id: 1 });
});

// DELETE /api/settings/engineers/:id
router.delete('/engineers/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  const id = req.params.id;
  // Delete entries first (FK constraint: entries.engineer_id → engineers.id)
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM entries WHERE engineer_id = ?').run(id);
    db.prepare('DELETE FROM engineers WHERE id = ?').run(id);
  });
  deleteAll();
  res.json({ success: true });
});

// GET /api/settings/workday-hours
router.get('/workday-hours', auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM workday_hours').all();
  res.json(rows);
});

// PUT /api/settings/workday-hours
router.put('/workday-hours', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { hours } = req.body;
  const stmt = db.prepare(
    'INSERT INTO workday_hours (date, hours) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET hours = excluded.hours'
  );
  const saveAll = db.transaction(() => {
    for (const [date, h] of Object.entries(hours)) {
      stmt.run(date, parseFloat(h) || 8);
    }
  });
  saveAll();
  res.json({ success: true });
});

// ── Working Hours Groups ──────────────────────────────────────────────────────

// GET /api/settings/hours-groups  — list groups with assigned engineers
router.get('/hours-groups', auth, (req, res) => {
  const db = getDB();
  const groups = db.prepare('SELECT * FROM working_hours_groups ORDER BY id ASC').all();
  const engineers = db.prepare('SELECT id, name, hours_group_id FROM engineers ORDER BY sort_order ASC').all();
  const result = groups.map(g => ({
    ...g,
    engineers: engineers.filter(e => e.hours_group_id === g.id),
  }));
  res.json(result);
});

// GET /api/settings/hours-groups/with-hours  — bulk load for App startup
router.get('/hours-groups/with-hours', auth, (req, res) => {
  const db = getDB();
  const groups = db.prepare('SELECT * FROM working_hours_groups ORDER BY id ASC').all();
  const engineers = db.prepare('SELECT id, name, hours_group_id FROM engineers ORDER BY sort_order ASC').all();
  const allHours = db.prepare('SELECT group_id, date, hours FROM group_workday_hours').all();

  // Build { groupId: { date: hours } }
  const hoursMap = {};
  for (const row of allHours) {
    if (!hoursMap[row.group_id]) hoursMap[row.group_id] = {};
    hoursMap[row.group_id][row.date] = row.hours;
  }

  const result = groups.map(g => ({
    ...g,
    engineers: engineers.filter(e => e.hours_group_id === g.id),
    workdayHours: hoursMap[g.id] || {},
  }));
  res.json(result);
});

// POST /api/settings/hours-groups  — create group
router.post('/hours-groups', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const existing = db.prepare('SELECT id FROM working_hours_groups WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Group name already exists' });
  const result = db.prepare('INSERT INTO working_hours_groups (name) VALUES (?)').run(name);
  res.json({ id: result.lastInsertRowid, name, engineers: [], workdayHours: {} });
});

// PUT /api/settings/hours-groups/:id  — rename group
router.put('/hours-groups/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  db.prepare('UPDATE working_hours_groups SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ success: true });
});

// DELETE /api/settings/hours-groups/:id  — delete group (Default is protected)
router.delete('/hours-groups/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  const id = parseInt(req.params.id);
  if (id === 1) return res.status(400).json({ error: 'Cannot delete the Default group' });
  // Reassign engineers to Default before deleting
  db.prepare('UPDATE engineers SET hours_group_id = 1 WHERE hours_group_id = ?').run(id);
  db.prepare('DELETE FROM group_workday_hours WHERE group_id = ?').run(id);
  db.prepare('DELETE FROM working_hours_groups WHERE id = ?').run(id);
  res.json({ success: true });
});

// GET /api/settings/hours-groups/:id/workday-hours
router.get('/hours-groups/:id/workday-hours', auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT date, hours FROM group_workday_hours WHERE group_id = ?').all(req.params.id);
  const map = {};
  rows.forEach(r => { map[r.date] = r.hours; });
  res.json(map);
});

// PUT /api/settings/hours-groups/:id/workday-hours
router.put('/hours-groups/:id/workday-hours', auth, adminOnly, (req, res) => {
  const db = getDB();
  const groupId = parseInt(req.params.id);
  const { hours } = req.body;
  const stmt = db.prepare(
    'INSERT INTO group_workday_hours (group_id, date, hours) VALUES (?, ?, ?) ON CONFLICT(group_id, date) DO UPDATE SET hours = excluded.hours'
  );
  const saveAll = db.transaction(() => {
    for (const [date, h] of Object.entries(hours)) {
      stmt.run(groupId, date, parseFloat(h) || 0);
    }
  });
  saveAll();
  res.json({ success: true });
});

// PUT /api/settings/engineers/:engId/hours-group  — assign engineer to group
router.put('/engineers/:engId/hours-group', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { group_id } = req.body;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });
  const group = db.prepare('SELECT id FROM working_hours_groups WHERE id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  db.prepare('UPDATE engineers SET hours_group_id = ? WHERE id = ?').run(group_id, req.params.engId);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings/users  (admin only)
router.get('/users', auth, adminOnly, (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, username, role, name, engineer_id, telegram_id FROM users ORDER BY id ASC').all();
  res.json(users);
});

// POST /api/settings/users  (add user)
router.post('/users', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { username, password, role, name, engineer_id, telegram_id } = req.body;
  if (!username || !password || !role || !name)
    return res.status(400).json({ error: 'All fields required' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const engId = engineer_id || null;
  const tgId = telegram_id || null;
  const result = db.prepare('INSERT INTO users (username, password, role, name, engineer_id, telegram_id, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 1)').run(username, hash, role, name, engId, tgId);
  res.json({ id: result.lastInsertRowid, username, role, name, engineer_id: engId, telegram_id: tgId });
});

// PUT /api/settings/users/:id  (update user)
router.put('/users/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { username, password, role, name, engineer_id, telegram_id } = req.body;
  const engId = engineer_id || null;
  const tgId = telegram_id || null;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET username=?, password=?, role=?, name=?, engineer_id=?, telegram_id=?, must_change_password=1 WHERE id=?').run(username, hash, role, name, engId, tgId, req.params.id);
  } else {
    db.prepare('UPDATE users SET username=?, role=?, name=?, engineer_id=?, telegram_id=? WHERE id=?').run(username, role, name, engId, tgId, req.params.id);
  }
  res.json({ success: true });
});

// DELETE /api/settings/users/:id
router.delete('/users/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/settings/reminder-config
router.get('/reminder-config', auth, adminOnly, (req, res) => {
  const db = getDB();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('app_url','reminder_message')").all();
  const config = {};
  rows.forEach(r => { config[r.key] = r.value; });
  // Defaults
  if (!config.app_url) config.app_url = process.env.APP_URL || '';
  if (!config.reminder_message) config.reminder_message = [
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
  res.json(config);
});

// PUT /api/settings/reminder-config
router.put('/reminder-config', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { app_url, reminder_message } = req.body;
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  if (app_url !== undefined) upsert.run('app_url', app_url);
  if (reminder_message !== undefined) upsert.run('reminder_message', reminder_message);
  res.json({ success: true });
});

// POST /api/settings/test-reminder
router.post('/test-reminder', auth, adminOnly, async (req, res) => {
  const { telegram_id, name } = req.body;
  if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });
  try {
    const { sendMessage } = require('../telegram');
    const db = getDB();
    const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'app_url'").get();
    const appUrl = urlRow?.value || process.env.APP_URL || '';
    await sendMessage(telegram_id, [
      `✅ <b>TSM4 Test Message</b>`,
      ``,
      `Hi <b>${name || 'there'}</b>! This is a test reminder from TSM4 Billability.`,
      `Your Telegram is connected successfully! 🎉`,
      ``,
      appUrl ? `🔗 ${appUrl}` : '',
    ].filter(Boolean).join('\n'));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backup and restore routes follow below


// GET /api/settings/backup  — download full DB as JSON
router.get('/backup', auth, adminOnly, (req, res) => {
  const db = getDB();
  const backup = {
    version: 2,
    exported_at: new Date().toISOString(),
    engineers:            db.prepare('SELECT * FROM engineers').all(),
    entries:              db.prepare('SELECT * FROM entries').all(),
    workday_hours:        db.prepare('SELECT * FROM workday_hours').all(),
    working_hours_groups: db.prepare('SELECT * FROM working_hours_groups').all(),
    group_workday_hours:  db.prepare('SELECT * FROM group_workday_hours').all(),
    users:                db.prepare('SELECT id, username, password, role, name, engineer_id, telegram_id FROM users').all(),
  };
  const filename = `tsm4-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(backup, null, 2));
});

// POST /api/settings/restore  — restore DB from JSON backup
router.post('/restore', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { engineers, entries, workday_hours, working_hours_groups, group_workday_hours, users, version } = req.body;

  if (!version || !engineers || !entries || !users)
    return res.status(400).json({ error: 'Invalid backup file format' });

  try {
    const restore = db.transaction(() => {
      db.prepare('DELETE FROM entries').run();
      db.prepare('DELETE FROM group_workday_hours').run();
      db.prepare('DELETE FROM working_hours_groups').run();
      db.prepare('DELETE FROM workday_hours').run();
      db.prepare('DELETE FROM engineers').run();
      db.prepare('DELETE FROM users').run();

      // Restore hours groups (v2+) or seed Default (v1 legacy)
      if (working_hours_groups && working_hours_groups.length) {
        for (const g of working_hours_groups) {
          db.prepare('INSERT INTO working_hours_groups (id, name) VALUES (?, ?)').run(g.id, g.name);
        }
      } else {
        db.prepare('INSERT INTO working_hours_groups (id, name) VALUES (1, ?)').run('Default');
      }

      for (const e of engineers) {
        db.prepare('INSERT INTO engineers (id, name, sort_order, hours_group_id) VALUES (?, ?, ?, ?)').run(e.id, e.name, e.sort_order, e.hours_group_id ?? 1);
      }
      for (const e of entries) {
        db.prepare('INSERT INTO entries (id, engineer_id, date, activity, hours, wbs, ot) VALUES (?, ?, ?, ?, ?, ?, ?)').run(e.id, e.engineer_id, e.date, e.activity, e.hours, e.wbs, e.ot ?? 'no');
      }
      if (group_workday_hours && group_workday_hours.length) {
        for (const w of group_workday_hours) {
          db.prepare('INSERT INTO group_workday_hours (group_id, date, hours) VALUES (?, ?, ?)').run(w.group_id, w.date, w.hours);
        }
      } else if (workday_hours && workday_hours.length) {
        // Migrate legacy v1 workday_hours into Default group
        for (const w of workday_hours) {
          db.prepare('INSERT INTO group_workday_hours (group_id, date, hours) VALUES (1, ?, ?)').run(w.date, w.hours);
        }
      }
      if (workday_hours) {
        for (const w of workday_hours) {
          db.prepare('INSERT INTO workday_hours (date, hours) VALUES (?, ?)').run(w.date, w.hours);
        }
      }
      for (const u of users) {
        db.prepare('INSERT INTO users (id, username, password, role, name, engineer_id, telegram_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(u.id, u.username, u.password, u.role, u.name, u.engineer_id ?? null, u.telegram_id ?? null);
      }

      // Reset autoincrement sequences
      try { db.prepare("UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM working_hours_groups) WHERE name = 'working_hours_groups'").run(); } catch(e) {}
      try { db.prepare("UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM engineers) WHERE name = 'engineers'").run(); } catch(e) {}
      try { db.prepare("UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM entries) WHERE name = 'entries'").run(); } catch(e) {}
      try { db.prepare("UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM users) WHERE name = 'users'").run(); } catch(e) {}
    });

    restore();
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

module.exports = router;
