// ══════════════════════════════════════════════════════════════════
//  ZENTARO MAIL - Official Mail Workspace Application Logic
// ══════════════════════════════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
const ACCOUNT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

// ── Application State ──
let token = localStorage.getItem('zentaro_token');
let currentFolder = 'inbox';
let currentAccountId = null;
let currentFilter = 'all'; // 'all' | 'unread' | 'starred' | 'attachments'
let currentMessageId = null;
let selectedMessages = new Set();
let messages = [];
let accounts = [];
let page = 1;
const pageSize = 50;
let totalMessages = 0;
let mailboxStats = { unread: 0, sent: 0, drafts: 0, starred: 0, trash: 0, archive: 0 };
let accountUnreadMap = {};
let searchTimer = null;
let composeFiles = [];
let inlineReplyFiles = [];

// ════════════════════════════════════════════
//  AUTHENTICATION & SESSION
// ════════════════════════════════════════════

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('loginBtn');
        const errEl = document.getElementById('loginError');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> <span>Signing in...</span>';
        errEl.textContent = '';

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('loginEmail').value.trim(),
                    password: document.getElementById('loginPassword').value
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid credentials');

            token = data.token;
            localStorage.setItem('zentaro_token', token);
            if (data.user && data.user.name) {
                document.getElementById('userName').textContent = data.user.name;
                document.getElementById('userAvatar').textContent = data.user.name.charAt(0).toUpperCase();
            }
            showApp();
            showToast('Welcome to Zentaro Mail', 'success');
        } catch (err) {
            errEl.textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In to Mail</span>';
        }
    });
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    loadAccounts();
    loadFolder('inbox');
    loadStats();

    // Auto-poll mailbox every 30s
    setInterval(() => {
        loadStats();
        if (currentFolder === 'inbox' && !document.getElementById('searchInput').value.trim()) {
            fetchMessages(page);
        }
    }, 30000);
}

function logout() {
    localStorage.removeItem('zentaro_token');
    token = null;
    location.reload();
}

