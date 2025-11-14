// routes/profile.js
const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");

const router = express.Router();

// ============================
//      UPDATE PROFILE ROUTE
// ============================
router.patch('/profile', async (req, res) => {
  try {
    // Get token from cookie or header
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Destructure allowed fields (avoid updating user_id, user_type, etc. for security)
    const { first_name, last_name, email, contact_no, office } = req.body;

    // Validate: at least one field is provided
    if (!first_name && !last_name && !email && !contact_no && !office) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Optional: validate email format if provided
    // You can add more validation as needed

    // Build dynamic query to update only provided fields
    const fields = [];
    const values = [];
    let index = 1;

    if (first_name !== undefined) {
      fields.push(`first_name = $${index++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      fields.push(`last_name = $${index++}`);
      values.push(last_name);
    }
    if (email !== undefined) {
      // Optional: check if email is already taken by another user
      fields.push(`email = $${index++}`);
      values.push(email);
    }
    if (contact_no !== undefined) {
      fields.push(`contact_no = $${index++}`);
      values.push(contact_no);
    }
    if (office !== undefined) {
      fields.push(`office = $${index++}`);
      values.push(office);
    }

    // Add user_id at the end for WHERE clause
    values.push(userId);

    const query = `
      UPDATE tbl_users
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE user_id = $${index}
      RETURNING user_id, first_name, last_name, email, contact_no, user_type, office;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});