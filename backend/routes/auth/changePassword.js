const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const router = express.Router();
const pool = require('../../config/db');
const requireAuth = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new password are required' });
  }

  const userID = req.session.user.id;

  pool.query('SELECT password FROM users WHERE id = ?', [userID], async (err, results) => {
    if (err || results.length === 0) return res.status(500).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, results[0].password);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userID], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update password' });

      return res.status(200).json({ message: 'Password updated successfully' });
    });
  });
});

module.exports = router;
