// ===== ACTIVITIES PAGE =====

function loadActivities() {
    if (!AuthDB.isAdmin()) {
        document.getElementById('page-activities').innerHTML = `<div class="alert alert-danger">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>`;
        return;
    }
    renderActivitiesTable();
}

function renderActivitiesTable() {
    const acts = ActivityDB.getAll();
    const tbody = document.getElementById('activitiesTableBody');
    if (!acts.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="padding:40px">
      <div class="empty-icon">🎯</div><p>ยังไม่มีกิจกรรม</p></td></tr>`;
        return;
    }
    tbody.innerHTML = acts.map(a => {
        const d = difficultyLabel(a.difficulty);
        const usageCount = StudentActivityDB.getAll().filter(sa => sa.activityId === a.id).length;
        return `<tr>
      <td><strong>${escape(a.name)}</strong></td>
      <td><span class="${d.cls}">${d.label}</span></td>
      <td>${a.hours} ชั่วโมง</td>
      <td>${escape(a.description || '-')}</td>
      <td><span class="badge badge-secondary">${usageCount} ครั้ง</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editActivity('${a.id}')">✏️ แก้ไข</button>
        <button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteActivity('${a.id}')">🗑</button>
      </td>
    </tr>`;
    }).join('');
}

function openAddActivityModal() {
    document.getElementById('activityModalTitle').textContent = '➕ เพิ่มกิจกรรมใหม่';
    document.getElementById('activityForm').reset();
    document.getElementById('activityEditId').value = '';
    document.getElementById('actHoursCustom').style.display = 'none';
    document.getElementById('actHours').value = 1;
    openModal('modalActivity');
}

function editActivity(id) {
    const a = ActivityDB.getById(id);
    if (!a) return;
    document.getElementById('activityModalTitle').textContent = '✏️ แก้ไขกิจกรรม';
    document.getElementById('activityEditId').value = id;
    document.getElementById('actName').value = a.name;
    document.getElementById('actDescription').value = a.description || '';
    document.getElementById('actDifficulty').value = a.difficulty;
    document.getElementById('actHours').value = a.hours;
    onDifficultyChange();
    openModal('modalActivity');
}

function onDifficultyChange() {
    const diff = document.getElementById('actDifficulty').value;
    const hoursInput = document.getElementById('actHours');
    const customWrap = document.getElementById('actHoursCustom');
    const hourMap = { easy: 1, medium: 2, hard: 3, custom: '' };
    if (diff === 'custom') {
        customWrap.style.display = 'block';
        hoursInput.value = '';
    } else {
        customWrap.style.display = 'none';
        hoursInput.value = hourMap[diff] || 1;
    }
}

function saveActivity() {
    const id = document.getElementById('activityEditId').value;
    const name = document.getElementById('actName').value.trim();
    const description = document.getElementById('actDescription').value.trim();
    const difficulty = document.getElementById('actDifficulty').value;
    let hours = parseFloat(document.getElementById('actHours').value);
    if (difficulty === 'custom') hours = parseFloat(document.getElementById('actHoursCustomInput').value) || 1;

    if (!name) { showToast('กรุณาใส่ชื่อกิจกรรม', 'warning'); return; }

    if (id) {
        ActivityDB.update(id, { name, description, difficulty, hours });
        showToast('แก้ไขกิจกรรมแล้ว ✅', 'success');
    } else {
        ActivityDB.add({ name, description, difficulty, hours });
        showToast('เพิ่มกิจกรรมแล้ว ✅', 'success');
    }
    closeModal('modalActivity');
    renderActivitiesTable();
}

function deleteActivity(id) {
    const a = ActivityDB.getById(id);
    if (!confirm(`ต้องการลบกิจกรรม "${a?.name}"?`)) return;
    ActivityDB.delete(id);
    showToast('ลบกิจกรรมแล้ว', 'success');
    renderActivitiesTable();
}


// ===== STUDENT ACTIVITIES PAGE =====

let _saFilter = 'all';
let _saSearch = '';
let _saRoomFilter = '';
let _saMonthFilter = '';

function loadStudentActivities() {
    renderSAFilters();
    renderSATable();
}

function renderSAFilters() {
    const rooms = StudentDB.getRooms();
    const sel = document.getElementById('saRoomFilter');
    if (sel) {
        const cur = sel.value;
        sel.innerHTML = `<option value="">ทุกห้อง</option>` +
            rooms.map(r => `<option value="${r}" ${r === cur ? 'selected' : ''}>${r}</option>`).join('');
    }
}

function renderSATable() {
    let records = StudentActivityDB.getAll();

    if (_saFilter === 'pending') records = records.filter(r => r.status === 'pending');
    else if (_saFilter === 'done') records = records.filter(r => r.status === 'done');
    else if (_saFilter === 'overdue') records = StudentActivityDB.getOverdue();

    const search = _saSearch.toLowerCase();
    records = records.filter(r => {
        const s = StudentDB.getById(r.studentId);
        const text = `${s?.firstName} ${s?.lastName} ${s?.room}`.toLowerCase();
        const a = ActivityDB.getById(r.activityId);
        const aText = (a?.name || '').toLowerCase();
        return (!search || text.includes(search) || aText.includes(search)) &&
            (!_saRoomFilter || s?.room === _saRoomFilter) &&
            (!_saMonthFilter || r.month === _saMonthFilter);
    });

    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = document.getElementById('saTableBody');
    document.getElementById('saTotalCount').textContent = records.length;

    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:40px">
      <div class="empty-icon">📋</div><p>ไม่มีข้อมูล</p></td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const s = StudentDB.getById(r.studentId);
        const a = ActivityDB.getById(r.activityId);
        const teacher = DB.getById(DB.TABLES.USERS, r.teacherId);
        const now = new Date();
        const created = new Date(r.createdAt);
        const daysDiff = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        const isOverdue = r.status === 'pending' && daysDiff >= 30;
        const isAdmin = AuthDB.isAdmin();
        const monthLabel = r.month || '-';

        return `<tr ${isOverdue ? 'style="background:var(--danger-light)"' : ''}>
      <td><strong>${escape(s ? `${s.firstName} ${s.lastName}` : '-')}</strong>
        <br><small class="text-muted">${escape(s?.room || '')} · เดือน ${monthLabel}</small></td>
      <td>${escape(a?.name || '-')}</td>
      <td>${formatDate(r.date)} ${r.time || ''}</td>
      <td>${escape(teacher?.name || '-')}</td>
      <td>
        <span class="badge ${r.status === 'done' ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-warning'}">
          ${r.status === 'done' ? '✅ เสร็จสิ้น' : isOverdue ? '🔴 เกินกำหนด' : '⏳ รอดำเนินการ'}
        </span>
      </td>
      <td>${daysDiff} วัน</td>
      <td>
        ${r.status !== 'done' && isAdmin ? `
          <button class="btn btn-sm btn-success" onclick="updateSAStatus('${r.id}','done')">✅ เสร็จ</button>
        ` : ''}
        ${isAdmin ? `<button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteSA('${r.id}')">🗑</button>` : ''}
      </td>
    </tr>`;
    }).join('');
}

function filterSAStatus(filter) {
    _saFilter = filter;
    document.querySelectorAll('.sa-filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`saFilter-${filter}`).classList.add('active');
    renderSATable();
}

function updateSAStatus(id, status) {
    StudentActivityDB.updateStatus(id, status);
    showToast(`อัปเดตสถานะเป็น "${status === 'done' ? 'เสร็จสิ้น' : 'รอดำเนินการ'}" แล้ว`, 'success');
    renderSATable();
}

function deleteSA(id) {
    if (!confirm('ต้องการลบรายการนี้?')) return;
    StudentActivityDB.delete(id);
    showToast('ลบรายการแล้ว', 'success');
    renderSATable();
}


// ===== NOTIFICATIONS PAGE =====

function loadNotifications() {
    const notifs = NotificationDB.getAll().slice().reverse();
    const container = document.getElementById('notifsContainer');
    document.getElementById('notifUnreadCount').textContent = NotificationDB.getUnread().length;

    if (!notifs.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><p>ไม่มีการแจ้งเตือน</p></div>`;
        return;
    }

    const typeMap = {
        warning: 'alert-warning', danger: 'alert-danger', info: 'alert-info', success: 'alert-success'
    };

    container.innerHTML = notifs.map(n => `
    <div class="alert ${typeMap[n.type] || 'alert-info'} ${n.read ? '' : 'font-bold'}" 
         style="margin-bottom:10px;cursor:pointer" onclick="markNotifRead('${n.id}')">
      <span style="font-size:1.4rem">${n.icon || '🔔'}</span>
      <div style="flex:1">
        <div>${n.title}</div>
        <div style="font-size:.85rem;margin-top:4px;opacity:.8">${n.message}</div>
        <div style="font-size:.75rem;opacity:.6;margin-top:4px">${formatDateTime(n.createdAt)} ${n.read ? '' : '<span class="badge badge-primary" style="font-size:.65rem">ใหม่</span>'}</div>
      </div>
    </div>`).join('');
}

