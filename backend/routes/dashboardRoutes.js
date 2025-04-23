const express = require('express');
const router = express.Router();
const requireAuth = require('./authMiddleware'); 
// Middleware to check authentication
 

// Dashboard Route 
router.get('/dashboard', requireAuth, (req, res) => {
  res.json({ msg: 'Welcome to your dashboard!', user: req.session.user });
});

module.exports = router;