// Initial token verification
if (token) {
    fetch(`${API_BASE}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
            if (r.ok) {
                showApp();
            } else {
                localStorage.removeItem('zentaro_token');
                token = null;
            }
        })
        .catch(() => {});
}

// Universal API wrapper
async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        logout();
        throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server request failed');
    return data;
}

// ════════════════════════════════════════════
//  TEXT PARSING & CLEANUP (Outlook Snippet Fix)
// ════════════════════════════════════════════

/**
 * Strips HTML, removes HTML comments, script tags, style tags, and meta definitions
 * completely preventing Outlook/Word font definitions and CSS preview bugs.
 */
function stripHtmlToText(html) {
    if (!html) return "";
    try {
        // Strip HTML comments first
        let clean = html.replace(/<!--[\s\S]*?-->/g, '');
        const tmp = document.createElement("div");
        tmp.innerHTML = clean;
        const removeTags = tmp.querySelectorAll("style, script, meta, link, noscript");
        removeTags.forEach(el => el.remove());
        const text = tmp.textContent || tmp.innerText || "";
        return text.replace(/\r\n/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
        return html.replace(/<[^>]*>/g, '').trim();
    }
}

function getSnippet(html) {
    const text = stripHtmlToText(html);
    return text.substring(0, 95);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function extractName(str) {
    if (!str) return 'Unknown';
    const match = str.match(/^"?([^"<]+)"?\s*(?:<.+>)?$/);
    if (match && match[1]) return match[1].trim();
    return str.split('<')[0].replace(/"/g, '').trim() || str;
}

function extractEmail(str) {
    if (!str) return '';
    const match = str.match(/<([^>]+)>/);
    return match ? match[1].trim() : str.trim();
}

function formatDate(d) {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (now - date < 7 * 86400000) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    if (now.getFullYear() === date.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function formatDateFull(d) {
    return new Date(d).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getAccountColor(accId) {
    if (!accId) return '#6366f1';
    const id = typeof accId === 'object' ? accId._id : accId;
    const acc = accounts.find(a => a._id === id);
    return acc?.color || '#6366f1';
}

function getMsgAccountId(msg) {
    if (!msg || !msg.accountId) return '';
    return typeof msg.accountId === 'object' ? (msg.accountId._id || '') : msg.accountId;
}

// ════════════════════════════════════════════
//  ACCOUNTS & SWITCHER
// ════════════════════════════════════════════

async function loadAccounts() {
    try {
        const data = await api('/email/accounts');
        accounts = (data.data || []).map((acc, i) => ({
            ...acc,
            color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
        }));
        renderAccountDropdown();
        populateComposeFrom();
        renderAccountsSettingsList();
    } catch (e) {
        console.error('Load accounts error:', e);
    }
}

function renderAccountDropdown() {
    const container = document.getElementById('accountsDropdownList');
    if (!container) return;

    container.innerHTML = accounts.map(acc => `
        <button class="account-menu-item ${currentAccountId === acc._id ? 'active' : ''}" onclick="selectAccount('${acc._id}')">
            <div class="acc-item-left">
                <span class="acc-color-dot" style="background:${acc.color};"></span>
                <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(acc.name)}</span>
            </div>
            <span class="acc-unread-pill" id="acc-unread-${acc._id}">${accountUnreadMap[acc._id] || 0}</span>
        </button>
    `).join('');
}

function toggleAccountDropdown() {
    const menu = document.getElementById('accountDropdownMenu');
    const chevron = document.getElementById('accDropdownChevron');
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

// Close account dropdown on outside click
document.addEventListener('click', (e) => {
    const switcher = document.getElementById('accountSwitcherBtn');
    const menu = document.getElementById('accountDropdownMenu');
    if (menu && menu.style.display === 'block' && !switcher.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
        const chevron = document.getElementById('accDropdownChevron');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
});

function selectAccount(accId) {
    currentAccountId = accId;
    const nameEl = document.getElementById('activeAccountName');
    const dotEl = document.getElementById('activeAccountDot');

    if (!accId) {
        nameEl.textContent = 'All Accounts';
        dotEl.style.background = '#6366f1';
    } else {
        const acc = accounts.find(a => a._id === accId);
        nameEl.textContent = acc ? acc.name : 'Account';
        dotEl.style.background = acc ? acc.color : '#6366f1';
    }

    document.getElementById('accountDropdownMenu').style.display = 'none';
    const chevron = document.getElementById('accDropdownChevron');
    if (chevron) chevron.style.transform = 'rotate(0deg)';

    renderAccountDropdown();
    currentMessageId = null;
    selectedMessages.clear();
    updateBulkToolbarState();
    loadFolder(currentFolder);
}

function populateComposeFrom() {
    const sel = document.getElementById('composeFrom');
    if (!sel) return;
    sel.innerHTML = accounts.map(a => `
        <option value="${a._id}" ${currentAccountId === a._id ? 'selected' : ''}>
            ${escapeHtml(a.name)} &lt;${escapeHtml(a.email)}&gt;
        </option>
    `).join('');
}

// ════════════════════════════════════════════
//  FOLDERS, FILTERING & MESSAGES
// ════════════════════════════════════════════

function loadFolder(folder, event) {
    if (event) event.preventDefault();
    currentFolder = folder;
    currentMessageId = null;
    selectedMessages.clear();
    page = 1;

    // Update nav active classes
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-folder') === folder);
    });

    // Update folder headings
    const titles = {
        inbox: 'Inbox',
        starred: 'Starred',
        sent: 'Sent',
        drafts: 'Drafts',
        archive: 'Archive',
        trash: 'Trash'
    };
    const titleText = titles[folder] || folder;
    document.getElementById('folderHeading').textContent = titleText;

    // Show/hide empty trash button
    const emptyTrashBtn = document.getElementById('emptyTrashBtn');
    if (emptyTrashBtn) {
        emptyTrashBtn.style.display = folder === 'trash' ? 'inline-flex' : 'none';
    }

    // Toggle bulk toolbar action buttons (Archive vs Restore)
    document.getElementById('bulkArchiveButtons').style.display = folder === 'trash' ? 'none' : 'inline-flex';
    document.getElementById('bulkTrashButtons').style.display = folder === 'trash' ? 'inline-flex' : 'none';

    // Clear reading pane
    document.getElementById('detailPlaceholder').style.display = 'flex';
    document.getElementById('detailContent').style.display = 'none';
    document.getElementById('emailListPanel').classList.remove('has-selected');

    updateBulkToolbarState();
    fetchMessages(1);
}

async function fetchMessages(targetPage = 1) {
    page = targetPage;
    const search = document.getElementById('searchInput').value.trim();
    const listEl = document.getElementById('emailList');

    listEl.innerHTML = `
        <div class="list-loading-state">
            <span class="spinner"></span>
            <p>Loading messages...</p>
        </div>
    `;

    try {
        const skip = (targetPage - 1) * pageSize;
        const params = new URLSearchParams({
            folder: currentFolder,
            limit: pageSize.toString(),
            skip: skip.toString()
        });

        if (currentAccountId) params.append('accountId', currentAccountId);
        if (search) params.append('search', search);

        const res = await api(`/email/messages?${params}`);
        messages = res.data || [];
        totalMessages = typeof res.total === 'number' ? res.total : messages.length;

        renderEmailList();
        updatePaginationUI();
        loadStats();
    } catch (err) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p style="color:var(--danger)">Failed to load: ${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderEmailList();
}

function getFilteredMessages() {
    return messages.filter(m => {
        if (currentFilter === 'unread') return m.status === 'received' || m.status === 'unread';
        if (currentFilter === 'starred') return !!m.starred;
        if (currentFilter === 'attachments') return m.attachments && m.attachments.length > 0;
        return true;
    });
}

function renderEmailList() {
    const listEl = document.getElementById('emailList');
    const filtered = getFilteredMessages();

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <h4>No messages found</h4>
                <p>There are no conversations in this view.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(m => {
        const isOutbound = currentFolder === 'sent';
        const senderName = getSenderName(isOutbound ? (m.to?.[0] || 'Recipient') : m.from);
        const isUnread = m.status === 'received' || m.status === 'unread';
        const isChecked = selectedMessages.has(m._id);
        const isActive = m._id === currentMessageId;
        const initial = senderName.charAt(0).toUpperCase();
        const snippet = m.content ? getSnippet(m.content) : (m.subject || 'No preview available');
        const accColor = getAccountColor(m.accountId);
        const acc = accounts.find(a => a._id === getMsgAccountId(m));

        return `
            <div class="email-item ${isUnread ? 'unread' : ''} ${isActive ? 'active' : ''}" onclick="openMessage('${m._id}')">
                <div class="item-checkbox-wrap" onclick="event.stopPropagation()">
                    <label class="checkbox-container">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSelectMessage('${m._id}', this)">
                        <span class="checkmark"></span>
                    </label>
                </div>
                <button class="item-star-btn ${m.starred ? 'starred' : ''}" onclick="toggleStar('${m._id}', event)" title="${m.starred ? 'Starred' : 'Not starred'}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="${m.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
                <div class="item-avatar" style="background:${accColor};">${initial}</div>
                <div class="item-content-wrap">
                    <div class="item-meta-top">
                        <div class="item-sender-row">
                            ${isUnread ? '<span class="unread-dot"></span>' : ''}
                            <span class="email-from">${isOutbound ? 'To: ' : ''}${escapeHtml(senderName)}</span>
                        </div>
                        <span class="email-time">${formatDate(m.createdAt)}</span>
                    </div>
                    <div class="email-subject">${escapeHtml(m.subject || '(No Subject)')}</div>
                    <div class="email-snippet">${escapeHtml(snippet)}</div>
                    <div class="item-tags-row">
                        ${acc ? `<span class="account-tag">${escapeHtml(acc.name)}</span>` : ''}
                        ${m.attachments?.length > 0 ? `
                            <span class="attachment-pill">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                <span>${m.attachments.length}</span>
                            </span>` : ''}
                    </div>
                </div>
                <!-- Hover Quick Actions Strip -->
                <div class="hover-actions-strip" onclick="event.stopPropagation()">
                    ${currentFolder === 'trash' ? `
                        <button class="hover-act-btn" onclick="restoreSingle('${m._id}')" title="Restore to Inbox">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        </button>
                    ` : `
                        <button class="hover-act-btn" onclick="archiveSingle('${m._id}', ${m.status !== 'archived'})" title="${m.status === 'archived' ? 'Unarchive' : 'Archive'}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                        </button>
                    `}
                    <button class="hover-act-btn" onclick="toggleReadSingle('${m._id}', ${isUnread})" title="${isUnread ? 'Mark as read' : 'Mark as unread'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${isUnread ? '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9"/><polyline points="22,6 12,13 2,6"/><polyline points="16 19 19 22 23 18"/>' : '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'}
                        </svg>
                    </button>
                    <button class="hover-act-btn danger" onclick="deleteSingle('${m._id}')" title="${currentFolder === 'trash' ? 'Permanently Delete' : 'Move to Trash'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updatePaginationUI() {
    const totalPages = Math.max(1, Math.ceil(totalMessages / pageSize));
    const start = totalMessages === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalMessages);

    document.getElementById('paginationRange').textContent = `${start}–${end} of ${totalMessages.toLocaleString()}`;
    document.getElementById('folderTotalCount').textContent = totalMessages.toLocaleString();
    document.getElementById('prevPageBtn').disabled = page <= 1;
    document.getElementById('nextPageBtn').disabled = page >= totalPages;
}

