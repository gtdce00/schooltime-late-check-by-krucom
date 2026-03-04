// ===== DASHBOARD PAGE =====

function loadDashboard() {
    const todayStr = todayDate();
    const curMonth = todayStr.slice(0, 7);
    const allStudents = StudentDB.getActive();
    const todayCounts = AttendanceDB.getTodayCount();
    const pendingActs = StudentActivityDB.getPending();
    const overdueActs = StudentActivityDB.getOverdue();

    const btnExportDb = document.getElementById('btnExportDb');
    const btnResetDb = document.getElementById('btnResetDb');
    if (btnExportDb && btnResetDb) {
        const d = AuthDB.isAdmin() ? 'inline-block' : 'none';
        btnExportDb.style.display = d;
        btnResetDb.style.display = d;
    }

    // ---- Stat Cards ----
    const tLate = todayCounts.late;
    const tAbsent = todayCounts.absent;
    const tLeave = todayCounts.leave;
    const total = allStudents.length || 1;
    const pLate = Math.round((tLate / total) * 100);
    const pAbsent = Math.round((tAbsent / total) * 100);
    const pLeave = Math.round((tLeave / total) * 100);
    const pPresent = Math.round(((total - tLate - tAbsent - tLeave) / total) * 100);

    document.getElementById('statTodayLate').innerHTML = `${tLate} <span style="font-size:0.55em;opacity:0.8;font-weight:400">(${pLate}%)</span>`;
    document.getElementById('statTodayAbsent').innerHTML = `${tAbsent} <span style="font-size:0.55em;opacity:0.8;font-weight:400">(${pAbsent}%)</span>`;
    document.getElementById('statTodayLeave').innerHTML = `${tLeave} <span style="font-size:0.55em;opacity:0.8;font-weight:400">(${pLeave}%)</span>`;
    document.getElementById('statTotal').innerHTML = `${allStudents.length} <span style="font-size:0.55em;opacity:0.8;font-weight:400">(มาเรียน ${pPresent}%)</span>`;
    document.getElementById('statPendingActs').textContent = pendingActs.length;
    document.getElementById('statOverdue').textContent = overdueActs.length;

    // Monthly late this month
    const monthLateAll = AttendanceDB.getAll().filter(
        r => r.status === 'late' && r.date && r.date.startsWith(curMonth)
    );
    document.getElementById('statMonthLate').textContent = monthLateAll.length;

    // ---- Top room (by late today) ----
    const allLate = AttendanceDB.getAll().filter(r => r.status === 'late');
    const roomCounts = {};
    allLate.forEach(r => { roomCounts[r.room] = (roomCounts[r.room] || 0) + 1; });
    const topRoom = Object.entries(roomCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('statTopRoom').textContent = topRoom ? `${topRoom[0]} (${topRoom[1]} ครั้ง)` : '-';

    // ---- Top students THIS MONTH ----
    const monthLateByStudent = {};
    monthLateAll.forEach(r => {
        monthLateByStudent[r.studentId] = (monthLateByStudent[r.studentId] || 0) + 1;
    });
    const topStudents = Object.entries(monthLateByStudent)
        .sort((a, b) => b[1] - a[1]).slice(0, 5);

    const tbody = document.getElementById('topStudentsBody');
    if (!topStudents.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">ยังไม่มีข้อมูลเดือนนี้</td></tr>`;
    } else {
        tbody.innerHTML = topStudents.map(([id, cnt], i) => {
            const s = StudentDB.getById(id);
            const ms = getMonthlyLateStatus(cnt);
            return `<tr>
        <td><strong>${i + 1}</strong></td>
        <td>${escape(s ? `${s.firstName} ${s.lastName}` : '-')}</td>
        <td><span class="badge badge-secondary">${escape(s?.room || '-')}</span></td>
        <td><span class="badge ${ms.badge}">${cnt} ครั้ง</span></td>
      </tr>`;
        }).join('');
    }

    // ---- Today's non-present list ----
    const todayRecords = AttendanceDB.getByDate(todayStr).filter(r => r.status !== 'present');
    const todayBody = document.getElementById('todayLateBody');
    if (!todayRecords.length) {
        todayBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">ไม่มีนักเรียนมาสาย/ขาด/ลา วันนี้ 🎉</td></tr>`;
    } else {
        todayBody.innerHTML = todayRecords.map(r => {
            const s = StudentDB.getById(r.studentId);
            const cfg = ATT_STATUS?.[r.status] || { short: r.status, badge: 'badge-secondary' };
            return `<tr>
        <td>${escape(s ? `${s.firstName} ${s.lastName}` : '-')}</td>
        <td><span class="badge badge-secondary">${escape(r.room)}</span></td>
        <td>${r.time || '-'}</td>
        <td><span class="badge ${cfg.badge}">${cfg.short}</span></td>
        <td><span class="badge ${getMonthlyLateStatus(AttendanceDB.getMonthlyLateCount(r.studentId, curMonth)).badge}">${AttendanceDB.getMonthlyLateCount(r.studentId, curMonth)} ครั้ง/เดือน</span></td>
      </tr>`;
        }).join('');
    }

    // ---- Overdue activity alerts ----
    const alertContainer = document.getElementById('overdueAlerts');
    if (overdueActs.length) {
        alertContainer.innerHTML = overdueActs.map(act => {
            const s = StudentDB.getById(act.studentId);
            const a = ActivityDB.getById(act.activityId);
            return `<div class="alert alert-warning">
        ⚠️ <strong>${s ? `${s.firstName} ${s.lastName}` : ''}</strong>
        ยังไม่ทำกิจกรรม "${a ? a.name : ''}" เกิน 30 วัน
      </div>`;
        }).join('');
        alertContainer.style.display = 'block';
    } else {
        alertContainer.innerHTML = '';
        alertContainer.style.display = 'none';
    }

    renderMonthlyChart();
    renderStatusChart();
}

function renderMonthlyChart() {
    const now = new Date();
    const labels = [];
    const lateData = [];
    const absentData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const prefix = `${y}-${String(m).padStart(2, '0')}`;
        labels.push(d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }));
        const recs = AttendanceDB.getAll().filter(r => r.date && r.date.startsWith(prefix));
        lateData.push(recs.filter(r => r.status === 'late').length);
        absentData.push(recs.filter(r => r.status === 'absent').length);
    }
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    if (_charts.monthly) _charts.monthly.destroy();
    _charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'มาสาย', data: lateData, backgroundColor: 'rgba(217,119,6,.8)', borderRadius: 6, borderSkipped: false },
                { label: 'ขาด', data: absentData, backgroundColor: 'rgba(220,38,38,.75)', borderRadius: 6, borderSkipped: false },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: { family: 'Sarabun' } } } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderStatusChart() {
    const todayStr = todayDate();
    const recs = AttendanceDB.getByDate(todayStr);
    const ctx = document.getElementById('roomChart');
    if (!ctx) return;
    if (_charts.room) _charts.room.destroy();
    const counts = {
        'มาเรียน': recs.filter(r => r.status === 'present').length,
        'มาสาย': recs.filter(r => r.status === 'late').length,
        'ขาด': recs.filter(r => r.status === 'absent').length,
        'ลา': recs.filter(r => r.status === 'leave').length,
    };
    _charts.room = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['rgba(22,163,74,.8)', 'rgba(217,119,6,.8)', 'rgba(220,38,38,.8)', 'rgba(14,165,233,.8)'],
                borderWidth: 2, borderColor: '#fff',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { font: { family: 'Sarabun' } } } },
            cutout: '65%'
        }
    });
}
