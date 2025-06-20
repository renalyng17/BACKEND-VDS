require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Correct relative path
const authRoutes = require('./routes/auth.routes');

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