function markNotifRead(id) {
    NotificationDB.markRead(id);
    updateNotifBadge();
    loadNotifications();
}


// ===== REPORTS PAGE =====

function loadReports() {
    renderReportFilters();
    loadReportData();
}

function renderReportFilters() {
    const rooms = StudentDB.getRooms();
    const sel = document.getElementById('reportRoomFilter');
    if (!sel) return;
    sel.innerHTML = `<option value="">ทุกห้อง</option>` +
        rooms.map(r => `<option value="${r}">${r}</option>`).join('');
}

function loadReportData() {
    const roomFilter = document.getElementById('reportRoomFilter')?.value || '';
    const monthFilter = document.getElementById('reportMonthFilter')?.value || '';
    const statusFilter = document.getElementById('reportStatusFilter')?.value || '';

    let records = AttendanceDB.getAll();
    if (roomFilter) records = records.filter(r => r.room === roomFilter);
    if (monthFilter) records = records.filter(r => r.date && r.date.startsWith(monthFilter));
    if (statusFilter) records = records.filter(r => r.status === statusFilter);
    // Exclude 'present' by default in summary tables if no status filter
    const summaryRecs = statusFilter ? records : records.filter(r => r.status !== 'present');

    // Summary
    document.getElementById('rptTotalRecords').textContent = summaryRecs.length;
    const uniqueStudents = new Set(summaryRecs.map(r => r.studentId));
    document.getElementById('rptUniqueStudents').textContent = uniqueStudents.size;

    // By room
    const byCls = {};
    summaryRecs.forEach(r => { byCls[r.room] = (byCls[r.room] || 0) + 1; });
    const tbody = document.getElementById('rptRoomBody');
    tbody.innerHTML = Object.entries(byCls)
        .sort((a, b) => b[1] - a[1])
        .map(([room, cnt]) => `<tr><td>${escape(room)}</td><td>${cnt}</td></tr>`)
        .join('') || `<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>`;

    // Top students by late count in filtered period
    const lateRecs = records.filter(r => r.status === 'late');
    const byStu = {};
    lateRecs.forEach(r => { byStu[r.studentId] = (byStu[r.studentId] || 0) + 1; });
    const topStuBody = document.getElementById('rptTopStudentBody');
    const topEntries = Object.entries(byStu).sort((a, b) => b[1] - a[1]).slice(0, 10);
    topStuBody.innerHTML = topEntries.map(([id, cnt], i) => {
        const s = StudentDB.getById(id);
        const ms = getMonthlyLateStatus(cnt);
        return `<tr>
      <td>${i + 1}</td>
      <td>${escape(s ? `${s.firstName} ${s.lastName}` : '-')}</td>
      <td>${escape(s?.room || '-')}</td>
      <td><span class="badge ${ms.badge}">${cnt} ครั้ง</span></td>
    </tr>`;
    }).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">ไม่มีข้อมูล</td></tr>`;

    renderReportChart(summaryRecs);
}