function prevPage() {
    if (page > 1) fetchMessages(page - 1);
}

function nextPage() {
    const totalPages = Math.ceil(totalMessages / pageSize);
    if (page < totalPages) fetchMessages(page + 1);
}

// ════════════════════════════════════════════
//  SELECTION & BULK ACTIONS
// ════════════════════════════════════════════

function toggleSelectAll(masterCheckbox) {
    const filtered = getFilteredMessages();
    if (masterCheckbox.checked) {
        filtered.forEach(m => selectedMessages.add(m._id));
    } else {
        selectedMessages.clear();
    }
    updateBulkToolbarState();
    renderEmailList();
}

function toggleSelectMessage(id, chk) {
    if (chk.checked) {
        selectedMessages.add(id);
    } else {
        selectedMessages.delete(id);
    }
    updateBulkToolbarState();
}

function updateBulkToolbarState() {
    const count = selectedMessages.size;
    const filtered = getFilteredMessages();
    const master = document.getElementById('selectAllCheckbox');
    const bulkToolbar = document.getElementById('bulkToolbar');
    const normalTitle = document.getElementById('toolbarNormalTitle');

    if (master) {
        master.checked = filtered.length > 0 && count === filtered.length;
        master.indeterminate = count > 0 && count < filtered.length;
    }

    if (count > 0) {
        normalTitle.style.display = 'none';
        bulkToolbar.style.display = 'flex';
        document.getElementById('selectedCountLabel').textContent = `${count} selected`;
    } else {
        normalTitle.style.display = 'flex';
        bulkToolbar.style.display = 'none';
    }
}

