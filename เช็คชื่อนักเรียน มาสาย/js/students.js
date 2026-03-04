// ===== STUDENTS PAGE =====

let _studentSearch = '';
let _studentRoomFilter = '';
let _studentPage = 1;
const _studentPerPage = 15;

function loadStudents() {
    renderStudentFilters();
    renderStudentTable();
}

function renderStudentFilters() {
    const rooms = StudentDB.getRooms();
    const roomSel = document.getElementById('studentRoomFilter');
    const current = roomSel.value;
    roomSel.innerHTML = `<option value="">ทุกห้อง</option>` +
        rooms.map(r => `<option value="${r}" ${r === current ? 'selected' : ''}>${r}</option>`).join('');
}

function renderStudentTable() {
    let students = StudentDB.getAll().filter(s => s.status === 'active');
    const q = _studentSearch.toLowerCase();
    if (q) students = students.filter(s =>
        `${s.firstName} ${s.lastName} ${s.room} ${s.studentNo}`.toLowerCase().includes(q)
    );
    if (_studentRoomFilter) students = students.filter(s => s.room === _studentRoomFilter);
    students.sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room, 'th');
        return Number(a.studentNo) - Number(b.studentNo);
    });

    document.getElementById('studentTotalCount').textContent = students.length;

    const total = Math.ceil(students.length / _studentPerPage) || 1;
    if (_studentPage > total) _studentPage = total;
    const start = (_studentPage - 1) * _studentPerPage;
    const paged = students.slice(start, start + _studentPerPage);

    const tbody = document.getElementById('studentTableBody');
    if (!paged.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding:40px">
      <div class="empty-icon">👥</div><p>ไม่พบนักเรียน</p></td></tr>`;
    } else {
        tbody.innerHTML = paged.map(s => {
            const curMonth = todayDate().slice(0, 7);
            const monthLate = AttendanceDB.getMonthlyLateCount(s.id, curMonth);
            const score = StudentDB.getBehaviorScore(s.id);
            const ms = getMonthlyLateStatus(monthLate);
            const isAdmin = AuthDB.canEdit();
            return `<tr>
        <td>${escape(s.studentNo)}</td>
        <td>
          <strong>${escape(s.firstName)} ${escape(s.lastName)}</strong>
        </td>
        <td><span class="badge badge-secondary">${escape(s.room)}</span></td>
        <td>
          <span class="badge ${ms.badge}">${monthLate} ครั้ง/เดือน</span>
        </td>
        <td>
          <span class="badge" style="background:${score >= 80 ? '#dcfce7' : score >= 60 ? '#fef3c7' : '#fee2e2'}; color:${score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'};">${score} คะแนน</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewStudentDetail('${s.id}')">📋 ดู</button>
          ${isAdmin ? `
            <button class="btn btn-sm btn-secondary" onclick="editStudent('${s.id}')" style="margin:0 4px">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.id}')">🗑</button>
          ` : ''}
        </td>
      </tr>`;
        }).join('');
    }

    // Pagination
    const paginEl = document.getElementById('studentPagination');
    let pHtml = '';
    if (total > 1) {
        pHtml += `<button class="btn btn-sm btn-secondary" onclick="studentGoPage(${_studentPage - 1})" ${_studentPage === 1 ? 'disabled' : ''}>‹</button>`;
        for (let i = 1; i <= total; i++) {
            pHtml += `<button class="btn btn-sm ${i === _studentPage ? 'btn-primary' : 'btn-secondary'}" onclick="studentGoPage(${i})">${i}</button>`;
        }
        pHtml += `<button class="btn btn-sm btn-secondary" onclick="studentGoPage(${_studentPage + 1})" ${_studentPage === total ? 'disabled' : ''}>›</button>`;
    }
    paginEl.innerHTML = pHtml;
}

function studentGoPage(p) {
    const max = Math.ceil(StudentDB.getAll().filter(s => s.status === 'active').length / _studentPerPage) || 1;
    _studentPage = Math.max(1, Math.min(p, max));
    renderStudentTable();
}

function searchStudents(q) {
    _studentSearch = q;
    _studentPage = 1;
    renderStudentTable();
}

function filterStudentRoom(room) {
    _studentRoomFilter = room;
    _studentPage = 1;
    renderStudentTable();
}

// ---- Add Single Student ----
function openAddStudentModal() {
    if (!AuthDB.isAdmin()) { showToast('ไม่มีสิทธิ์', 'error'); return; }
    document.getElementById('addStudentForm').reset();
    document.getElementById('addStudentRoomOther').style.display = 'none';
    populateRoomDropdown('addStudentRoom');
    openModal('modalAddStudent');
}

function populateRoomDropdown(selectId) {
    const rooms = StudentDB.getRooms();
    const sel = document.getElementById(selectId);
    const currentVal = sel.value;
    const defaultOpts = ['ม.1/1', 'ม.1/2', 'ม.1/3', 'ม.2/1', 'ม.2/2', 'ม.2/3', 'ม.3/1', 'ม.3/2', 'ม.3/3'];
    const allRooms = [...new Set([...defaultOpts, ...rooms])].sort();
    sel.innerHTML = `<option value="">-- เลือกห้อง --</option>` +
        allRooms.map(r => `<option value="${r}" ${r === currentVal ? 'selected' : ''}>${r}</option>`).join('') +
        `<option value="__other__">+ ห้องอื่น...</option>`;
}

function onRoomSelectChange(selectId, otherId) {
    const sel = document.getElementById(selectId);
    const other = document.getElementById(otherId);
    if (sel.value === '__other__') {
        other.style.display = 'block';
        other.focus();
    } else {
        other.style.display = 'none';
    }
}

function saveAddStudent() {
    const form = document.getElementById('addStudentForm');
    let room = document.getElementById('addStudentRoom').value;
    if (room === '__other__') room = document.getElementById('addStudentRoomOther').value.trim();
    const firstName = document.getElementById('addStudentFirst').value.trim();
    const lastName = document.getElementById('addStudentLast').value.trim();
    const studentNo = document.getElementById('addStudentNo').value.trim();

    if (!firstName || !lastName || !room) {
        showToast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return;
    }
    const result = StudentDB.add({ firstName, lastName, room, studentNo });
    if (result.error) { showToast(result.error, 'error'); return; }

    AuditLogDB.add('CREATE_STUDENT', 'students', `เพิ่มนักเรียน: ${firstName} ${lastName} (${room})`);

    closeModal('modalAddStudent');
    showToast(`เพิ่มนักเรียน ${firstName} ${lastName} แล้ว ✅`, 'success');
    renderStudentFilters();
    renderStudentTable();
}

// ---- Add Bulk (text) ----
function openBulkModal() {
    if (!AuthDB.isAdmin()) { showToast('ไม่มีสิทธิ์', 'error'); return; }
    populateRoomDropdown('bulkRoom');
    document.getElementById('bulkText').value = '';
    document.getElementById('bulkPreview').innerHTML = '';
    document.getElementById('bulkRoomOther').style.display = 'none';
    openModal('modalBulkAdd');
}

function parseBulkText() {
    const text = document.getElementById('bulkText').value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const students = [];
    lines.forEach((line, i) => {
        const parts = line.split(/[\t,]+/).map(p => p.trim());
        if (parts.length >= 2) {
            students.push({ firstName: parts[0], lastName: parts[1], studentNo: parts[2] || `${i + 1}` });
        } else if (parts.length === 1) {
            const nameParts = parts[0].split(' ');
            if (nameParts.length >= 2) {
                students.push({ firstName: nameParts[0], lastName: nameParts.slice(1).join(' '), studentNo: `${i + 1}` });
            }
        }
    });

    const preview = document.getElementById('bulkPreview');
    if (!students.length) {
        preview.innerHTML = `<div class="alert alert-warning">ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบ</div>`;
        return;
    }
    preview.innerHTML = `
    <div class="alert alert-info" style="margin-bottom:12px">พบ ${students.length} รายการ</div>
    <div class="preview-table-wrap">
    <table><thead><tr><th>#</th><th>ชื่อ</th><th>นามสกุล</th><th>เลขที่</th></tr></thead>
    <tbody>${students.map((s, i) => `<tr>
      <td>${i + 1}</td><td>${escape(s.firstName)}</td><td>${escape(s.lastName)}</td><td>${s.studentNo}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="mt-2">
      <button class="btn btn-primary" onclick="confirmBulkAdd()">✅ ยืนยันเพิ่ม ${students.length} คน</button>
    </div>`;
    preview._students = students;
}

function confirmBulkAdd() {
    let room = document.getElementById('bulkRoom').value;
    if (room === '__other__') room = document.getElementById('bulkRoomOther').value.trim();
    if (!room) { showToast('กรุณาเลือกห้อง', 'warning'); return; }
    const students = document.getElementById('bulkPreview')._students;
    if (!students || !students.length) return;
    let added = 0, dup = 0;
    students.forEach(s => {
        const res = StudentDB.add({ ...s, room });
        if (res.error) dup++;
        else added++;
    });

    if (added > 0) {
        AuditLogDB.add('BULK_ADD_STUDENTS', 'students', `เพิ่มนักเรียนหลายคนในห้อง ${room} (${added} คน)`);
    }

    closeModal('modalBulkAdd');
    showToast(`เพิ่มแล้ว ${added} คน${dup ? `, ซ้ำ ${dup} คน` : ''}`, 'success');
    renderStudentFilters();
    renderStudentTable();
}

// ---- Excel/CSV Upload ----
function openExcelModal() {
    if (!AuthDB.isAdmin()) { showToast('ไม่มีสิทธิ์', 'error'); return; }
    document.getElementById('excelPreview').innerHTML = '';
    document.getElementById('excelFileInput').value = '';
    populateRoomDropdown('excelRoom');
    document.getElementById('excelRoomOther').style.display = 'none';
    openModal('modalExcelUpload');
}

let _excelData = [];

function handleExcelFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = ev => parseCSV(ev.target.result);
        reader.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = ev => parseXLSX(ev.target.result);
        reader.readAsArrayBuffer(file);
    } else {
        showToast('รองรับเฉพาะไฟล์ .csv .xlsx .xls', 'error');
    }
}

