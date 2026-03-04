// ===== CLASSROOMS PAGE =====

let _clsLevelFilter = '';
let _clsSearch = '';

function loadClassrooms() {
  renderClassroomLevelTabs();
  renderClassroomCards();
}

function renderClassroomLevelTabs() {
  const levels = ClassroomDB.getLevels();
  const tabBar = document.getElementById('clsLevelTabs');
  tabBar.innerHTML = `
    <button class="tab-btn ${_clsLevelFilter === '' ? 'active' : ''}" onclick="filterClsLevel('')">ทั้งหมด</button>
    ${levels.map(l => `
      <button class="tab-btn ${_clsLevelFilter === l ? 'active' : ''}" onclick="filterClsLevel('${l}')">
        ${l}
      </button>`).join('')}`;
}

function filterClsLevel(level) {
  _clsLevelFilter = level;
  renderClassroomLevelTabs();
  renderClassroomCards();
}

function renderClassroomCards() {
  let classrooms = ClassroomDB.getAll();

  const q = _clsSearch.toLowerCase();
  if (q) classrooms = classrooms.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.level || '').toLowerCase().includes(q) ||
    (c.description || '').toLowerCase().includes(q)
  );
  if (_clsLevelFilter) classrooms = classrooms.filter(c => c.level === _clsLevelFilter);

  classrooms.sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const grid = document.getElementById('clsCardGrid');
  document.getElementById('clsTotalCount').textContent = classrooms.length;

  if (!classrooms.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏫</div><p>ไม่พบห้องเรียน</p>
      <button class="btn btn-primary mt-2" onclick="openAddClassroomModal()">➕ สร้างห้องเรียนใหม่</button>
    </div>`;
    return;
  }

  const isAdmin = AuthDB.isAdmin();
  grid.innerHTML = classrooms.map(c => {
    const stats = ClassroomDB.getStats(c.name);
    const teacher = c.homeroomTeacherId
      ? DB.getById(DB.TABLES.USERS, c.homeroomTeacherId)
      : null;
    const color = c.color || '#2563eb';
    const riskPct = stats.studentCount > 0
      ? Math.round((stats.atRisk / stats.studentCount) * 100)
      : 0;

    return `
      <div class="cls-card" onclick="viewClassroomDetail('${c.id}')">
        <div class="cls-card-header" style="background:${color}">
          <div class="cls-card-name">${escape(c.name)}</div>
          <div class="cls-card-level">${escape(c.level || '')}</div>
          ${isAdmin ? `<div class="cls-card-actions" onclick="event.stopPropagation()">
            <button class="cls-action-btn" onclick="editClassroom('${c.id}')" title="แก้ไข">✏️</button>
            <button class="cls-action-btn" onclick="deleteClassroom('${c.id}')" title="ลบ">🗑</button>
          </div>` : ''}
        </div>
        <div class="cls-card-body">
          <div class="cls-stat-row">
            <div class="cls-stat">
              <div class="cls-stat-val">${stats.studentCount}</div>
              <div class="cls-stat-lbl">นักเรียน</div>
            </div>
            <div class="cls-stat">
              <div class="cls-stat-val ${stats.todayLate > 0 ? 'text-danger' : ''}">${stats.todayLate}</div>
              <div class="cls-stat-lbl">มาสายวันนี้</div>
            </div>
            <div class="cls-stat">
              <div class="cls-stat-val">${stats.totalLate}</div>
              <div class="cls-stat-lbl">บันทึกรวม</div>
            </div>
            <div class="cls-stat">
              <div class="cls-stat-val ${stats.atRisk > 0 ? 'text-warning' : ''}">${stats.atRisk}</div>
              <div class="cls-stat-lbl">เสี่ยง ≥3</div>
            </div>
          </div>
          ${stats.atRisk > 0 ? `
          <div class="cls-risk-bar" title="นักเรียนเสี่ยง ${riskPct}%">
            <div class="cls-risk-fill" style="width:${riskPct}%;background:${riskPct >= 30 ? 'var(--danger)' : 'var(--warning)'}"></div>
          </div>` : ''}
          <div class="cls-teacher">
            <span style="opacity:.6;font-size:.8rem">ครูที่ปรึกษา:</span>
            <span style="font-size:.85rem;font-weight:600">${teacher ? escape(teacher.name) : '<em style="opacity:.5">ยังไม่ระบุ</em>'}</span>
          </div>
          ${c.description ? `<div class="cls-desc">${escape(c.description)}</div>` : ''}
        </div>
        <div class="cls-card-footer">
          <button class="btn btn-sm btn-outline w-100" onclick="event.stopPropagation();viewClassroomDetail('${c.id}')">
            📋 ดูรายละเอียด
          </button>
        </div>
      </div>`;
  }).join('');
}

// ---- View Room Detail ----
function viewClassroomDetail(id) {
  const c = ClassroomDB.getById(id);
  if (!c) return;
  const stats = ClassroomDB.getStats(c.name);
  const teacher = c.homeroomTeacherId ? DB.getById(DB.TABLES.USERS, c.homeroomTeacherId) : null;
  const students = StudentDB.getByRoom(c.name).sort((a, b) => Number(a.studentNo) - Number(b.studentNo));
  const lateRecords = LateRecordDB.getByRoom(c.name);
  const color = c.color || '#2563eb';

  document.getElementById('clsDetailName').textContent = c.name;
  document.getElementById('clsDetailLevel').textContent = c.level || '';
  document.getElementById('clsDetailBadge').style.background = color;
  document.getElementById('clsDetailTeacher').textContent = teacher ? teacher.name : 'ยังไม่ระบุ';
  document.getElementById('clsDetailDesc').textContent = c.description || '-';
  document.getElementById('clsDetailStats').innerHTML = `
    <div class="stat-card blue" style="flex:1;min-width:120px">
      <div class="stat-icon" style="font-size:1.4rem">👥</div>
      <div class="stat-info"><div class="stat-value">${stats.studentCount}</div><div class="stat-label">นักเรียน</div></div>
    </div>
    <div class="stat-card red" style="flex:1;min-width:120px">
      <div class="stat-icon" style="font-size:1.4rem">⚠️</div>
      <div class="stat-info"><div class="stat-value">${stats.atRisk}</div><div class="stat-label">เสี่ยง (≥3 ครั้ง)</div></div>
    </div>
    <div class="stat-card yellow" style="flex:1;min-width:120px">
      <div class="stat-icon" style="font-size:1.4rem">📋</div>
      <div class="stat-info"><div class="stat-value">${stats.totalLate}</div><div class="stat-label">บันทึกรวม</div></div>
    </div>`;

  // Students table
  const curMonth = todayDate().slice(0, 7);
  document.getElementById('clsDetailStudents').innerHTML = students.length
    ? students.map(s => {
      const monthLate = AttendanceDB.getMonthlyLateCount(s.id, curMonth);
      const ms = getMonthlyLateStatus(monthLate);
      return `<tr>
          <td>${escape(s.studentNo)}</td>
          <td>${escape(s.firstName)} ${escape(s.lastName)}</td>
          <td><span class="badge ${ms.badge}">${monthLate} ครั้ง/เดือน</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="viewStudentDetail('${s.id}')">📋</button>
          </td>
        </tr>`;
    }).join('')
    : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">ไม่มีนักเรียนในห้องนี้</td></tr>`;

  // Late records chart
  const byDate = {};
  lateRecords.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + 1; });
  const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);

  let chartWrap = document.getElementById('clsDetailChartWrap');
  if (chartWrap) chartWrap.innerHTML = '<canvas id="clsDetailChart"></canvas>';
  const ctx = document.getElementById('clsDetailChart');

  if (_charts.clsDetail) _charts.clsDetail.destroy();
  if (ctx && sorted.length) {
    _charts.clsDetail = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(([d]) => {
          const dd = new Date(d);
          return dd.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
        }),
        datasets: [{
          label: 'มาสาย',
          data: sorted.map(([, c]) => c),
          backgroundColor: color + 'bb',
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }
      }
    });
  } else if (chartWrap) {
    chartWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">ยังไม่มีข้อมูลกราฟ</div>`;
  }

  openModal('modalClsDetail');
}

