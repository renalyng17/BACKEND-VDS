const authService = require('../Services/auth.service');

module.exports = {
  register: async (req, res) => {
    try {
      const user = await authService.register(req.body);
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
  // Add other controller methhhods...
};