function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    _excelData = [];
    lines.forEach((line, i) => {
        if (i === 0 && line.toLowerCase().includes('ชื่อ')) return; // skip header
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 2) {
            _excelData.push({ studentNo: cols[0] || `${i}`, firstName: cols[1], lastName: cols[2] || '' });
        }
    });
    renderExcelPreview();
}

function parseXLSX(buffer) {
    try {
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        _excelData = [];
        rows.forEach((row, i) => {
            if (i === 0) return; // skip header
            if (row.length >= 2) {
                _excelData.push({ studentNo: String(row[0] || i), firstName: String(row[1] || ''), lastName: String(row[2] || '') });
            }
        });
        renderExcelPreview();
    } catch (err) {
        showToast('ไม่สามารถอ่านไฟล์ Excel ได้', 'error');
    }
}

function renderExcelPreview() {
    const preview = document.getElementById('excelPreview');
    if (!_excelData.length) {
        preview.innerHTML = `<div class="alert alert-warning">ไม่พบข้อมูลในไฟล์</div>`;
        return;
    }
    preview.innerHTML = `
    <div class="alert alert-info" style="margin-bottom:12px">พบข้อมูล ${_excelData.length} แถว</div>
    <div class="preview-table-wrap">
    <table><thead><tr><th>เลขที่</th><th>ชื่อ</th><th>นามสกุล</th></tr></thead>
    <tbody>${_excelData.slice(0, 10).map(s => `<tr>
      <td>${escape(s.studentNo)}</td><td>${escape(s.firstName)}</td><td>${escape(s.lastName)}</td>
    </tr>`).join('')}
    ${_excelData.length > 10 ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">...และอีก ${_excelData.length - 10} แถว</td></tr>` : ''}
    </tbody></table></div>`;
}

function confirmExcelImport() {
    let room = document.getElementById('excelRoom').value;
    if (room === '__other__') room = document.getElementById('excelRoomOther').value.trim();
    if (!room) { showToast('กรุณาเลือกห้อง', 'warning'); return; }
    if (!_excelData.length) { showToast('ไม่มีข้อมูล', 'warning'); return; }
    let added = 0, dup = 0;
    _excelData.forEach(s => {
        if (!s.firstName) return;
        const res = StudentDB.add({ ...s, room });
        if (res.error) dup++;
        else added++;
    });

    if (added > 0) {
        AuditLogDB.add('IMPORT_EXCEL_STUDENTS', 'students', `นำเข้านักเรียน Excel เข้าห้อง ${room} (${added} คน)`);
    }

    closeModal('modalExcelUpload');
    showToast(`นำเข้าแล้ว ${added} คน${dup ? `, ซ้ำ ${dup} คน` : ''}`, 'success');
    renderStudentFilters();
    renderStudentTable();
}

// ---- Edit Student ----
function editStudent(id) {
    const s = StudentDB.getById(id);
    if (!s) return;
    document.getElementById('editStudentId').value = id;
    document.getElementById('editStudentFirst').value = s.firstName;
    document.getElementById('editStudentLast').value = s.lastName;
    document.getElementById('editStudentNo').value = s.studentNo;
    populateRoomDropdown('editStudentRoom');
    document.getElementById('editStudentRoom').value = s.room;
    openModal('modalEditStudent');
}

function saveEditStudent() {
    const id = document.getElementById('editStudentId').value;
    const firstName = document.getElementById('editStudentFirst').value.trim();
    const lastName = document.getElementById('editStudentLast').value.trim();
    const room = document.getElementById('editStudentRoom').value;
    const studentNo = document.getElementById('editStudentNo').value.trim();
    if (!firstName || !lastName || !room) { showToast('กรุณากรอกข้อมูลให้ครบ', 'warning'); return; }

    StudentDB.update(id, { firstName, lastName, room, studentNo });
    AuditLogDB.add('UPDATE_STUDENT', 'students', `แก้ไขข้อมูลนักเรียน: ${firstName} ${lastName}`);

    closeModal('modalEditStudent');
    showToast('แก้ไขข้อมูลแล้ว ✅', 'success');
    renderStudentFilters();
    renderStudentTable();
}

// ---- Delete Student ----
function deleteStudent(id) {
    const s = StudentDB.getById(id);
    if (!confirm(`แน่ใจหรือไม่ที่จะลบ ${s?.firstName} ${s?.lastName} ออกจากระบบ?\n(กด OK เพื่อเข้าสู่ขั้นตอนยืนยัน)`)) return;

    const secondConfirm = prompt(`พิมพ์คำว่า "CONFIRM" เพื่อยืนยันการลบนักเรียน ${s?.firstName}:`);
    if (secondConfirm !== 'CONFIRM') {
        showToast('ยกเลิกการลบข้อมูล', 'info');
        return;
    }

    StudentDB.update(id, { status: 'inactive' }); // soft delete
    AuditLogDB.add('DELETE_STUDENT', 'students', `ลบนักเรียน: ${s?.firstName} ${s?.lastName} (Soft Delete)`);
    showToast('ลบนักเรียนแล้ว', 'success');
    renderStudentFilters();
    renderStudentTable();
}

// ---- Student Detail ----
function viewStudentDetail(id) {
    const s = StudentDB.getById(id);
    if (!s) return;
    const records = AttendanceDB.getByStudent(id);
    const sActs = StudentActivityDB.getByStudent(id);
    const curMonth = todayDate().slice(0, 7);
    const monthLate = AttendanceDB.getMonthlyLateCount(id, curMonth);
    const score = StudentDB.getBehaviorScore(id);
    const ms = getMonthlyLateStatus(monthLate);

    document.getElementById('detailStudentName').textContent = `${s.firstName} ${s.lastName}`;
    document.getElementById('detailStudentRoom').textContent = `ห้อง ${s.room} | เลขที่ ${s.studentNo}`;
    document.getElementById('detailLateCount').innerHTML = `<span class="badge ${ms.badge}" style="font-size:1.1rem">${monthLate} ครั้ง/เดือน</span> 
    <span class="badge" style="font-size:1.1rem;background:${score >= 80 ? '#dcfce7' : score >= 60 ? '#fef3c7' : '#fee2e2'}; color:${score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'};">${score} คะแนน</span>`;

    document.getElementById('detailRecords').innerHTML = records.length ? records.slice().reverse().map(r => {
        const trClass = r.status === 'absent' ? 'style="color:var(--danger)"' : '';
        const stLabel = ATT_STATUS?.[r.status]?.short || r.status;
        return `<tr ${trClass}><td>${formatDate(r.date)}</td><td>${r.time || '-'}</td><td>${stLabel}</td><td>${r.note || '-'}</td></tr>`;
    }).join('') : `<tr><td colspan="4" style="color:var(--text-muted);text-align:center">ไม่มีบันทึก</td></tr>`;

    document.getElementById('detailActivities').innerHTML = sActs.length ? sActs.map(sa => {
        const a = ActivityDB.getById(sa.activityId);
        return `<tr>
      <td>${a ? a.name : '-'}</td>
      <td>${formatDate(sa.date)}</td>
      <td><span class="badge ${sa.status === 'done' ? 'badge-success' : 'badge-warning'}">${sa.status === 'done' ? 'เสร็จสิ้น' : 'รอดำเนินการ'}</span></td>
    </tr>`;
    }).join('') : `<tr><td colspan="3" style="color:var(--text-muted);text-align:center">ไม่มีกิจกรรม</td></tr>`;

    // Parent alert if behavior score is too low
    const parentAlert = document.getElementById('detailParentAlert');
    if (parentAlert) {
        parentAlert.style.display = score <= 60 ? 'block' : 'none';
        if (score <= 60) parentAlert.innerHTML = `⚠️ <strong>แจ้งเตือน!</strong> คะแนนความประพฤติเหลือน้อย (${score} คะแนน) ควรแจ้งฝ่ายปกครอง/ผู้ปกครอง`;
    }

    openModal('modalStudentDetail');
}

// Drag and drop for upload zone
function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            document.getElementById('excelFileInput').files = e.dataTransfer.files;
            handleExcelFile({ target: { files: e.dataTransfer.files } });
        }
    });
}

// setup once
document.addEventListener('DOMContentLoaded', setupDragDrop);
