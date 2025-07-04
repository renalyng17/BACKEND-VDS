const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

router.post('/register', async (req, res) => {
  console.log('Registration request received:', req.body);
  
  const { first_name, last_name, email, password, contact_no, user_type, office } = req.body;

  // Validate required fields
  const requiredFields = ['first_name', 'last_name', 'email', 'password', 'contact_no', 'user_type'];
  const missingFields = requiredFields.filter(field => !req.body[field]);

  if (missingFields.length > 0) {
    console.log('Missing fields:', missingFields);
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields',
      missingFields
    });
  }

  try {
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT * FROM tbl_users WHERE email = $1', 
      [email]
    );
    
    if (userCheck.rows.length > 0) {
      console.log('Email already exists:', email);
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    // Insert user with explicit NULL for reset fields
    const newUser = await pool.query(
      `INSERT INTO tbl_users 
       (first_name, last_name, email, password, user_type, office, contact_no, reset_token, reset_token_expires) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING user_id, first_name, last_name, email, user_type, contact_no`,
      [
        first_name, 
        last_name, 
        email, 
        hashedPassword, 
        user_type, 
        office || null, 
        contact_no,
        null, // reset_token
        null  // reset_token_expires
      ]
    );

    console.log('User created successfully:', newUser.rows[0]);
    return res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      user: newUser.rows[0]
    });

  } catch (err) {
    console.error('DATABASE ERROR:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      code: err.code
    });
  }
});

module.exports = router;