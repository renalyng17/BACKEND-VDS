const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  try {
    // Check token from cookies or Authorization header
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('🚫 No token found in request');
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user info to req.user
    req.user = {
      id: decoded.userId || decoded.id, // support both keys
      email: decoded.email,
      userType: decoded.userType
    };

    console.log('✅ Authenticated user:', req.user);
    next();

  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { protect };
