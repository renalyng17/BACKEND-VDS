const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = require('./db');
pool.query('SELECT NOW()', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Database connected');
});

// Routes - make sure this path is correct
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});