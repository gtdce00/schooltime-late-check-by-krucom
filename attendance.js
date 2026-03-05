// ===== ATTENDANCE PAGE (4-status system) =====
// สถานะ: present = มาเรียน, late = มาสาย, absent = ขาด, leave = ลา

let _attendanceSelectedRoom = '';
let _attendanceDate = todayDate();

// Status config
const ATT_STATUS = {
    present: { label: '✅ มาเรียน', cls: 'att-present', badge: 'badge-success', short: 'มาเรียน' },
    late: { label: '⏰ มาสาย', cls: 'att-late', badge: 'badge-warning', short: 'มาสาย' },
    absent: { label: '❌ ขาด', cls: 'att-absent', badge: 'badge-danger', short: 'ขาด' },
    leave: { label: '📝 ลา', cls: 'att-leave', badge: 'badge-info', short: 'ลา' },
};

// per-student status selection (map studentId → status)
let _attStatusMap = {};

function loadAttendance() {
    const rooms = StudentDB.getRooms();
    document.getElementById('attDateInput').value = _attendanceDate;

    // Set default time to current time if not already set
    const timeInput = document.getElementById('attTimeInput');
    if (!timeInput.value) {
        timeInput.value = new Date().toTimeString().slice(0, 5);
    }

    const roomSel = document.getElementById('attRoomSelect');
    roomSel.innerHTML = `<option value="">-- เลือกห้อง --</option>` +
        rooms.map(r => {
            const ds = AttendanceDB.getRoomDayStatus(r, _attendanceDate);
            const marker = ds.complete ? ' ✅' : ds.recorded > 0 ? ' 📝' : '';
            return `<option value="${r}" ${r === _attendanceSelectedRoom ? 'selected' : ''}>${r}${marker}</option>`;
        }).join('');

    if (_attendanceSelectedRoom) loadAttendanceStudents();
    else document.getElementById('attStudentSection').style.display = 'none';

    loadAttendanceRecords();
}

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('attDateInput');
    if (dateInput) {
        dateInput.addEventListener('change', e => {
            _attendanceDate = e.target.value;
            if (_attendanceSelectedRoom) loadAttendanceStudents();
            loadAttendanceRecords();
            loadAttendance(); // refresh room dropdown markers
        });
    }
});

function selectAttRoom(room) {
    _attendanceSelectedRoom = room;
    _attStatusMap = {};
    loadAttendanceStudents();
}

