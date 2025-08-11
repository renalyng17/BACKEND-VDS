// In your db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Railway
});

// Simple test query
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Connected to new database'))
  .catch(err => {
    console.error('❌ Connection failed:', err);
    process.exit(1);
  });

module.exports = pool;