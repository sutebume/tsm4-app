const express = require('express');
const { getDB } = require('../db');
const { auth } = require('./auth');

const router = express.Router();

// Write ownership check: engineers can only write their own entries
function canWriteEngineer(req, res, engineerId) {
  if (req.user.role === 'engineer') {
    if (!req.user.engineer_id || parseInt(engineerId) !== req.user.engineer_id) {
      res.status(403).json({ error: 'Access denied: you can only edit your own entries' });
      return false;
    }
  }
  return true;
}

// Read ownership check: engineers can only read their own detail entries
// (but can see summary totals for Team tab via /all)
function canReadEngineer(req, res, engineerId) {
  if (req.user.role === 'engineer') {
    if (!req.user.engineer_id || parseInt(engineerId) !== req.user.engineer_id) {
      res.status(403).json({ error: 'Access denied: you can only view your own entries' });
      return false;
    }
  }
  return true;
}

// GET /api/entries/all
// Returns all entries for all engineers — any authenticated user can read
// (engineers see Team tab progress, but can't open others' calendar days)
router.get('/all', auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare(
    'SELECT * FROM entries ORDER BY engineer_id, date ASC, id ASC'
  ).all();
  res.json(rows);
});

// GET /api/entries/:engineerId/:date — detail view (owner or admin only)
router.get('/:engineerId/:date', auth, (req, res) => {
  if (!canReadEngineer(req, res, req.params.engineerId)) return;
  const db = getDB();
  const rows = db.prepare(
    'SELECT * FROM entries WHERE engineer_id = ? AND date = ? ORDER BY id ASC'
  ).all(req.params.engineerId, req.params.date);
  res.json(rows);
});

// GET /api/entries/:engineerId — all entries for one engineer (owner or admin only)
router.get('/:engineerId', auth, (req, res) => {
  if (!canReadEngineer(req, res, req.params.engineerId)) return;
  const db = getDB();
  const rows = db.prepare(
    'SELECT * FROM entries WHERE engineer_id = ? ORDER BY date ASC, id ASC'
  ).all(req.params.engineerId);
  res.json(rows);
});

// POST /api/entries/:engineerId/:date — write (owner or admin only)
router.post('/:engineerId/:date', auth, (req, res) => {
  if (!canWriteEngineer(req, res, req.params.engineerId)) return;
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