function loadAttendanceStudents() {
    if (!_attendanceSelectedRoom) return;
    document.getElementById('attStudentSection').style.display = 'block';
    document.getElementById('attRoomLabel').textContent = `ห้อง ${_attendanceSelectedRoom}`;

    const students = StudentDB.getByRoom(_attendanceSelectedRoom)
        .sort((a, b) => Number(a.studentNo) - Number(b.studentNo));

    // Load already-saved records for this date/room
    const savedRecs = AttendanceDB.getByDateRoom(_attendanceDate, _attendanceSelectedRoom);
    const savedMap = {}; // studentId → record
    savedRecs.forEach(r => { savedMap[r.studentId] = r; });

    // Pre-fill status map
    _attStatusMap = {};
    students.forEach(s => {
        _attStatusMap[s.id] = savedMap[s.id]?.status || 'present'; // default = present
    });

    const curMonth = _attendanceDate.slice(0, 7);

    const grid = document.getElementById('attStudentGrid');
    if (!students.length) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>ไม่มีนักเรียนในห้องนี้</p></div>`;
        return;
    }

    grid.innerHTML = students.map(s => {
        const monthLate = AttendanceDB.getMonthlyLateCount(s.id, curMonth);
        const status = _attStatusMap[s.id] || 'present';
        const isSaved = !!savedMap[s.id];
        const lateStatus = getMonthlyLateStatus(monthLate);

        return `
    <div class="att-student-card" id="attcard-${s.id}">
      <div class="att-student-info">
        <div class="att-student-no">${escape(s.studentNo)}</div>
        <div class="att-student-name">${escape(s.firstName)} ${escape(s.lastName)}</div>
        <div class="att-student-meta">
          <span class="badge ${lateStatus.badge}" title="มาสายเดือนนี้">${monthLate} ครั้ง/เดือน</span>
          ${isSaved ? `<span class="badge badge-secondary" style="font-size:.65rem">บันทึกแล้ว</span>` : ''}
        </div>
      </div>
      <div class="att-status-buttons" id="attbtn-${s.id}">
        ${Object.entries(ATT_STATUS).map(([key, cfg]) => `
          <button class="att-status-btn ${cfg.cls} ${status === key ? 'active' : ''}"
            onclick="setStudentStatus('${s.id}', '${key}')"
            title="${cfg.label}">
            ${key === 'present' ? '✅' : key === 'late' ? '⏰' : key === 'absent' ? '❌' : '📝'}
            <span class="att-btn-label">${cfg.short}</span>
          </button>`).join('')}
      </div>
      <div style="margin-top:12px; text-align:right;">
         <button class="btn btn-sm btn-primary" onclick="saveIndividual('${s.id}')" ${status === 'present' && !isSaved ? 'style="display:none"' : ''} id="attbtnsave-${s.id}">💾 บันทึกรายบุคคล</button>
      </div>
    </div>`;
    }).join('');

    updateAttSummaryBar(students);
}

function setStudentStatus(studentId, status) {
    _attStatusMap[studentId] = status;
    // Update button UI
    const btnGroup = document.getElementById(`attbtn-${studentId}`);
    if (!btnGroup) return;
    btnGroup.querySelectorAll('.att-status-btn').forEach(btn => btn.classList.remove('active'));
    const target = btnGroup.querySelector(`.${ATT_STATUS[status].cls}`);
    if (target) target.classList.add('active');

    // Toggle save individual button
    const saveBtn = document.getElementById(`attbtnsave-${studentId}`);
    if (saveBtn) {
        if (status !== 'present') {
            saveBtn.style.display = 'inline-block';
        } else {
            const date = _attendanceDate;
            const existing = AttendanceDB.getAll().find(r => r.studentId === studentId && r.date === date);
            saveBtn.style.display = existing ? 'inline-block' : 'none'; // if exist, show save so they can undo
        }
    }

    const students = StudentDB.getByRoom(_attendanceSelectedRoom);
    updateAttSummaryBar(students);
}

function updateAttSummaryBar(students) {
    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    students.forEach(s => {
        const st = _attStatusMap[s.id] || 'present';
        counts[st] = (counts[st] || 0) + 1;
    });
    document.getElementById('attSumPresent').textContent = counts.present;
    document.getElementById('attSumLate').textContent = counts.late;
    document.getElementById('attSumAbsent').textContent = counts.absent;
    document.getElementById('attSumLeave').textContent = counts.leave;
}

function setAllStatus(status) {
    const students = StudentDB.getByRoom(_attendanceSelectedRoom);
    students.forEach(s => setStudentStatus(s.id, status));
}

function saveIndividual(studentId) {
    const student = StudentDB.getById(studentId);
    if (!student) return;

    const date = _attendanceDate;
    const room = _attendanceSelectedRoom;
    const time = document.getElementById('attTimeInput')?.value || new Date().toTimeString().slice(0, 5);
    const note = document.getElementById('attNote')?.value || '';
    const status = _attStatusMap[studentId] || 'present';

    if (status === 'present') {
        const existing = AttendanceDB.getAll().find(r => r.studentId === studentId && r.date === date);
        if (existing) {
            DB.delete(DB.TABLES.ATTENDANCE, existing.id);
            showToast(`ยกเลิกบันทึก ${student.firstName} เรียบร้อย`, 'success');
        }
    } else {
        AttendanceDB.save(studentId, date, room, status, time, note);
        showToast(`บันทึก ${student.firstName} เป็น ${ATT_STATUS[status].short} (เวลา ${time}) เรียบร้อย ✅`, 'success');
        AuditLogDB.add('SAVE_ATTENDANCE', 'attendance', `บันทึกรายบุคคล: ${student.firstName} ${student.lastName} ห้อง ${room} (${status}) เวลา ${time}`);
    }

    updateNotifBadge();
    loadAttendanceStudents();
    loadAttendanceRecords();
    loadAttendance(); // refresh room markers
}

function saveAttendance() {
    const students = StudentDB.getByRoom(_attendanceSelectedRoom);
    if (!students.length) { showToast('ไม่มีนักเรียนในห้องนี้', 'warning'); return; }

    const date = _attendanceDate;
    const room = _attendanceSelectedRoom;
    const time = document.getElementById('attTimeInput')?.value || new Date().toTimeString().slice(0, 5);
    const note = document.getElementById('attNote')?.value || '';

    let changedCount = 0;
    students.forEach(s => {
        const status = _attStatusMap[s.id] || 'present';

        if (status === 'present') {
            // Delete record if they were marked something else but changed back to present
            const existing = AttendanceDB.getAll().find(r => r.studentId === s.id && r.date === date);
            if (existing) DB.delete(DB.TABLES.ATTENDANCE, existing.id);
        } else {
            AttendanceDB.save(s.id, date, room, status, time, note);
            changedCount++;
        }
    });

    const lateCount = Object.values(_attStatusMap).filter(v => v === 'late').length;
    const absentCount = Object.values(_attStatusMap).filter(v => v === 'absent').length;
    showToast(`บันทึกเรียบร้อย ✅ เฉพาะคนที่ไม่ได้มาเรียน (${changedCount} คน)`, 'success');

    AuditLogDB.add('SAVE_ATTENDANCE', 'attendance', `บันทึกเช็คชื่อ ห้อง ${room} วันที่ ${date} (มาสาย ${lateCount}, ขาด ${absentCount})`);

    updateNotifBadge();
    loadAttendanceStudents();
    loadAttendanceRecords();
    loadAttendance(); // refresh room markers
}

function loadAttendanceRecords() {
    const date = _attendanceDate;
    const records = AttendanceDB.getByDate(date);
    const tbody = document.getElementById('attRecordsBody');
    const curMonth = date.slice(0, 7);

    document.getElementById('attRecordCount').textContent = records.filter(r => r.status !== 'present').length;

    // Count summary
    const lateRecs = records.filter(r => r.status === 'late');
    const absRecs = records.filter(r => r.status === 'absent');
    const leaveRecs = records.filter(r => r.status === 'leave');

    document.getElementById('attTodayLate').textContent = lateRecs.length;
    document.getElementById('attTodayAbsent').textContent = absRecs.length;
    document.getElementById('attTodayLeave').textContent = leaveRecs.length;

    // Show non-present records
    const visible = records.filter(r => r.status !== 'present');
    if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">ไม่มีข้อมูล มาสาย/ขาด/ลา วันนี้ 🎉</td></tr>`;
        return;
    }

    tbody.innerHTML = visible.map(r => {
        const s = StudentDB.getById(r.studentId);
        const monthLate = AttendanceDB.getMonthlyLateCount(r.studentId, curMonth);
        const cfg = ATT_STATUS[r.status] || ATT_STATUS.present;
        const ms = getMonthlyLateStatus(monthLate);
        const isAdmin = AuthDB.isAdmin();

        const needsActivity = r.status === 'late' && monthLate >= 3;

        return `<tr>
      <td>${escape(s ? `${s.firstName} ${s.lastName}` : 'ไม่ทราบ')}</td>
      <td><span class="badge badge-secondary">${escape(r.room)}</span></td>
      <td>${r.time || '-'}</td>
      <td><span class="badge ${cfg.badge}">${cfg.short}</span></td>
      <td><span class="badge ${ms.badge}">${monthLate} ครั้ง/เดือน</span></td>
      <td>
        ${needsActivity ? `<button class="btn btn-sm btn-warning" onclick="promptAssignActivity('${s.id}')">📋 มอบหมายกิจกรรม</button>` : ''}
        ${isAdmin ? `<button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteRecord('${r.id}')">🗑</button>` : ''}
      </td>
    </tr>`;
    }).join('');
}

function deleteRecord(id) {
    if (!confirm('ต้องการลบบันทึกนี้ใช่ไหม?')) return;
    AttendanceDB.delete(id);
    showToast('ลบบันทึกแล้ว', 'success');
    loadAttendanceStudents();
    loadAttendanceRecords();
}

function promptAssignActivity(studentId) {
    const s = StudentDB.getById(studentId);
    if (!s) return;
    const curMonth = _attendanceDate.slice(0, 7);
    const monthLate = AttendanceDB.getMonthlyLateCount(studentId, curMonth);

    document.getElementById('assignActStudentId').value = studentId;
    document.getElementById('assignActStudentName').textContent =
        `${s.firstName} ${s.lastName} (${s.room}) — มาสาย ${monthLate} ครั้งในเดือนนี้`;

    const acts = ActivityDB.getAll();
    const sel = document.getElementById('assignActSelect');
    sel.innerHTML = `<option value="">-- เลือกกิจกรรม --</option>` +
        acts.map(a => {
            const d = difficultyLabel(a.difficulty);
            return `<option value="${a.id}">${a.name} — ${d.label}</option>`;
        }).join('');

    document.getElementById('assignActDate').value = todayDate();

    // Store month in hidden field
    document.getElementById('assignActMonth').value = curMonth;

    const teachers = DB.getAll(DB.TABLES.USERS);
    const tsel = document.getElementById('assignActTeacher');
    tsel.innerHTML = `<option value="">-- เลือกครู --</option>` +
        teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    openModal('modalAssignActivity');
}

function saveAssignActivity() {
    const studentId = document.getElementById('assignActStudentId').value;
    const activityId = document.getElementById('assignActSelect').value;
    const date = document.getElementById('assignActDate').value;
    const time = document.getElementById('assignActTime').value;
    const teacherId = document.getElementById('assignActTeacher').value;
    const note = document.getElementById('assignActNote').value;
    const month = document.getElementById('assignActMonth').value || todayDate().slice(0, 7);

    if (!activityId) { showToast('กรุณาเลือกกิจกรรม', 'warning'); return; }
    if (!teacherId) { showToast('กรุณาเลือกครูผู้ควบคุม', 'warning'); return; }

    StudentActivityDB.assign({ studentId, activityId, month, date, time, teacherId, note });
    closeModal('modalAssignActivity');
    showToast('มอบหมายกิจกรรมแล้ว ✅', 'success');
    loadAttendanceRecords();
}

function searchAttRecord() {
    const q = document.getElementById('attRecordSearch').value.trim().toLowerCase();
    document.querySelectorAll('#attRecordsBody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

// Helper: monthly status colour
function getMonthlyLateStatus(count) {
    if (count >= 3) return { badge: 'badge-danger', label: '🔴 ≥3 ครั้ง', cls: 'circle-danger' };
    if (count >= 2) return { badge: 'badge-warning', label: '🟡 2 ครั้ง', cls: 'circle-warning' };
    return { badge: 'badge-success', label: '🟢 0-1 ครั้ง', cls: 'circle-normal' };
}
