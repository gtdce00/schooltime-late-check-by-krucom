// ===== APP.JS — Main Application Controller =====

let currentUser = null;
let notifPanelOpen = false;
let currentPage = 'dashboard';
let _charts = {};

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    DB.seed();
    checkAuth();
    updateClock();
    setInterval(updateClock, 60000);
});

function checkAuth() {
    currentUser = AuthDB.getCurrentUser();
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('app').classList.remove('active');
}

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('app').classList.add('active');
    renderSidebar();
    renderTopbar();
    navigateTo('dashboard');
    updateNotifBadge();
}

// ---- Login ----
document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const user = AuthDB.login(username, password);
    if (user) {
        AuthDB.setCurrentUser(user);
        currentUser = user;
        showApp();
        showToast(`ยินดีต้อนรับ ${user.name}`, 'success');
    } else {
        const err = document.getElementById('loginError');
        err.classList.add('show');
        setTimeout(() => err.classList.remove('show'), 3000);
    }
});

function logout() {
    AuthDB.logout();
    currentUser = null;
    showLogin();
    showToast('ออกจากระบบเรียบร้อย', 'info');
    // reset charts
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch (_) { } });
    _charts = {};
}

// ---- Sidebar ----
function renderSidebar() {
    const user = currentUser;
    document.getElementById('sidebarUserName').textContent = user.name;
    const roleLabels = { 'admin': 'ผู้ดูแลระบบ', 'teacher': 'ครูประจำชั้น', 'duty': 'ครูเวร', 'executive': 'ผู้บริหาร' };
    document.getElementById('sidebarUserRole').textContent = roleLabels[user.role] || 'อื่นๆ';
    document.getElementById('sidebarUserAvatar').textContent = user.name.charAt(0);

    const isAdmin = user.role === 'admin';
    const navItems = [
        { id: 'dashboard', icon: '📊', label: 'แดชบอร์ด', always: true },
        { id: 'attendance', icon: '✅', label: 'เช็คมาสาย', always: true },
        { id: 'classrooms', icon: '🏫', label: 'ห้องเรียน', always: true },
        { id: 'students', icon: '👥', label: 'รายชื่อนักเรียน', always: true },
        { id: 'studentActivities', icon: '📋', label: 'กิจกรรมนักเรียน', always: true },
        { separator: true, label: 'จัดการระบบ', adminOnly: true },
        { id: 'activities', icon: '🎯', label: 'จัดการกิจกรรม', adminOnly: true },
        { id: 'reports', icon: '📈', label: 'รายงานสรุป', always: true },
        { id: 'notifications', icon: '🔔', label: 'การแจ้งเตือน', always: true },
        { separator: true, label: 'ผู้ใช้งาน', adminOnly: true },
        { id: 'auditlogs', icon: '🧾', label: 'Audit Logs', adminOnly: true },
        { id: 'users', icon: '👤', label: 'จัดการผู้ใช้', adminOnly: true },
    ];

    const nav = document.getElementById('sidebarNav');
    nav.innerHTML = '';
    navItems.forEach(item => {
        if (item.adminOnly && !isAdmin) return;
        if (item.separator) {
            nav.innerHTML += `<div class="nav-section-title">${item.label}</div>`;
            return;
        }
        nav.innerHTML += `
      <div class="nav-item" id="nav-${item.id}" onclick="navigateTo('${item.id}')">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
        ${item.id === 'notifications' ? `<span class="nav-badge" id="navNotifBadge"></span>` : ''}
      </div>`;
    });
}

function renderTopbar() {
    document.getElementById('topbarUser').textContent = currentUser.name;
}

