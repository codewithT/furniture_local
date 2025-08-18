const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
// Removed moment.js - using native Date for UTC handling
const router = express.Router();
const pool = require('../../config/db'); // Your DB connection pool
 const nodemailer = require('nodemailer');

require('dotenv').config(); // Load environment variables
 const transporter = nodemailer.createTransport({
     service: "gmail",
     auth: {
         user: process.env.USER_GMAIL,
         pass: process.env.USER_PASSWORD,
     },
 });
// POST /auth/forgot-password
router.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const findUserQuery = 'SELECT * FROM users WHERE email = ?';

    pool.query(findUserQuery, [email], (err, users) => {
        if (err) return res.status(500).json({ message: 'Server error' });

        if (users.length === 0) {
            return res.status(200).json({ message: 'If the email is registered, a reset link will be sent.' }); // don't leak info
        }

        const token = uuidv4();
        // Token expires in 1 hour (store as timestamp in milliseconds)
        const expiresAt = Date.now() + (60 * 60 * 1000); // expires in 1 hour

        const insertTokenQuery = `
            INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)
        `;

        pool.query(insertTokenQuery, [email, token, expiresAt], (err) => {
            if (err) return res.status(500).json({ message: 'Error saving reset token' });

            const resetLink = `${process.env.BASE_URL}/auth/reset-password/${token}`;
            const mailOptions = {
                from: process.env.USER_GMAIL,
                to: email,
                subject: 'Password Reset Request',
                html: `
                    <p>You requested a password reset.</p>
                    <p><a href="${resetLink}">Click here to reset your password</a></p>
                    <p>This link will expire in 1 hour.</p>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Email error:', error);
                    return res.status(500).json({ message: 'Failed to send email' });
                }
                return res.status(200).json({ message: 'Reset link sent' });
            });
        });
    });
});

// POST /auth/reset-password
// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    console.log('Reset password request:', { token, newPassword });
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and password are required' });
    }

    const getTokenQuery = 'SELECT * FROM password_resets WHERE token = ?';

    pool.query(getTokenQuery, [token], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Server error' });

        if (results.length === 0 || results[0].expires_at < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const email = results[0].email;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updatePasswordQuery = 'UPDATE users SET password = ? WHERE email = ?';
        const deleteTokenQuery = 'DELETE FROM password_resets WHERE email = ?';

        pool.query(updatePasswordQuery, [hashedPassword, email], (err) => {
            if (err) return res.status(500).json({ message: 'Failed to update password' });

            pool.query(deleteTokenQuery, [email], () => {
                return res.status(200).json({ message: 'Password has been reset successfully' });
            });
        });
    });
});


module.exports = router;