// ---- Add/Edit Classroom ----
function openAddClassroomModal() {
  if (!AuthDB.isAdmin()) { showToast('ไม่มีสิทธิ์', 'error'); return; }
  document.getElementById('clsModalTitle').textContent = '🏫 สร้างห้องเรียนใหม่';
  document.getElementById('clsForm').reset();
  document.getElementById('clsEditId').value = '';
  document.getElementById('clsColor').value = '#2563eb';
  populateClsTeacherDropdown('');
  openModal('modalClassroom');
}

function editClassroom(id) {
  if (!AuthDB.isAdmin()) { showToast('ไม่มีสิทธิ์', 'error'); return; }
  const c = ClassroomDB.getById(id);
  if (!c) return;
  document.getElementById('clsModalTitle').textContent = '✏️ แก้ไขห้องเรียน';
  document.getElementById('clsEditId').value = id;
  document.getElementById('clsName').value = c.name;
  document.getElementById('clsLevel').value = c.level || '';
  document.getElementById('clsSection').value = c.section || '';
  document.getElementById('clsDescription').value = c.description || '';
  document.getElementById('clsColor').value = c.color || '#2563eb';
  populateClsTeacherDropdown(c.homeroomTeacherId || '');
  openModal('modalClassroom');
}

function populateClsTeacherDropdown(selectedId) {
  const teachers = DB.getAll(DB.TABLES.USERS);
  const sel = document.getElementById('clsHomeroomTeacher');
  sel.innerHTML = `<option value="">-- ยังไม่ระบุ --</option>` +
    teachers.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.name} (${t.role === 'admin' ? 'Admin' : 'ครู'})</option>`).join('');
}

function saveClassroom() {
  const id = document.getElementById('clsEditId').value;
  const name = document.getElementById('clsName').value.trim();
  const level = document.getElementById('clsLevel').value.trim();
  const section = document.getElementById('clsSection').value.trim();
  const description = document.getElementById('clsDescription').value.trim();
  const color = document.getElementById('clsColor').value;
  const homeroomTeacherId = document.getElementById('clsHomeroomTeacher').value;

  if (!name || !level) { showToast('กรุณากรอกชื่อห้องและระดับชั้น', 'warning'); return; }

  const data = { name, level, section, description, color, homeroomTeacherId };

  if (id) {
    // if name changed, update all student records in old room
    const old = ClassroomDB.getById(id);
    if (old && old.name !== name) {
      // rename room in student records
      const allStudents = StudentDB.getAll().filter(s => s.room === old.name);
      allStudents.forEach(s => StudentDB.update(s.id, { room: name }));
      // rename room in attendance records
      const recs = AttendanceDB.getAll();
      recs.forEach(r => { if (r.room === old.name) DB.update(DB.TABLES.ATTENDANCE, r.id, { room: name }); });
      showToast(`เปลี่ยนชื่อห้องจาก "${old.name}" เป็น "${name}" — อัปเดตข้อมูลแล้ว`, 'info', 5000);
    }
    ClassroomDB.update(id, data);
    showToast('แก้ไขห้องเรียนแล้ว ✅', 'success');
  } else {
    const result = ClassroomDB.add(data);
    if (result && result.error) { showToast(result.error, 'error'); return; }
    showToast(`สร้างห้อง "${name}" แล้ว ✅`, 'success');
  }

  closeModal('modalClassroom');
  renderClassroomLevelTabs();
  renderClassroomCards();
}

function deleteClassroom(id) {
  const c = ClassroomDB.getById(id);
  if (!c) return;
  const stats = ClassroomDB.getStats(c.name);
  if (stats.studentCount > 0) {
    if (!confirm(`ห้อง "${c.name}" มีนักเรียน ${stats.studentCount} คน\nการลบห้องจะ**ไม่**ลบนักเรียนออก แต่นักเรียนจะไม่มีห้องเรียนในระบบ\n\nต้องการลบห้องนี้?`)) return;
  } else {
    if (!confirm(`ต้องการลบห้อง "${c.name}"?`)) return;
  }
  ClassroomDB.delete(id);
  showToast(`ลบห้อง "${c.name}" แล้ว`, 'success');
  renderClassroomLevelTabs();
  renderClassroomCards();
}

// ---- Quick Navigate to Attendance for a room ----
function goToAttendanceRoom(roomName) {
  closeModal('modalClsDetail');
  _attendanceSelectedRoom = roomName;
  navigateTo('attendance');
  setTimeout(() => {
    const sel = document.getElementById('attRoomSelect');
    if (sel) sel.value = roomName;
    loadAttendanceStudents();
  }, 100);
}

// ---- Go to students filtered by room ----
function goToStudentsRoom(roomName) {
  closeModal('modalClsDetail');
  _studentRoomFilter = roomName;
  navigateTo('students');
  setTimeout(() => {
    const sel = document.getElementById('studentRoomFilter');
    if (sel) sel.value = roomName;
    renderStudentTable();
  }, 100);
}
