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
  const result = db.prepare('INSERT INTO engineers (name, sort_order) VALUES (?, ?)').run(name, sortOrder);
  res.json({ id: result.lastInsertRowid, name, sort_order: sortOrder });
});

// DELETE /api/settings/engineers/:id
router.delete('/engineers/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM engineers WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM entries WHERE engineer_id = ?').run(req.params.id);
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

// GET /api/settings/users  (admin only)
router.get('/users', auth, adminOnly, (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, username, role, name, engineer_id FROM users ORDER BY id ASC').all();
  res.json(users);
});

// POST /api/settings/users  (add user)
router.post('/users', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { username, password, role, name, engineer_id } = req.body;
  if (!username || !password || !role || !name)
    return res.status(400).json({ error: 'All fields required' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const engId = engineer_id || null;
  // New users created by admin must change password on first login
  const result = db.prepare('INSERT INTO users (username, password, role, name, engineer_id, must_change_password) VALUES (?, ?, ?, ?, ?, ?)').run(username, hash, role, name, engId, 1);
  res.json({ id: result.lastInsertRowid, username, role, name, engineer_id: engId });
});

// PUT /api/settings/users/:id  (update user)
router.put('/users/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { username, password, role, name, engineer_id } = req.body;
  const engId = engineer_id || null;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    // Admin resetting password forces must_change_password = 1 again
    db.prepare('UPDATE users SET username=?, password=?, role=?, name=?, engineer_id=?, must_change_password=1 WHERE id=?').run(username, hash, role, name, engId, req.params.id);
  } else {
    db.prepare('UPDATE users SET username=?, role=?, name=?, engineer_id=? WHERE id=?').run(username, role, name, engId, req.params.id);
  }
  res.json({ success: true });
});

// DELETE /api/settings/users/:id
router.delete('/users/:id', auth, adminOnly, (req, res) => {
  const db = getDB();
  // Prevent deleting yourself
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

// GET /api/settings/backup  — download full DB as JSON
router.get('/backup', auth, adminOnly, (req, res) => {
  const db = getDB();
  const backup = {
    version: 1,
    exported_at: new Date().toISOString(),
    engineers:     db.prepare('SELECT * FROM engineers').all(),
    entries:       db.prepare('SELECT * FROM entries').all(),
    workday_hours: db.prepare('SELECT * FROM workday_hours').all(),
    users:         db.prepare('SELECT id, username, password, role, name, engineer_id FROM users').all(),
  };
  const filename = `tsm4-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(backup, null, 2));
});

// POST /api/settings/restore  — restore DB from JSON backup
router.post('/restore', auth, adminOnly, (req, res) => {
  const db = getDB();
  const { engineers, entries, workday_hours, users, version } = req.body;

  if (!version || !engineers || !entries || !workday_hours || !users)
    return res.status(400).json({ error: 'Invalid backup file format' });

  try {
    const restore = db.transaction(() => {
      db.prepare('DELETE FROM entries').run();
      db.prepare('DELETE FROM workday_hours').run();
      db.prepare('DELETE FROM engineers').run();
      db.prepare('DELETE FROM users').run();

      for (const e of engineers) {
        db.prepare('INSERT INTO engineers (id, name, sort_order) VALUES (?, ?, ?)').run(e.id, e.name, e.sort_order);
      }
      for (const e of entries) {
        db.prepare('INSERT INTO entries (id, engineer_id, date, activity, hours, wbs) VALUES (?, ?, ?, ?, ?, ?)').run(e.id, e.engineer_id, e.date, e.activity, e.hours, e.wbs);
      }
      for (const w of workday_hours) {
        db.prepare('INSERT INTO workday_hours (date, hours) VALUES (?, ?)').run(w.date, w.hours);
      }
      for (const u of users) {
        db.prepare('INSERT INTO users (id, username, password, role, name, engineer_id) VALUES (?, ?, ?, ?, ?, ?)').run(u.id, u.username, u.password, u.role, u.name, u.engineer_id ?? null);
      }

      // Reset autoincrement sequences
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
