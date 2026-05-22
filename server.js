require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4500;

// ── Middleware ──
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'https://zentaro.pk',
        'http://localhost:3000',
        'http://localhost:5173',
        /\.zentaro\.pk$/
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for attachments
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── MongoDB Connection ──
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zentaro-email')
    .then(() => console.log('✅ MongoDB connected for Zentaro Email'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ── Routes ──
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/email');

app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Zentaro Email Server',
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Serve admin panel (no-cache for dev)
app.use(express.static(path.join(__dirname, 'public'), { 
    etag: false, 
    maxAge: 0,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }
}));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Zentaro Email Server running on port ${PORT}`);
    console.log(`📧 Admin panel: http://localhost:${PORT}`);
});