async function executeBulkAction(action) {
    if (selectedMessages.size === 0) return;
    const ids = Array.from(selectedMessages);

    try {
        await api('/email/messages/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: ids, action })
        });
        showToast(`Updated ${ids.length} messages`, 'success');
        selectedMessages.clear();
        updateBulkToolbarState();
        fetchMessages(page);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ════════════════════════════════════════════
//  READING PANE & DETAIL
// ════════════════════════════════════════════

async function openMessage(id) {
    currentMessageId = id;
    renderEmailList(); // update active highlight

    const placeholder = document.getElementById('detailPlaceholder');
    const content = document.getElementById('detailContent');
    const panel = document.getElementById('emailListPanel');

    placeholder.style.display = 'none';
    content.style.display = 'flex';
    panel.classList.add('has-selected');

    content.innerHTML = `
        <div class="list-loading-state">
            <span class="spinner"></span>
            <p>Loading conversation...</p>
        </div>
    `;

    try {
        const res = await api(`/email/messages/${id}`);
        const m = res.data;
        renderMessageDetail(m);
    } catch (err) {
        content.innerHTML = `
            <div class="empty-state">
                <p style="color:var(--danger)">Error: ${escapeHtml(err.message)}</p>
                <button class="btn-secondary" onclick="closeDetail()">Back</button>
            </div>
        `;
    }
}

function closeDetail() {
    currentMessageId = null;
    document.getElementById('detailPlaceholder').style.display = 'flex';
    document.getElementById('detailContent').style.display = 'none';
    document.getElementById('emailListPanel').classList.remove('has-selected');
    renderEmailList();
}

function renderMessageDetail(m) {
    const contentEl = document.getElementById('detailContent');
    const isOutbound = currentFolder === 'sent';
    const senderName = getSenderName(isOutbound ? (m.to?.[0] || 'Recipient') : m.from);
    const senderEmail = extractEmail(m.from);
    const initial = senderName.charAt(0).toUpperCase();
    const accColor = getAccountColor(m.accountId);

    // Prev / Next conversation calculation
    const filtered = getFilteredMessages();
    const idx = filtered.findIndex(item => item._id === m._id);
    const hasPrev = idx > 0;
    const hasNext = idx >= 0 && idx < filtered.length - 1;

    // Attachments Shelf HTML
    let attachmentsHtml = '';
    if (m.attachments && m.attachments.length > 0) {
        attachmentsHtml = `
            <div class="detail-attachments-shelf">
                <div class="shelf-title">Attachments (${m.attachments.length})</div>
                <div class="attachments-grid">
                    ${m.attachments.map(att => `
                        <a href="${API_BASE.replace('/api', '')}${att.path}" target="_blank" rel="noopener noreferrer" class="attachment-chip">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                            <span class="att-name">${escapeHtml(att.filename)}</span>
                            <span class="att-size">(${Math.round(att.size / 1024)} KB)</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    contentEl.innerHTML = `
        <!-- Reading Header Toolbar -->
        <div class="detail-toolbar">
            <div class="detail-actions-left">
                <button class="detail-action-btn" onclick="closeDetail()" title="Back to list">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                <button class="detail-action-btn ${m.starred ? 'starred' : ''}" onclick="toggleStar('${m._id}', event)" title="${m.starred ? 'Starred' : 'Star'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${m.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <button class="detail-action-btn" onclick="toggleReadSingle('${m._id}', false)" title="Mark as Unread">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </button>
                ${currentFolder === 'trash' ? `
                    <button class="detail-action-btn" onclick="restoreSingle('${m._id}')" title="Restore to Inbox">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    </button>
                ` : `
                    <button class="detail-action-btn" onclick="archiveSingle('${m._id}', ${m.status !== 'archived'})" title="${m.status === 'archived' ? 'Unarchive' : 'Archive'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    </button>
                `}
                <button class="detail-action-btn danger" onclick="deleteSingle('${m._id}')" title="${currentFolder === 'trash' ? 'Permanently Delete' : 'Move to Trash'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
            <div class="detail-actions-right">
                <button class="detail-action-btn" onclick="window.print()" title="Print message">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </button>
                <button class="detail-action-btn" onclick="triggerReplyFromDetail()" title="Reply in window">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                </button>
                <button class="detail-action-btn" onclick="triggerForwardFromDetail()" title="Forward in window">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                </button>
                <div class="bulk-divider"></div>
                <!-- Prev/Next cyclers -->
                <button class="detail-action-btn" ${hasPrev ? `onclick="navigateDetail(-1)"` : 'disabled'} title="Previous conversation (K)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button class="detail-action-btn" ${hasNext ? `onclick="navigateDetail(1)"` : 'disabled'} title="Next conversation (J)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
        </div>

        <!-- Scrollable Detail Body -->
        <div class="detail-scroll-area">
            <!-- Header Card -->
            <div class="detail-header-card">
                <h2 class="detail-subject-title">${escapeHtml(m.subject || '(No Subject)')}</h2>
                <div class="detail-sender-row">
                    <div class="sender-identity-wrap">
                        <div class="detail-avatar-large" style="background:${accColor};">${initial}</div>
                        <div class="sender-text-info">
                            <div class="sender-primary-line">
                                <span class="sender-name-strong">${escapeHtml(senderName)}</span>
                                <span class="sender-email-sub">&lt;${escapeHtml(senderEmail)}&gt;</span>
                            </div>
                            <div class="recipient-line">
                                <span>to ${(m.to || []).map(escapeHtml).join(', ')}</span>
                                <button class="btn-toggle-headers" onclick="toggleHeadersDrawer()" title="Show details">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                            </div>
                            <!-- Collapsible Headers Drawer -->
                            <div class="full-headers-drawer" id="fullHeadersDrawer" style="display: none;">
                                <div class="header-row"><strong>From:</strong> ${escapeHtml(m.from)}</div>
                                <div class="header-row"><strong>To:</strong> ${(m.to || []).map(escapeHtml).join(', ')}</div>
                                ${m.cc?.length > 0 ? `<div class="header-row"><strong>Cc:</strong> ${m.cc.map(escapeHtml).join(', ')}</div>` : ''}
                                <div class="header-row"><strong>Date:</strong> ${formatDateFull(m.createdAt)}</div>
                                <div class="header-row"><span class="tls-badge">🔒 Standard TLS Encryption (Verified)</span></div>
                            </div>
                        </div>
                    </div>
                    <span class="date-full-label">${formatDateFull(m.createdAt)}</span>
                </div>
            </div>

            <!-- Attachments -->
            ${attachmentsHtml}

            <!-- Sandboxed Email Body -->
            <div class="detail-body-container">
                <iframe id="emailBodyIframe" class="email-sandbox-frame" sandbox="allow-same-origin allow-popups"></iframe>
            </div>
        </div>

        <!-- Inline Quick Reply Box (Gmail Bottom Component) -->
        <div class="inline-reply-container">
            <div class="inline-reply-header">
                <div class="reply-target-badge">
                    <span>Reply to</span>
                    <span class="reply-target-email">${escapeHtml(isOutbound ? (m.to?.[0] || '') : m.from)}</span>
                </div>
                <button type="button" class="btn-popout" onclick="triggerReplyFromDetail()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span>Pop out</span>
                </button>
            </div>
            <div class="inline-reply-editor-box">
                <textarea id="inlineReplyContent" class="inline-reply-textarea" placeholder="Type your quick reply here..."></textarea>
                <div class="inline-reply-bottom-bar">
                    <div class="reply-left-tools">
                        <button type="button" class="btn-send-inline" id="inlineSendBtn" onclick="sendInlineReply('${m._id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            <span>Send Reply</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Inject sandboxed HTML into iframe
    setTimeout(() => {
        const iframe = document.getElementById('emailBodyIframe');
        if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
                const safeContent = m.content || '<p style="color:#64748b;font-family:sans-serif;padding:20px;">(No content)</p>';
                doc.open();
                doc.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body {
                                margin: 0;
                                padding: 20px;
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                font-size: 14px;
                                line-height: 1.6;
                                color: #1e293b;
                                word-break: break-word;
                            }
                            img { max-width: 100%; height: auto; }
                            table { max-width: 100% !important; }
                            a { color: #6366f1; }
                            blockquote {
                                border-left: 3px solid #cbd5e1;
                                margin: 1em 0;
                                padding-left: 1em;
                                color: #64748b;
                            }
                        </style>
                    </head>
                    <body>${safeContent}</body>
                    </html>
                `);
                doc.close();

                // Auto-adjust iframe height
                const adjustHeight = () => {
                    if (doc.body) {
                        const h = Math.max(280, doc.body.scrollHeight + 40);
                        iframe.style.height = `${h}px`;
                    }
                };
                adjustHeight();
                iframe.onload = adjustHeight;
            }
        }
    }, 50);
}

