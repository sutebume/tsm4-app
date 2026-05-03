const express = require('express');
const { getDB } = require('../db');
const { auth } = require('./auth');

const router = express.Router();

// Ownership check: engineers can only access their own engineer_id
function canAccessEngineer(req, res, engineerId) {
  if (req.user.role === 'engineer') {
    if (!req.user.engineer_id || parseInt(engineerId) !== req.user.engineer_id) {
      res.status(403).json({ error: 'Access denied: you can only view your own entries' });
      return false;
    }
  }
  return true;
}

// GET /api/entries/:engineerId/:date
router.get('/:engineerId/:date', auth, (req, res) => {
  if (!canAccessEngineer(req, res, req.params.engineerId)) return;
  const db = getDB();
  const rows = db.prepare(
    'SELECT * FROM entries WHERE engineer_id = ? AND date = ? ORDER BY id ASC'
  ).all(req.params.engineerId, req.params.date);
  res.json(rows);
});

// GET /api/entries/:engineerId  (all entries for engineer)
router.get('/:engineerId', auth, (req, res) => {
  if (!canAccessEngineer(req, res, req.params.engineerId)) return;
  const db = getDB();
  const rows = db.prepare(
    'SELECT * FROM entries WHERE engineer_id = ? ORDER BY date ASC, id ASC'
  ).all(req.params.engineerId);
  res.json(rows);
});

// POST /api/entries/:engineerId/:date  (replace all entries for a date)
router.post('/:engineerId/:date', auth, (req, res) => {
  if (!canAccessEngineer(req, res, req.params.engineerId)) return;
  const db = getDB();
  const { entries } = req.body;
  const { engineerId, date } = req.params;

  const deleteStmt = db.prepare('DELETE FROM entries WHERE engineer_id = ? AND date = ?');
  const insertStmt = db.prepare(
    'INSERT INTO entries (engineer_id, date, activity, hours, wbs) VALUES (?, ?, ?, ?, ?)'
  );

  const saveAll = db.transaction(() => {
    deleteStmt.run(engineerId, date);
    for (const e of entries) {
      insertStmt.run(engineerId, date, e.activity, parseFloat(e.hours) || 0, e.wbs);
    }
  });

  saveAll();
  res.json({ success: true });
});

module.exports = router;
