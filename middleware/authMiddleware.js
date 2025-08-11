const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  // Check both cookies and Authorization header
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    console.log('No token found in request');
    return res.status(401).json({ message: 'Not authorized' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    console.log('Authenticated user:', decoded.id);
    req.user = decoded;
    next();
  });
};

module.exports = { protect };