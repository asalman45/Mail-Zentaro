const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const EmailAccount = require('../models/EmailAccount');
const EmailMessage = require('../models/EmailMessage');
const { authenticate } = require('../middleware/auth');

// ── Multer for attachments ──
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/email-attachments');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// ════════════════════════════════════════════
//  EMAIL ACCOUNTS
// ════════════════════════════════════════════

router.get('/accounts', authenticate, async (req, res) => {
    try {
        const accounts = await EmailAccount.find().sort({ createdAt: -1 });
        res.json({ success: true, data: accounts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/accounts', authenticate, async (req, res) => {
    try {
        const account = new EmailAccount(req.body);
        await account.save();
        res.status(201).json({ success: true, data: account });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/accounts/:id', authenticate, async (req, res) => {
    try {
        const account = await EmailAccount.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: account });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/accounts/:id', authenticate, async (req, res) => {
    try {
        await EmailAccount.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ════════════════════════════════════════════
//  EMAIL MESSAGES
// ════════════════════════════════════════════

router.get('/messages', authenticate, async (req, res) => {
    try {
        const { accountId, folder = 'inbox', search } = req.query;
        let query = {};

        if (accountId) query.accountId = accountId;

        switch (folder) {
            case 'sent':
                query.direction = 'outbound';
                query.status = 'sent';
                break;
            case 'starred':
                query.starred = true;
                query.status = { $ne: 'archived' };
                break;
            case 'archive':
            case 'archived':
                query.status = 'archived';
                break;
            case 'drafts':
                query.status = 'draft';
                break;
            default:
                query.direction = 'inbound';
                query.status = { $ne: 'archived' };
        }

        const limit = parseInt(req.query.limit) || 50;
        const skip = parseInt(req.query.skip) || 0;

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { subject: searchRegex },
                { from: searchRegex },
                { content: searchRegex }
            ];
        }

        const messages = await EmailMessage.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await EmailMessage.countDocuments(query);
        res.json({ success: true, count: messages.length, total, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/messages/:id', authenticate, async (req, res) => {
    try {
        const message = await EmailMessage.findById(req.params.id)
            .populate('accountId', 'email name')
            .lean();
        if (!message) return res.status(404).json({ error: 'Not found' });

        if (message.direction === 'inbound' && message.status === 'received') {
            await EmailMessage.findByIdAndUpdate(req.params.id, { status: 'read', readAt: new Date() });
            message.status = 'read';
        }

        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send email
router.post('/send', authenticate, upload.array('attachments'), async (req, res) => {
    try {
        const { accountId, to, subject, content, cc, bcc } = req.body;
        const files = req.files || [];

        if (!to) return res.status(400).json({ error: 'Recipient required' });

        const account = await EmailAccount.findById(accountId);
        if (!account) return res.status(404).json({ error: 'Email account not found' });

        const transporter = nodemailer.createTransport({
            host: account.smtpConfig.host || process.env.SMTP_HOST || 'smtp-relay.brevo.com',
            port: account.smtpConfig.port || parseInt(process.env.SMTP_PORT) || 587,
            secure: account.smtpConfig.secure || false,
            auth: {
                user: account.smtpConfig.username || process.env.SMTP_USER,
                pass: account.smtpConfig.password || process.env.SMTP_PASSWORD
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 30000
        });

        const mailOptions = {
            from: `"${account.name || 'Zentaro'}" <${account.email}>`,
            to,
            subject,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
                    <div style="margin-bottom: 20px; white-space: pre-wrap;">
                        ${String(content).replace(/\r?\n/g, '<br>')}
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <div style="font-size: 12px; color: #888;">
                        <p><strong>Zentaro</strong><br>
                        <a href="https://zentaro.pk" style="color: #6366f1; text-decoration: none;">zentaro.pk</a></p>
                    </div>
                </div>
            `,
            cc,
            bcc,
            attachments: files.map(f => ({
                filename: f.originalname,
                path: f.path,
                contentType: f.mimetype
            }))
        };

        const info = await transporter.sendMail(mailOptions);

        const sentMsg = await EmailMessage.create({
            accountId: account._id,
            from: account.email,
            to: to.split(',').map(e => e.trim()),
            cc: cc ? String(cc).split(',').map(e => e.trim()) : [],
            bcc: bcc ? String(bcc).split(',').map(e => e.trim()) : [],
            subject,
            content,
            direction: 'outbound',
            status: 'sent',
            sentAt: new Date(),
            messageId: info.messageId,
            attachments: files.map(f => ({
                filename: f.originalname,
                path: `/uploads/email-attachments/${f.filename}`,
                size: f.size
            }))
        });

        res.json({ success: true, data: sentMsg, response: info.response });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Star / Unstar
router.put('/messages/:id/star', authenticate, async (req, res) => {
    try {
        const msg = await EmailMessage.findById(req.params.id);
        if (!msg) return res.status(404).json({ error: 'Not found' });
        msg.starred = !msg.starred;
        await msg.save();
        res.json({ success: true, data: msg });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Archive / Unarchive
router.put('/messages/:id/archive', authenticate, async (req, res) => {
    try {
        const { archived = true } = req.body;
        const msg = await EmailMessage.findById(req.params.id);
        if (!msg) return res.status(404).json({ error: 'Not found' });
        msg.status = archived ? 'archived' : 'received';
        await msg.save();
        res.json({ success: true, data: msg });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete
router.delete('/messages/:id', authenticate, async (req, res) => {
    try {
        await EmailMessage.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stats
router.get('/stats', authenticate, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unread = await EmailMessage.countDocuments({ direction: 'inbound', status: 'received' });
        const totalInbox = await EmailMessage.countDocuments({ direction: 'inbound', status: { $ne: 'archived' } });
        const sentToday = await EmailMessage.countDocuments({
            direction: 'outbound', status: 'sent', sentAt: { $gte: today }
        });
        const totalSent = await EmailMessage.countDocuments({ direction: 'outbound', status: 'sent' });
        const starred = await EmailMessage.countDocuments({ starred: true, status: { $ne: 'archived' } });
        const archived = await EmailMessage.countDocuments({ status: 'archived' });

        res.json({ success: true, unread, totalInbox, sentToday, totalSent, starred, archived });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify SMTP
router.post('/verify-smtp', authenticate, async (req, res) => {
    try {
        const { accountId } = req.body;
        const account = await EmailAccount.findById(accountId);
        if (!account) return res.status(404).json({ error: 'Account not found' });

        const transporter = nodemailer.createTransport({
            host: account.smtpConfig.host || process.env.SMTP_HOST,
            port: account.smtpConfig.port || parseInt(process.env.SMTP_PORT) || 587,
            secure: account.smtpConfig.secure || false,
            auth: {
                user: account.smtpConfig.username || process.env.SMTP_USER,
                pass: account.smtpConfig.password || process.env.SMTP_PASSWORD
            }
        });

        await transporter.verify();
        res.json({ success: true, message: 'SMTP connection verified!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ════════════════════════════════════════════
//  INCOMING WEBHOOK (Cloudflare Worker Target)
// ════════════════════════════════════════════
router.post('/incoming', async (req, res) => {
    try {
        const { secret, from, to, raw } = req.body;

        const WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET || 'ZentaroEmailSecret2026!';
        if (secret !== WEBHOOK_SECRET) {
            console.warn('[Email] Webhook secret mismatch');
            return res.status(403).json({ error: 'Invalid secret' });
        }

        let parsed = {};
        if (raw) {
            try { parsed = await simpleParser(raw); }
            catch (e) { console.error('[Email] Parse error:', e.message); }
        }

        const subjectClean = String(parsed.subject || '(No Subject)').replace(/[\n\r]+/g, ' ').trim();
        const fromRaw = String(parsed.from?.text || from || 'Unknown');
        const fromClean = fromRaw.replace(/"/g, '').trim();
        const html = parsed.html || parsed.text || '';

        // Save attachments
        const savedAttachments = [];
        if (parsed.attachments?.length > 0) {
            const uploadDir = path.join(__dirname, '../uploads/email-attachments');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            for (const att of parsed.attachments) {
                if (att.content) {
                    const safeFilename = `${Date.now()}_${(att.filename || 'attachment').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                    fs.writeFileSync(path.join(uploadDir, safeFilename), att.content);
                    savedAttachments.push({
                        filename: att.filename || 'attachment',
                        size: att.size,
                        path: `/uploads/email-attachments/${safeFilename}`
                    });
                }
            }
        }

        // Find matching account
        const accounts = await EmailAccount.find({ status: 'active' });
        const recipientStr = JSON.stringify(parsed.to || to || '').toLowerCase();
        let matchedAccount = accounts.find(acc => recipientStr.includes(acc.email.toLowerCase())) || accounts[0];

        if (!matchedAccount) {
            return res.status(404).json({ error: 'No active email accounts found' });
        }

        // Auto-archive check
        let initialStatus = 'received';
        const senderEmailMatch = fromClean.match(/<([^>]+)>/);
        const senderEmail = senderEmailMatch ? senderEmailMatch[1].trim().toLowerCase() : fromClean.trim().toLowerCase();
        if (matchedAccount.archivedContacts?.includes(senderEmail)) initialStatus = 'archived';

        // Standardize recipients
        let toRaw = [];
        if (Array.isArray(parsed.to)) toRaw = parsed.to.map(t => t.text || t.address);
        else if (parsed.to && typeof parsed.to === 'object') toRaw = [parsed.to.text || parsed.to.address];
        else toRaw = [to || matchedAccount.email];
        toRaw = toRaw.filter(Boolean);
        if (toRaw.length === 0) toRaw = [matchedAccount.email];

        const message = new EmailMessage({
            accountId: matchedAccount._id,
            from: fromClean,
            to: toRaw,
            subject: subjectClean,
            content: html,
            direction: 'inbound',
            status: initialStatus,
            attachments: savedAttachments
        });

        await message.save();
        console.log(`📧 [Zentaro] Received: "${subjectClean}" from ${fromClean}`);
        res.json({ success: true, message: 'Email stored' });
    } catch (error) {
        console.error('Incoming email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug diagnostic
router.get('/debug/diagnostic', async (req, res) => {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        res.json({
            success: true,
            stats: {
                totalEmails: await EmailMessage.countDocuments(),
                todayEmails: await EmailMessage.countDocuments({ createdAt: { $gte: today } }),
                accounts: await EmailAccount.find().select('email status'),
                latestInbound: await EmailMessage.findOne({ direction: 'inbound' }).sort({ createdAt: -1 }).select('from subject createdAt status'),
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
