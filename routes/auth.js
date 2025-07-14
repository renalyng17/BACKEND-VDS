const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { registerValidation, loginValidation } = require('../validators/authValidators');

// ============================
//        REGISTER ROUTE
// ============================
router.post('/register', registerValidation, async (req, res) => {
  console.log('DEBUG: Incoming request to /register');
  console.log('DEBUG: Request body:', req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('DEBUG: Validation errors:', errors.array());
    return res.status(400).json({ 
      status: 'error',
      errors: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }

  const { first_name, last_name, email, password, contact_no, user_type, office } = req.body;

  try {
    const userCheck = await pool.query(
      'SELECT 1 FROM tbl_users WHERE LOWER(email) = LOWER($1)', 
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO tbl_users 
       (first_name, last_name, email, password, user_type, contact_no, office) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING user_id, first_name, last_name, email, user_type, contact_no, office`,
      [first_name, last_name, email, hashedPassword, user_type, contact_no, office || null]
    );

    const token = jwt.sign(
      {
        userId: newUser.rows[0].user_id,
        userType: newUser.rows[0].user_type,
        email: newUser.rows[0].email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      token,
      user: newUser.rows[0]
    });

  } catch (err) {
    console.error('❌ Registration error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      code: 'REGISTRATION_FAILED',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ============================
//         LOGIN ROUTE
// ============================
router.post('/login', loginValidation, async (req, res) => {
  console.log("📥 Login Request Body:", req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      status: 'error',
      errors: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }

  const { email, password } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT * FROM tbl_users WHERE LOWER(email) = LOWER($1)', 
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        userType: user.user_type,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.password;

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      user
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    return res.status(500).json( {
      status: 'error',
      message: 'Login failed',
      code: 'LOGIN_FAILED',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
