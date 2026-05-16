const mongoose = require('mongoose');

const emailAccountSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    forwardTo: { type: String },
    smtpConfig: {
        host: { type: String, default: 'smtp-relay.brevo.com' },
        port: { type: Number, default: 587 },
        username: String,
        password: String,
        secure: { type: Boolean, default: false }
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    signature: String,
    archivedContacts: [String]
}, { timestamps: true });

module.exports = mongoose.model('ZentaroEmailAccount', emailAccountSchema);
