const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateUser = require('../middleware/authenticateUser');

// Get profile data
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      `SELECT 
        user_id,
        first_name,
        last_name,
        email,
        contact_no,
        user_type,
        office
       FROM tbl_users 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userProfile = result.rows[0];
    res.status(200).json(userProfile);

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/profile', authenticateUser, async (req, res) => {
  const userId = req.user.userId;
  const { first_name, last_name, email, contact_no } = req.body;

  try {
    // Validate input
    if (!first_name || !last_name || !email || !contact_no) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if email is being changed to one that already exists
    const emailCheck = await pool.query(
      `SELECT user_id FROM tbl_users 
       WHERE email = $1 AND user_id != $2`,
      [email, userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Update profile
    const result = await pool.query(
      `UPDATE tbl_users 
       SET 
         first_name = $1,
         last_name = $2,
         email = $3,
         contact_no = $4,
         updated_at = NOW()
       WHERE user_id = $5
       RETURNING 
         first_name,
         last_name,
         email,
         contact_no,
         user_type,
         office`,
      [first_name, last_name, email, contact_no, userId]
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;