// db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect()
  .then(client => {
    console.log(' Successfully connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error(' DATABASE CONNECTION ERROR:', err);
    process.exit(1);
  });

module.exports = pool;