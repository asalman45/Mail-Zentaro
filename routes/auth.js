const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'zentaro-email-secret-2026';

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        let user = await User.findOne({ email: email.toLowerCase() });

        // Auto-create admin on first login if no users exist
        if (!user) {
            const userCount = await User.countDocuments();
            if (userCount === 0) {
                user = new User({
                    email: email.toLowerCase(),
                    password: password,
                    name: 'Admin',
                    role: 'admin'
                });
                await user.save();
                console.log(`✅ Created first admin: ${email}`);
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: { id: user._id, email: user.email, name: user.name, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify token
router.get('/verify', authenticate, (req, res) => {
    res.json({ success: true, user: req.user });
});

module.exports = router;
