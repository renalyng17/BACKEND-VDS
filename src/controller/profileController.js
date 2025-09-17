// controllers/profileController.js
const pool = require('../../db');


module.exports = {
  getProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await pool.query(
        'SELECT user_id, first_name, last_name, email, contact_no, user_type FROM tbl_users WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { first_name, last_name, email, contact_no } = req.body;
      
      const result = await pool.query(
        `UPDATE tbl_users 
         SET first_name = $1, last_name = $2, email = $3, contact_no = $4
         WHERE user_id = $5
         RETURNING user_id, first_name, last_name, email, contact_no, user_type`,
        [first_name, last_name, email, contact_no, userId]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};