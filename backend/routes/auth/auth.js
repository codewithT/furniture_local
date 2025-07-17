const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('../../config/db');
require('dotenv').config();

const router = express.Router();

// REGISTER USER
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    connection = await db.promise().getConnection();

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.query(
      'INSERT INTO users (email, password, isActive) VALUES (?, ?, 1)',
      [email, hashedPassword]
    );

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ msg: 'Server error during registration' });
  } finally {
    if (connection) connection.release();
  }
});

// LOGIN USER + STORE SESSION
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    connection = await db.promise().getConnection();

    const [users] = await connection.query('SELECT * FROM users WHERE email = ? AND isActive = 1', [email]);
    if (users.length === 0) return res.status(400).json({ msg: 'Invalid credentials' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Fetch user roles
    const [roles] = await connection.query(`
      SELECT r.name FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);

    const roleNames = roles.map(r => r.name);

    // Save minimal user info + roles in session
    req.session.user = {
      id: user.id,
      email: user.email,
      roles: roleNames
    };

    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ msg: 'Session error' });
      }

      res.json({
        msg: 'Logged in successfully',
        user: req.session.user
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error during login' });
  } finally {
    if (connection) connection.release();
  }
});

// LOGOUT USER + CLEAR COOKIE
router.post('/logout', (req, res) => {
  if (!req.session) {
    res.clearCookie('connect.sid');
    return res.json({ msg: 'Logged out successfully' });
  }

  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ msg: 'Logout failed' });
    }

    res.clearCookie('connect.sid');
    res.json({ msg: 'Logged out successfully' });
  });
});

// CHECK AUTHENTICATION STATUS
router.get('/is-authenticated', async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ isAuthenticated: false });
  }

  try {
    const user = req.session.user;

    // Re-fetch roles in case they're updated after login
    const [roles] = await db.promise().query(`
      SELECT r.name FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);

    const roleNames = roles.map(r => r.name);
    const updatedUser = { ...user, roles: roleNames };

    req.session.user = updatedUser; // Refresh session user with updated roles

    res.json({ isAuthenticated: true, user: updatedUser });
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ isAuthenticated: false, msg: 'Server error during auth check' });
  }
});

// PROTECTED ROUTE EXAMPLE
router.get('/protected', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  res.json({ msg: 'You accessed a protected route!', user: req.session.user });
});

module.exports = router;
