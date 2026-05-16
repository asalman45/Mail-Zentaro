const mongoose = require('mongoose');

const emailMessageSchema = new mongoose.Schema({
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZentaroEmailAccount', required: true },
    from: { type: String, required: true },
    to: [{ type: String, required: true }],
    cc: [String],
    bcc: [String],
    subject: { type: String, required: true },
    content: String,
    attachments: [{
        filename: String,
        path: String,
        size: Number
    }],
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    status: { type: String, enum: ['draft', 'sent', 'failed', 'received', 'read', 'archived'], default: 'draft' },
    starred: { type: Boolean, default: false },
    messageId: String,
    threadId: String,
    readAt: Date,
    sentAt: Date,
    tags: [String]
}, { timestamps: true });

emailMessageSchema.index({ accountId: 1, direction: 1, status: 1 });
emailMessageSchema.index({ direction: 1, status: 1, createdAt: -1 });
emailMessageSchema.index({ createdAt: -1 });
emailMessageSchema.index({ subject: 'text', content: 'text', from: 'text' });

module.exports = mongoose.model('ZentaroEmailMessage', emailMessageSchema);
