// middleware/authenticateUser.js
const authenticateUser = (req, res, next) => {
  // Your authentication logic (e.g., JWT verification)
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Verify token (example using jwt.verify)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authenticateUser;