const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Only mount the auth router
try {
  const authRouter = require('./routes/auth');
  console.log("✅ Mounting /api/auth");
  app.use('/api/auth', authRouter);
} catch (err) {
  console.error('❌ Error in authRouter:', err.message);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));