// ---- Navigation ----
function navigateTo(pageId) {
    currentPage = pageId;
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${pageId}`);
    if (navEl) navEl.classList.add('active');
    // Show page
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl) pageEl.classList.add('active');
    // Update topbar title
    const titles = {
        dashboard: '📊 แดชบอร์ด',
        attendance: '✅ เช็คมาสาย',
        classrooms: '🏫 จัดการห้องเรียน',
        students: '👥 จัดการรายชื่อนักเรียน',
        studentActivities: '📋 กิจกรรมนักเรียน',
        activities: '🎯 จัดการกิจกรรม',
        reports: '📈 รายงานสรุป',
        notifications: '🔔 การแจ้งเตือน',
        users: '👤 จัดการผู้ใช้',
        auditlogs: '🧾 Audit Logs',
    };
    document.getElementById('topbarTitle').textContent = titles[pageId] || pageId;
    // Load page
    const loaders = {
        dashboard: loadDashboard,
        attendance: loadAttendance,
        classrooms: loadClassrooms,
        students: loadStudents,
        studentActivities: loadStudentActivities,
        activities: loadActivities,
        reports: loadReports,
        notifications: loadNotifications,
        users: loadUsers,
        auditlogs: loadAuditLogs,
    };

    if (loaders[pageId]) loaders[pageId]();
    // Close mobile sidebar
    closeMobileSidebar();
}

// ---- Mobile sidebar ----
function toggleMobileSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// ---- Notifications panel ----
function toggleNotifPanel() {
    notifPanelOpen = !notifPanelOpen;
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('open', notifPanelOpen);
    if (notifPanelOpen) loadNotifPanel();
}

function loadNotifPanel() {
    const notifs = NotificationDB.getAll().slice().reverse();
    const container = document.getElementById('notifPanelList');
    if (!notifs.length) {
        container.innerHTML = `<div class="notif-empty">🔔<br>ไม่มีการแจ้งเตือน</div>`;
        return;
    }
    container.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="readNotif('${n.id}')">
      <div class="notif-icon">${n.icon || '🔔'}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${timeSince(n.createdAt)}</div>
      </div>
    </div>`).join('');
}

function readNotif(id) {
    NotificationDB.markRead(id);
    updateNotifBadge();
    loadNotifPanel();
}

function markAllNotifRead() {
    NotificationDB.markAllRead();
    updateNotifBadge();
    loadNotifPanel();
    if (currentPage === 'notifications') loadNotifications();
}

function updateNotifBadge() {
    const count = NotificationDB.getUnread().length;
    const badge = document.getElementById('notifCount');
    const navBadge = document.getElementById('navNotifBadge');
    if (badge) { badge.textContent = count; badge.classList.toggle('show', count > 0); }
    if (navBadge) { navBadge.textContent = count > 0 ? count : ''; }
}

// ---- Clock ----
function updateClock() {
    const now = new Date();
    const opts = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'Asia/Bangkok'
    };
    const dateStr = now.toLocaleDateString('th-TH', opts);
    const timeEl = document.getElementById('topbarTime');
    if (timeEl) timeEl.textContent = dateStr;
}

// ---- Toast ----
function showToast(msg, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span style="flex:1">${msg}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ---- Modal helpers ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ---- Utility ----
function todayDate() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
}
function formatDate(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
function timeSince(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}
function getLateStatus(count) {
    if (count >= 3) return { cls: 'badge-danger', label: '🔴 เกิน 3 ครั้ง', circleCls: 'circle-danger' };
    if (count >= 2) return { cls: 'badge-warning', label: '🟡 ใกล้ 3 ครั้ง', circleCls: 'circle-warning' };
    return { cls: 'badge-success', label: '🟢 ปกติ', circleCls: 'circle-normal' };
}
function difficultyLabel(d) {
    const m = { easy: { label: 'ง่าย (1 ชม.)', cls: 'diff-easy' }, medium: { label: 'ปานกลาง (2 ชม.)', cls: 'diff-medium' }, hard: { label: 'ยาก (3 ชม.)', cls: 'diff-hard' } };
    return m[d] || { label: d, cls: '' };
}
function escape(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resetDatabase() {
    if (!AuthDB.isAdmin()) return;
    const ans = prompt('⚠️ การกระทำนี้จะลบข้อมูลทั้งหมดในระบบ (นักเรียน, ตารางมาสาย, กิจกรรม ฯลฯ)\nยกเว้นบัญชีผู้ใช้งานระบบ\n\nพิมพ์ "DELETE" เพื่อยืนยันการล้างข้อมูล:');
    if (ans !== 'DELETE') return;

    const users = DB.getAll(DB.TABLES.USERS);
    localStorage.clear();
    DB.save(DB.TABLES.USERS, users);
    showToast('ล้างข้อมูลระบบเรียบร้อยแล้ว', 'success');
    setTimeout(() => window.location.reload(), 1500);
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => {
        if (!m.parentElement.contains(e.target)) m.classList.remove('open');
    });
    if (notifPanelOpen && !e.target.closest('#notifPanel') && !e.target.closest('#btnNotif')) {
        notifPanelOpen = false;
        document.getElementById('notifPanel').classList.remove('open');
    }
});
