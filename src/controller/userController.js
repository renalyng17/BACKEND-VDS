// controllers/userController.js
const pool = require('../db');

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM tbl_users WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    // Don't send password back
    delete user.password;
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, email, contact_no } = req.body;
    
    const result = await pool.query(
      `UPDATE tbl_users 
       SET first_name = $1, last_name = $2, email = $3, contact_no = $4, updated_at = NOW()
       WHERE user_id = $5 RETURNING *`,
      [first_name, last_name, email, contact_no, userId]
    );
    
    const updatedUser = result.rows[0];
    delete updatedUser.password;
    
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile
};