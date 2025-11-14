// routes/auth.js - COMPLETE FIXED VERSION
const express = require("express");
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { registerValidation, loginValidation } = require("../validators/authValidators");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const router = express.Router();

// Email transporter configuration - FIXED: createTransport (not createTransporter)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ============================
//     FORGOT PASSWORD ROUTE
// ============================
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // 1. Find user by email
    const user = await pool.query(
      'SELECT * FROM tbl_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (user.rows.length === 0) {
      return res.status(200).json({ 
        message: 'If this email exists, password has been reset' 
      });
    }

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 3. Update password in database
    await pool.query(
      'UPDATE tbl_users SET password = $1 WHERE user_id = $2',
      [hashedPassword, user.rows[0].user_id]
    );

    res.status(200).json({ 
      message: 'Password has been reset successfully' 
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      message: 'Failed to reset password' 
    });
  }
});

// ============================
//        REGISTER ROUTE
// ============================
router.post('/register', async (req, res) => {
  const { first_name, last_name, email, password, contact_no, user_type, office } = req.body;

  try {
    // Check if email exists
    const emailCheck = await pool.query(
      'SELECT 1 FROM tbl_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await pool.query(
      `INSERT INTO tbl_users (
        first_name,
        last_name,
        email,
        password,
        contact_no,
        user_type,
        office
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        user_id,
        first_name,
        last_name,
        email,
        contact_no,
        user_type,
        office`,
      [first_name, last_name, email.toLowerCase(), hashedPassword, contact_no, user_type, office || null]
    );

    // Generate token
    const token = jwt.sign(
      { 
        userId: newUser.rows[0].user_id,
        userType: newUser.rows[0].user_type,
        email: newUser.rows[0].email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: newUser.rows[0],
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed', error: error.message });
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

    // Remove password from user object
    delete user.password;

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      user
    });

  } catch (err) {
    console.error(' Login error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Login failed',
      code: 'LOGIN_FAILED',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ============================
//         LOGOUT ROUTE
// ============================
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;