function renderReportChart(records) {
    // Daily by date
    const byDate = {};
    records.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + 1; });
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
    const ctx = document.getElementById('reportChart');
    if (!ctx) return;
    if (_charts.report) _charts.report.destroy();
    _charts.report = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(([d]) => {
                const dd = new Date(d);
                return dd.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'จำนวนมาสาย',
                data: sorted.map(([, c]) => c),
                borderColor: 'rgb(37,99,235)',
                backgroundColor: 'rgba(37,99,235,.1)',
                fill: true, tension: 0.4,
                pointBackgroundColor: 'rgb(37,99,235)',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function exportPDF() {
    showToast('กำลังสร้าง PDF...', 'info');
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Load Thai font (fallback to default)
        doc.setFont('helvetica');
        doc.setFontSize(18);
        doc.text('Late Attendance Report', 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString('th-TH')}`, 14, 28);

        const records = LateRecordDB.getAll();
        const tableData = records.slice(0, 50).map(r => {
            const s = StudentDB.getById(r.studentId);
            return [r.date, s ? `${s.firstName} ${s.lastName}` : '-', r.room, r.time || '-'];
        });

        doc.autoTable({
            head: [['Date', 'Student', 'Room', 'Time']],
            body: tableData,
            startY: 35,
        });

        doc.save('late-attendance-report.pdf');
        showToast('ดาวน์โหลด PDF แล้ว ✅', 'success');
    } catch (e) {
        showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
}

function exportExcel() {
    const records = AttendanceDB.getAll().filter(r => r.status !== 'present');
    const data = [['วันที่', 'ชื่อ-นามสกุล', 'ห้อง', 'เวลา', 'สถานะ', 'มาสายเดือนนี้']];
    const curMonth = todayDate().slice(0, 7);
    records.forEach(r => {
        const s = StudentDB.getById(r.studentId);
        const statusLabel = ATT_STATUS?.[r.status]?.short || r.status;
        const monthLate = AttendanceDB.getMonthlyLateCount(r.studentId, curMonth);
        data.push([r.date, s ? `${s.firstName} ${s.lastName}` : '-', r.room, r.time || '-', statusLabel, monthLate]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AttendanceRecords');
    XLSX.writeFile(wb, 'attendance-report.xlsx');
    showToast('ดาวน์โหลด Excel แล้ว ✅', 'success');
}


// ===== USERS PAGE (Admin only) =====

function loadUsers() {
    if (!AuthDB.isAdmin()) {
        document.getElementById('page-users').innerHTML = `<div class="alert alert-danger">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>`;
        return;
    }
    renderUsersTable();
}

function renderUsersTable() {
    const users = DB.getAll(DB.TABLES.USERS);
    const tbody = document.getElementById('usersTableBody');
    const roleLabels = { 'admin': 'ผู้ดูแลระบบ', 'teacher': 'ครูประจำชั้น', 'duty': 'ครูเวร', 'executive': 'ผู้บริหาร' };
    const roleColors = { 'admin': 'badge-danger', 'teacher': 'badge-info', 'duty': 'badge-warning', 'executive': 'badge-success' };

    tbody.innerHTML = users.map(u => `<tr>
    <td>${escape(u.name)}</td>
    <td>${escape(u.username)}</td>
    <td><span class="badge ${roleColors[u.role] || 'badge-secondary'}">${roleLabels[u.role] || u.role}</span></td>
    <td>${escape(u.email || '-')}</td>
    <td>
      <button class="btn btn-sm btn-outline" onclick="editUser('${u.id}')">✏️ แก้ไข</button>
      ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteUser('${u.id}')">🗑</button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddUserModal() {
    document.getElementById('userModalTitle').textContent = '➕ เพิ่มผู้ใช้';
    document.getElementById('userForm').reset();
    document.getElementById('userEditId').value = '';
    // update user role options
    document.getElementById('userRole').innerHTML = `
      <option value="teacher">ครูประจำชั้น</option>
      <option value="duty">ครูเวร</option>
      <option value="executive">ผู้บริหาร (ดูอย่างเดียว)</option>
      <option value="admin">ผู้ดูแลระบบ</option>
    `;
    openModal('modalUser');
}

function editUser(id) {
    const u = DB.getById(DB.TABLES.USERS, id);
    if (!u) return;
    document.getElementById('userModalTitle').textContent = '✏️ แก้ไขผู้ใช้';
    document.getElementById('userEditId').value = id;
    document.getElementById('userNameInput').value = u.name;
    document.getElementById('userUsername').value = u.username;
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').innerHTML = `
      <option value="teacher">ครูประจำชั้น</option>
      <option value="duty">ครูเวร</option>
      <option value="executive">ผู้บริหาร (ดูอย่างเดียว)</option>
      <option value="admin">ผู้ดูแลระบบ</option>
    `;
    document.getElementById('userRole').value = u.role;
    document.getElementById('userEmail').value = u.email || '';
    openModal('modalUser');
}

function saveUser() {
    const id = document.getElementById('userEditId').value;
    const name = document.getElementById('userNameInput').value.trim();
    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const email = document.getElementById('userEmail').value.trim();
    if (!name || !username) { showToast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }
    if (!id && !password) { showToast('กรุณาตั้งรหัสผ่าน', 'warning'); return; }
    const data = { name, username, role, email };
    if (password) data.password = password;
    if (id) {
        DB.update(DB.TABLES.USERS, id, data);
        showToast('แก้ไขผู้ใช้แล้ว ✅', 'success');
    } else {
        DB.insert(DB.TABLES.USERS, data);
        showToast('เพิ่มผู้ใช้แล้ว ✅', 'success');
    }
    closeModal('modalUser');
    renderUsersTable();
}

function deleteUser(id) {
    if (!AuthDB.isAdmin()) return;
    const u = DB.getById(DB.TABLES.USERS, id);
    if (!confirm(`ต้องการลบผู้ใช้ ${u.name}?`)) return;
    DB.delete(DB.TABLES.USERS, id);
    showToast('ลบผู้ใช้แล้ว', 'success');
    renderUsersTable();
}

// ============================================================
// AUDIT LOGS
// ============================================================
function loadAuditLogs() {
    if (!AuthDB.isAdmin()) return;
    let logs = AuditLogDB.getAll();
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Check if table exists
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;

    if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="padding:40px"><div class="empty-icon">🧾</div><p>ไม่มีบันทึกข้อมูล</p></td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => {
        const d = new Date(l.timestamp);
        const df = d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH');
        return `<tr>
          <td><span style="font-size:0.85em;color:var(--text-muted)">${df}</span></td>
          <td><strong>${escape(l.userName)}</strong></td>
          <td><span class="badge badge-secondary">${l.module}</span></td>
          <td>${l.action.startsWith('CREATE') ? '🟢' : l.action.startsWith('UPDATE') ? '🟡' : l.action.startsWith('DELETE') ? '🔴' : '⚪'} ${l.action}</td>
          <td>${escape(l.details || '-')}</td>
        </tr>`;
    }).join('');
}
