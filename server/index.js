require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const entriesRoutes = require('./routes/entries');
const settingsRoutes = require('./routes/settings');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Global JSON error handler — ensures all errors return { error: message } JSON
// instead of Express's default HTML error page
app.use((err, req, res, next) => {
  console.error('[TSM4 Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

initDB();

app.listen(PORT, () => {
  console.log(`TSM4 server running on http://localhost:${PORT}`);
});