function toggleHeadersDrawer() {
    const el = document.getElementById('fullHeadersDrawer');
    if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function navigateDetail(offset) {
    const filtered = getFilteredMessages();
    const idx = filtered.findIndex(item => item._id === currentMessageId);
    if (idx !== -1 && filtered[idx + offset]) {
        openMessage(filtered[idx + offset]._id);
    }
}

// ════════════════════════════════════════════
//  SINGLE ACTIONS
// ════════════════════════════════════════════

async function toggleStar(id, event) {
    if (event) event.stopPropagation();
    try {
        const msg = messages.find(m => m._id === id);
        const next = msg ? !msg.starred : true;
        await api(`/email/messages/${id}/star`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ starred: next })
        });
        if (msg) msg.starred = next;
        renderEmailList();
        if (currentMessageId === id) {
            const btn = document.querySelector('.detail-toolbar .detail-action-btn.starred, .detail-toolbar .detail-action-btn:nth-child(2)');
            if (btn) btn.classList.toggle('starred', next);
        }
        loadStats();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function toggleReadSingle(id, currentUnread, event) {
    if (event) event.stopPropagation();
    try {
        await api(`/email/messages/${id}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: currentUnread })
        });
        const msg = messages.find(m => m._id === id);
        if (msg) msg.status = currentUnread ? 'read' : 'received';
        renderEmailList();
        loadStats();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function archiveSingle(id, isArchive, event) {
    if (event) event.stopPropagation();
    try {
        await api(`/email/messages/${id}/archive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: isArchive })
        });
        showToast(isArchive ? 'Archived conversation' : 'Moved to inbox', 'success');
        if (currentMessageId === id) closeDetail();
        fetchMessages(page);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteSingle(id, event) {
    if (event) event.stopPropagation();
    const isTrash = currentFolder === 'trash';
    const confirmText = isTrash ? 'Permanently delete this email?' : 'Move this email to trash?';
    if (!confirm(confirmText)) return;

    try {
        await api(`/email/messages/${id}${isTrash ? '?permanent=true' : ''}`, {
            method: 'DELETE'
        });
        showToast(isTrash ? 'Permanently deleted' : 'Moved to trash', 'success');
        if (currentMessageId === id) closeDetail();
        fetchMessages(page);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function restoreSingle(id, event) {
    if (event) event.stopPropagation();
    try {
        await api(`/email/messages/${id}/restore`, { method: 'PUT' });
        showToast('Restored to inbox', 'success');
        if (currentMessageId === id) closeDetail();
        fetchMessages(page);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function emptyTrash() {
    if (!confirm('Permanently delete all messages in Trash? This action cannot be undone.')) return;
    try {
        const ids = messages.map(m => m._id);
        if (ids.length === 0) return;
        await api('/email/messages/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: ids, action: 'permanentDelete' })
        });
        showToast('Trash emptied', 'success');
        closeDetail();
        fetchMessages(1);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ════════════════════════════════════════════
//  COMPOSE & INLINE REPLY
// ════════════════════════════════════════════

function openCompose(draft = {}) {
    const modal = document.getElementById('dockedCompose');
    modal.style.display = 'flex';
    modal.classList.remove('minimized');

    populateComposeFrom();
    if (draft.fromAccountId) document.getElementById('composeFrom').value = draft.fromAccountId;
    document.getElementById('composeTo').value = draft.to || '';
    document.getElementById('composeCc').value = draft.cc || '';
    document.getElementById('composeBcc').value = draft.bcc || '';
    document.getElementById('composeSubject').value = draft.subject || '';
    document.getElementById('composeContent').value = draft.content || '';

    if (draft.cc) document.getElementById('composeCcRow').style.display = 'flex';
    if (draft.bcc) document.getElementById('composeBccRow').style.display = 'flex';

    composeFiles = [];
    renderComposeAttachments();
}

function closeCompose() {
    document.getElementById('dockedCompose').style.display = 'none';
    document.getElementById('composeForm').reset();
    composeFiles = [];
    renderComposeAttachments();
}

function toggleMinimizeCompose() {
    const modal = document.getElementById('dockedCompose');
    modal.classList.toggle('minimized');
}

function toggleMaximizeCompose() {
    const modal = document.getElementById('dockedCompose');
    modal.classList.toggle('maximized');
}

function toggleComposeField(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function handleComposeFileSelect(e) {
    const files = Array.from(e.target.files || []);
    composeFiles.push(...files);
    renderComposeAttachments();
}

function renderComposeAttachments() {
    const preview = document.getElementById('composeAttachmentsPreview');
    if (composeFiles.length === 0) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
    }
    preview.style.display = 'flex';
    preview.innerHTML = composeFiles.map((f, i) => `
        <div class="preview-pill">
            <span>📎 ${escapeHtml(f.name)} (${Math.round(f.size / 1024)} KB)</span>
            <button type="button" class="remove-att-btn" onclick="removeComposeFile(${i})">&times;</button>
        </div>
    `).join('');
}

function removeComposeFile(index) {
    composeFiles.splice(index, 1);
    renderComposeAttachments();
}

async function handleSendCompose(e) {
    e.preventDefault();
    const btn = document.getElementById('composeSendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span>Sending...</span>';

    try {
        const formData = new FormData();
        formData.append('accountId', document.getElementById('composeFrom').value);
        formData.append('to', document.getElementById('composeTo').value.trim());
        formData.append('subject', document.getElementById('composeSubject').value.trim());
        formData.append('content', document.getElementById('composeContent').value);

        const cc = document.getElementById('composeCc').value.trim();
        const bcc = document.getElementById('composeBcc').value.trim();
        if (cc) formData.append('cc', cc);
        if (bcc) formData.append('bcc', bcc);

        composeFiles.forEach(f => formData.append('attachments', f));

        const res = await fetch(`${API_BASE}/email/send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send message');

        closeCompose();
        showToast('Email sent successfully!', 'success');
        if (currentFolder === 'sent') fetchMessages(1);
        loadStats();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> <span>Send</span>';
    }
}

// Inline Quick Reply
async function sendInlineReply(msgId) {
    const textEl = document.getElementById('inlineReplyContent');
    const content = textEl?.value?.trim();
    if (!content) {
        showToast('Please enter a message to reply', 'error');
        return;
    }

    const m = messages.find(item => item._id === msgId);
    if (!m) return;

    const btn = document.getElementById('inlineSendBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span>Sending...</span>';

    try {
        const isOutbound = currentFolder === 'sent';
        const toTarget = isOutbound ? (m.to?.[0] || '') : m.from;
        const replySubject = m.subject?.startsWith('Re:') ? m.subject : `Re: ${m.subject || ''}`;

        const formData = new FormData();
        formData.append('accountId', getMsgAccountId(m) || currentAccountId || accounts[0]?._id);
        formData.append('to', extractEmail(toTarget));
        formData.append('subject', replySubject);
        formData.append('content', content);

        const res = await fetch(`${API_BASE}/email/send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Send failed');

        textEl.value = '';
        showToast('Reply sent successfully!', 'success');
        loadStats();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> <span>Send Reply</span>';
    }
}

function triggerReplyFromDetail() {
    const m = messages.find(item => item._id === currentMessageId);
    if (!m) return;
    const isOutbound = currentFolder === 'sent';
    const toTarget = isOutbound ? (m.to?.[0] || '') : m.from;
    const subj = m.subject?.startsWith('Re:') ? m.subject : `Re: ${m.subject || ''}`;
    const quoted = `\n\nOn ${formatDateFull(m.createdAt)}, ${m.from} wrote:\n> ${stripHtmlToText(m.content).replace(/\n/g, '\n> ')}`;

    openCompose({
        fromAccountId: getMsgAccountId(m),
        to: extractEmail(toTarget),
        subject: subj,
        content: quoted
    });
}

function triggerForwardFromDetail() {
    const m = messages.find(item => item._id === currentMessageId);
    if (!m) return;
    const subj = m.subject?.startsWith('Fwd:') ? m.subject : `Fwd: ${m.subject || ''}`;
    const forwarded = `\n\n---------- Forwarded message ---------\nFrom: ${m.from}\nDate: ${formatDateFull(m.createdAt)}\nSubject: ${m.subject}\nTo: ${(m.to || []).join(', ')}\n\n${stripHtmlToText(m.content)}`;

    openCompose({
        fromAccountId: getMsgAccountId(m),
        subject: subj,
        content: forwarded
    });
}

// ════════════════════════════════════════════
//  MAILBOX SETTINGS & ACCOUNTS MODAL
// ════════════════════════════════════════════

function openAccountsModal() {
    document.getElementById('accountsModal').style.display = 'flex';
    document.getElementById('addAccountForm').reset();
    document.getElementById('editAccountId').value = '';
    renderAccountsSettingsList();
}

function closeAccountsModal() {
    document.getElementById('accountsModal').style.display = 'none';
}

function renderAccountsSettingsList() {
    const container = document.getElementById('accountsSettingsList');
    if (!container) return;

    if (accounts.length === 0) {
        container.innerHTML = '<p style="font-size:12px;color:var(--text-dim);">No accounts configured yet.</p>';
        return;
    }

    container.innerHTML = accounts.map(acc => `
        <div class="acc-config-card">
            <div class="acc-config-left">
                <span class="acc-color-dot" style="background:${acc.color};"></span>
                <div>
                    <div class="acc-card-name">${escapeHtml(acc.name)}</div>
                    <div class="acc-card-email">${escapeHtml(acc.email)} • Host: ${escapeHtml(acc.smtpConfig?.host || 'Default')}</div>
                </div>
            </div>
            <button type="button" class="btn-secondary" onclick="editAccount('${acc._id}')">Edit</button>
        </div>
    `).join('');
}

function editAccount(id) {
    const acc = accounts.find(a => a._id === id);
    if (!acc) return;
    document.getElementById('editAccountId').value = acc._id;
    document.getElementById('accName').value = acc.name || '';
    document.getElementById('accEmail').value = acc.email || '';
    document.getElementById('accSmtpHost').value = acc.smtpConfig?.host || 'smtp-relay.brevo.com';
    document.getElementById('accSmtpPort').value = acc.smtpConfig?.port || 587;
    document.getElementById('accSmtpUser').value = acc.smtpConfig?.username || '';
    document.getElementById('accSmtpPass').value = '';
    document.getElementById('accForward').value = acc.forwardTo || '';
    document.getElementById('saveAccountBtn').textContent = 'Update Account';
}

async function handleSaveAccount(e) {
    e.preventDefault();
    const editId = document.getElementById('editAccountId').value;
    const body = {
        name: document.getElementById('accName').value.trim(),
        email: document.getElementById('accEmail').value.trim(),
        forwardTo: document.getElementById('accForward').value.trim() || undefined,
        smtpConfig: {
            host: document.getElementById('accSmtpHost').value.trim(),
            port: parseInt(document.getElementById('accSmtpPort').value) || 587,
            username: document.getElementById('accSmtpUser').value.trim() || undefined,
            password: document.getElementById('accSmtpPass').value || undefined
        }
    };

    try {
        if (editId) {
            await api(`/email/accounts/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            showToast('Account updated successfully', 'success');
        } else {
            await api('/email/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            showToast('Account created successfully', 'success');
        }

        closeAccountsModal();
        loadAccounts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ════════════════════════════════════════════
//  STATS & UNREAD COUNTS
// ════════════════════════════════════════════

async function loadStats() {
    try {
        const params = new URLSearchParams();
        if (currentAccountId) params.append('accountId', currentAccountId);
        const data = await api(`/email/stats/mailbox?${params}`);

        if (data.success) {
            mailboxStats = {
                unread: data.unreadCount || 0,
                sent: data.sentToday || 0,
                drafts: data.drafts || 0,
                starred: data.starred || 0,
                trash: data.trash || 0,
                archive: data.archive || 0
            };

            // Map unread counts per account
            accountUnreadMap = {};
            let totalUnreadAll = 0;
            (data.unread || []).forEach(item => {
                if (item._id) accountUnreadMap[item._id] = item.count;
                totalUnreadAll += item.count;
            });

            // Update badge pills
            updateBadge('badge-inbox', mailboxStats.unread);
            updateBadge('badge-starred', mailboxStats.starred);
            updateBadge('badge-sent', mailboxStats.sent);
            updateBadge('badge-drafts', mailboxStats.drafts);
            updateBadge('badge-archive', mailboxStats.archive);
            updateBadge('badge-trash', mailboxStats.trash);

            const allPill = document.getElementById('allAccUnreadPill');
            if (allPill) allPill.textContent = totalUnreadAll;

            const unreadFilterCount = document.getElementById('unreadFilterCount');
            if (unreadFilterCount) {
                unreadFilterCount.textContent = mailboxStats.unread;
                unreadFilterCount.style.display = mailboxStats.unread > 0 ? 'inline-block' : 'none';
            }

            // Update individual accounts pills
            accounts.forEach(acc => {
                const pill = document.getElementById(`acc-unread-${acc._id}`);
                if (pill) pill.textContent = accountUnreadMap[acc._id] || 0;
            });

            document.getElementById('sidebarStatusText').textContent = `${totalMessages.toLocaleString()} emails • Ready`;
        }
    } catch (e) {
        console.error('Stats error:', e);
    }
}

function updateBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.textContent = count > 99 ? '99+' : count;
        el.style.display = 'inline-block';
    } else {
        el.style.display = 'none';
    }
}

// ════════════════════════════════════════════
//  SEARCH, REFRESH & SHORTCUTS
// ════════════════════════════════════════════

function handleSearchInput() {
    const val = document.getElementById('searchInput').value;
    const clearBtn = document.getElementById('searchClearBtn');
    const shortcutBadge = document.getElementById('searchKeyBadge');

    if (val) {
        clearBtn.style.display = 'flex';
        shortcutBadge.style.display = 'none';
    } else {
        clearBtn.style.display = 'none';
        shortcutBadge.style.display = 'inline-block';
    }

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        page = 1;
        fetchMessages(1);
    }, 350);
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    input.value = '';
    handleSearchInput();
    input.focus();
}

function refreshMailbox() {
    const btn = document.getElementById('refreshBtn');
    btn.style.animation = 'spin 0.6s linear';
    setTimeout(() => { btn.style.animation = ''; }, 600);
    fetchMessages(page);
    showToast('Mailbox refreshed', 'info');
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sb.classList.toggle('mobile-open');
    } else {
        sb.classList.toggle('collapsed');
    }
}

// Global Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

    if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        openCompose();
    } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (currentMessageId) navigateDetail(1);
    } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (currentMessageId) navigateDetail(-1);
    } else if (e.key === 's' || e.key === 'S') {
        if (currentMessageId) {
            e.preventDefault();
            toggleStar(currentMessageId);
        }
    } else if (e.key === 'e' || e.key === 'E') {
        if (currentMessageId) {
            e.preventDefault();
            const msg = messages.find(m => m._id === currentMessageId);
            archiveSingle(currentMessageId, msg ? msg.status !== 'archived' : true);
        }
    } else if (e.key === '#' || e.key === 'Delete') {
        if (currentMessageId) {
            e.preventDefault();
            deleteSingle(currentMessageId);
        }
    } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
    } else if (e.key === 'Escape') {
        if (currentMessageId) closeDetail();
        closeCompose();
        closeAccountsModal();
    }
});

// Toast Notification
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success' ? '<polyline points="20 6 9 17 4 12"/>' : (type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>')}
        </svg>
        <span>${escapeHtml(msg)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}
