const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const register = async (userData) => {
  try {
    const { first_name, last_name, email, password, contact_no, user_type, office } = userData;
    
    // Check if user exists
    const userExists = await pool.query('SELECT * FROM tbl_users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      throw new Error('User already exists');
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const newUser = await pool.query(
      `INSERT INTO tbl_users 
       (first_name, last_name, email, password, contact_no, user_type, office)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [first_name, last_name, email, hashedPassword, contact_no, user_type, office]
    );
    
    // Don't return password
    const user = newUser.rows[0];
    delete user.password;
    
    return user;
  } catch (error) {
    throw error;
  }
};

const login = async (email, password) => {
  try {
    // Check for user
    const user = await pool.query('SELECT * FROM tbl_users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      throw new Error('Invalid credentials');
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }
    
    // Generate token
    const token = jwt.sign({ id: user.rows[0].user_id }, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });
    
    // Don't return password
    const userData = user.rows[0];
    delete userData.password;
    
    return { user: userData, token };
  } catch (error) {
    throw error;
  }
};

const getProfile = async (userId) => {
  try {
    const user = await pool.query('SELECT * FROM tbl_users WHERE user_id = $1', [userId]);
    if (user.rows.length === 0) {
      throw new Error('User not found');
    }
    
    // Don't return password
    const userData = user.rows[0];
    delete userData.password;
    
    return userData;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  register,
  login,
  getProfile
};