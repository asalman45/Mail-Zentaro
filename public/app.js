// ═══════════════════════════════════════════
//  ZENTARO MAIL - Admin Panel JavaScript
// ═══════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
let token = localStorage.getItem('zentaro_token');
let currentFolder = 'inbox';
let currentMessageId = null;
let accounts = [];
let searchTimer = null;

// ── AUTH ──
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    errEl.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        token = data.token;
        localStorage.setItem('zentaro_token', token);
        showApp();
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
});

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'grid';
    loadAccounts();
    loadFolder('inbox');
    loadStats();
    // Poll for new emails every 30s
    setInterval(() => { loadStats(); if (currentFolder === 'inbox') loadMessages(); }, 30000);
}

function logout() {
    localStorage.removeItem('zentaro_token');
    token = null;
    location.reload();
}

// Check token on load
if (token) {
    fetch(`${API_BASE}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (r.ok) showApp(); else { localStorage.removeItem('zentaro_token'); token = null; } })
        .catch(() => {});
}

// ── API HELPER ──
async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ── ACCOUNTS ──
async function loadAccounts() {
    try {
        const data = await api('/email/accounts');
        accounts = data.data || [];
        renderAccounts();
        populateComposeFrom();
    } catch (e) { console.error('Load accounts:', e); }
}

function renderAccounts() {
    const el = document.getElementById('accountsList');
    if (accounts.length === 0) {
        el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:4px 0">No accounts yet</p>';
        return;
    }
    el.innerHTML = accounts.map(a => `
        <div class="account-item">
            <span class="dot" style="background:${a.status === 'active' ? 'var(--success)' : 'var(--text-muted)'}"></span>
            <span style="overflow:hidden;text-overflow:ellipsis">${a.email}</span>
        </div>
    `).join('');
}

function populateComposeFrom() {
    const sel = document.getElementById('composeFrom');
    sel.innerHTML = accounts.map(a => `<option value="${a._id}">${a.name} &lt;${a.email}&gt;</option>`).join('');
}

function openAccountModal() {
    document.getElementById('accountModal').style.display = 'flex';
    document.getElementById('accountModalTitle').textContent = 'Add Email Account';
    document.getElementById('accountForm').reset();
    document.getElementById('accSmtpHost').value = 'smtp-relay.brevo.com';
    document.getElementById('accSmtpPort').value = '587';
}

function closeAccountModal() { document.getElementById('accountModal').style.display = 'none'; }

async function saveAccount(e) {
    e.preventDefault();
    try {
        await api('/email/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('accEmail').value,
                name: document.getElementById('accName').value,
                smtpConfig: {
                    host: document.getElementById('accSmtpHost').value,
                    port: parseInt(document.getElementById('accSmtpPort').value),
                    username: document.getElementById('accSmtpUser').value,
                    password: document.getElementById('accSmtpPass').value,
                    secure: false
                }
            })
        });
        closeAccountModal();
        loadAccounts();
        showToast('Account added!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

// ── FOLDERS & MESSAGES ──
function loadFolder(folder, navEl) {
    currentFolder = folder;
    currentMessageId = null;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navEl) navEl.classList.add('active');
    else document.querySelector(`.nav-item[data-folder="${folder}"]`)?.classList.add('active');

    // Update title
    const titles = { inbox: 'Inbox', sent: 'Sent', starred: 'Starred', archive: 'Archive', drafts: 'Drafts' };
    document.getElementById('folderTitle').textContent = titles[folder] || folder;

    // Reset detail
    document.getElementById('detailPanel').innerHTML = `
        <div class="detail-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            <p>Select an email to read</p>
        </div>`;

    loadMessages();
}

async function loadMessages() {
    const search = document.getElementById('searchInput').value;
    try {
        const params = new URLSearchParams({ folder: currentFolder });
        if (search) params.set('search', search);
        const data = await api(`/email/messages?${params}`);
        renderEmailList(data.data || []);
    } catch (e) { console.error('Load messages:', e); }
}

function renderEmailList(messages) {
    const el = document.getElementById('emailList');
    if (messages.length === 0) {
        el.innerHTML = `<div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 12h-6l-2 3H10l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
            <p>No emails in this folder</p>
        </div>`;
        return;
    }
    el.innerHTML = messages.map(m => {
        const isUnread = m.status === 'received';
        const fromDisplay = extractName(currentFolder === 'sent' ? (m.to?.[0] || '') : m.from);
        const date = formatDate(m.createdAt);
        const preview = stripHtml(m.content || '').substring(0, 80);
        return `
        <div class="email-item ${isUnread ? 'unread' : ''} ${m._id === currentMessageId ? 'active' : ''}" onclick="openMessage('${m._id}')">
            <div class="email-meta">
                <span class="email-from">${escapeHtml(fromDisplay)}</span>
                <span class="email-time">${date}</span>
            </div>
            <span class="email-subject">${escapeHtml(m.subject || '(No Subject)')}</span>
            <span class="email-preview">${escapeHtml(preview)}</span>
        </div>`;
    }).join('');
}

async function openMessage(id) {
    currentMessageId = id;
    try {
        const data = await api(`/email/messages/${id}`);
        const m = data.data;
        const fromName = extractName(m.from);
        const fromEmail = extractEmail(m.from);
        const initial = fromName.charAt(0).toUpperCase();

        let attachmentsHtml = '';
        if (m.attachments?.length > 0) {
            attachmentsHtml = `<div class="detail-attachments"><h4>Attachments (${m.attachments.length})</h4>
                ${m.attachments.map(a => `<a href="${a.path}" target="_blank" class="attachment-item">📎 ${escapeHtml(a.filename)}</a>`).join('')}
            </div>`;
        }

        document.getElementById('detailPanel').innerHTML = `
            <div class="detail-header">
                <div class="detail-subject">${escapeHtml(m.subject || '(No Subject)')}</div>
                <div class="detail-meta">
                    <div class="detail-avatar">${initial}</div>
                    <div class="detail-sender">
                        <div class="detail-sender-name">${escapeHtml(fromName)}</div>
                        <div class="detail-sender-email">to ${(m.to || []).join(', ')}</div>
                    </div>
                    <div class="detail-date">${formatDateFull(m.createdAt)}</div>
                </div>
                <div class="detail-actions">
                    <button onclick="replyTo('${escapeHtml(m.from)}','${escapeHtml(m.subject)}')">↩ Reply</button>
                    <button onclick="toggleStar('${m._id}')">⭐ Star</button>
                    <button onclick="archiveMessage('${m._id}', ${m.status !== 'archived'})">${m.status === 'archived' ? '📥 Unarchive' : '📦 Archive'}</button>
                    <button onclick="deleteMessage('${m._id}')" style="color:var(--danger)">🗑 Delete</button>
                </div>
            </div>
            <div class="detail-body">${m.content || '<p style="color:var(--text-muted)">(No content)</p>'}</div>
            ${attachmentsHtml}`;

        // Update list active state
        document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
        // Re-highlight
        loadMessages();
        loadStats();
    } catch (e) { showToast(e.message, 'error'); }
}

// ── COMPOSE ──
function openCompose() {
    if (accounts.length === 0) { showToast('Add an email account first', 'error'); return; }
    document.getElementById('composeModal').style.display = 'flex';
    document.getElementById('composeForm').reset();
    populateComposeFrom();
}
function closeCompose() { document.getElementById('composeModal').style.display = 'none'; }

function replyTo(from, subject) {
    openCompose();
    const email = extractEmail(from);
    document.getElementById('composeTo').value = email;
    document.getElementById('composeSubject').value = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
}

async function sendEmail(e) {
    e.preventDefault();
    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sending...';

    try {
        const formData = new FormData();
        formData.append('accountId', document.getElementById('composeFrom').value);
        formData.append('to', document.getElementById('composeTo').value);
        formData.append('subject', document.getElementById('composeSubject').value);
        formData.append('content', document.getElementById('composeContent').value);

        const res = await fetch(`${API_BASE}/email/send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Send failed');

        closeCompose();
        showToast('Email sent!', 'success');
        if (currentFolder === 'sent') loadMessages();
        loadStats();
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send'; }
}

// ── ACTIONS ──
async function toggleStar(id) {
    try { await api(`/email/messages/${id}/star`, { method: 'PUT' }); loadMessages(); showToast('Updated', 'info'); }
    catch (e) { showToast(e.message, 'error'); }
}
async function archiveMessage(id, archive) {
    try {
        await api(`/email/messages/${id}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: archive }) });
        loadMessages(); showToast(archive ? 'Archived' : 'Moved to inbox', 'info');
        document.getElementById('detailPanel').innerHTML = '<div class="detail-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg><p>Select an email</p></div>';
    } catch (e) { showToast(e.message, 'error'); }
}
async function deleteMessage(id) {
    if (!confirm('Delete this email permanently?')) return;
    try {
        await api(`/email/messages/${id}`, { method: 'DELETE' });
        loadMessages(); showToast('Deleted', 'info');
        document.getElementById('detailPanel').innerHTML = '<div class="detail-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg><p>Select an email</p></div>';
    } catch (e) { showToast(e.message, 'error'); }
}

// ── STATS ──
async function loadStats() {
    try {
        const data = await api('/email/stats');
        const badge = document.getElementById('unreadBadge');
        if (data.unread > 0) { badge.textContent = data.unread; badge.style.display = 'inline'; }
        else { badge.style.display = 'none'; }
    } catch (e) {}
}

// ── SEARCH ──
function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadMessages, 400);
}

// ── UTILITIES ──
function extractName(str) {
    if (!str) return 'Unknown';
    const match = str.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : str.split('@')[0];
}
function extractEmail(str) {
    if (!str) return '';
    const match = str.match(/<([^>]+)>/);
    return match ? match[1] : str;
}
function stripHtml(html) { const div = document.createElement('div'); div.innerHTML = html; return div.textContent || ''; }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function formatDate(d) {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (now - date < 7 * 86400000) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatDateFull(d) { return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    setTimeout(() => { el.classList.remove('show'); }, 3000);
}
