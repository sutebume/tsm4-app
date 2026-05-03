const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tsm4_secret_key_change_in_production';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    engineer_id: user.engineer_id || null,
    must_change_password: user.must_change_password === 1,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: payload });
});

// Middleware: verify JWT
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password  — user changes their own password
router.post('/change-password', auth, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // If must_change_password is set, skip current password check (admin-set password)
  // Otherwise verify current password
  if (!user.must_change_password) {
    if (!current_password) return res.status(400).json({ error: 'Current password required' });
    if (!bcrypt.compareSync(current_password, user.password))
      return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?').run(hash, req.user.id);

  // Issue a fresh token with must_change_password = false
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    engineer_id: user.engineer_id || null,
    must_change_password: false,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  res.json({ success: true, token, user: payload });
});

module.exports = router;
module.exports.auth = auth;
