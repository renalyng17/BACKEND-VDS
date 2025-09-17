const authService = require('./services/auth.service');

module.exports = {
  register: async (req, res) => {
    try {
      const user = await authService.register(req.body);
      
      // Set cookie with JWT token
      const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
      });
      // In your login controller (authController.js)

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
  
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.login(email, password);
      
      // Set cookie with JWT token
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      res.json(user);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  },
  
  logout: (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  },
  
  getProfile: async (req, res) => {
    try {
      // Assuming you have auth middleware that sets req.user
      const user = await authService.getProfile(req.user.id);
      res.json(user);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  },
  
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { first_name, last_name, email, contact_no } = req.body;
      
      const updatedUser = await pool.query(
        `UPDATE tbl_users 
         SET first_name = $1, last_name = $2, email = $3, contact_no = $4, updated_at = NOW()
         WHERE user_id = $5 RETURNING *`,
        [first_name, last_name, email, contact_no, userId]
      );
      
      // Don't return password
      const user = updatedUser.rows[0];
      delete user.password;
      
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};