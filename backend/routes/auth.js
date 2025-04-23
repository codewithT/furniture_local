const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('../config/db');
require('dotenv').config();

const router = express.Router();
 

// Register User
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    connection = await db.promise().getConnection();
    const [results] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ msg: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Login User (Creates a Session)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    connection = await db.promise().getConnection();
    const [results] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) return res.status(400).json({ msg: 'Invalid credentials' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Store minimal user data in session
    req.session.user = { id: user.id, email: user.email };
    
    req.session.save((err) => {
      console.log('📦 Session After Save:', req.session);
      if (err) {
        
        console.error('Session save error:', err);
        return res.status(500).json({ msg: 'Session error' });
      }
      res.json({ 
        
        msg: 'Logged in successfully', 
        user: { id: user.id, email: user.email } 
      });
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ msg: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Logout User (Destroys Session)
router.post('/logout', (req, res) => {
  // Check if session exists but don't return error if it doesn't
  if (!req.session) {
    return res.json({ msg: 'Logged out successfully' });
  }
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ msg: 'Logout failed' });
    }
    
    // Clear the cookie properly
    res.clearCookie('connect.sid', { 
      path: '/',  // Make sure this matches where the cookie was set
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    res.json({ msg: 'Logged out successfully' });
  });
});
// Check Authentication Status
router.get('/is-authenticated', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ isAuthenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ isAuthenticated: false });
  }
});

// Protected Route
router.get('/protected', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }
  res.json({ msg: 'You accessed a protected route!', user: req.session.user });
});

module.exports = router;