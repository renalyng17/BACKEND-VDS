const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_host,
  port: process.env.DB_port,
  user: process.env.DB_user,
  password: process.env.DB_password,
  database: process.env.DB_database,
  ssl: { rejectUnauthorized: false },
  timezone: 'Asia/Manila'
});

// Test connection immediately
pool.connect()
  .then(client => {
    console.log('✅ Successfully connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('❌ DATABASE CONNECTION ERROR:', err);
    process.exit(1); // Exit if we can't connect to DB
  });

module.exports = pool;