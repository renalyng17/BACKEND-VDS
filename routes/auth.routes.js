// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, userType } = req.body;

  try {
    // Check if user already exists
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    await pool.query(
      `INSERT INTO users (first_name, last_name, email, password, user_type) VALUES ($1, $2, $3, $4, $5)`,
      [firstName, lastName, email, hashedPassword, userType]
    );

    res.status(201).json({ message: "Registration successful" });
  } catch (error) {
    console.error("❌ Registration Error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

module.exports = router;
