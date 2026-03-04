// ===== DATABASE LAYER (Firebase Realtime Database) =====

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyClse3E_j5Dc9kWnGQL-twDMK_V569ph2c",
    authDomain: "school-attendance-e8b3c.firebaseapp.com",
    databaseURL: "https://school-attendance-e8b3c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "school-attendance-e8b3c",
    storageBucket: "school-attendance-e8b3c.firebasestorage.app",
    messagingSenderId: "558777808990",
    appId: "1:558777808990:web:bab58b3f33e7c742841ccf",
    measurementId: "G-KBZ42CKPPW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global memory cache to keep the app synchronous
let _DB_CACHE = {};

const DB = {
    TABLES: {
        USERS: 'users',
        STUDENTS: 'students',
        CLASSROOMS: 'classrooms',
        ATTENDANCE: 'attendanceRecords',
        ACTIVITIES: 'activities',
        STUDENT_ACTIVITIES: 'studentActivities',
        NOTIFICATIONS: 'notifications',
        AUDIT_LOGS: 'auditLogs',
    },

    // ---- Generic CRUD (Synchronous using Cache) ----
    getAll(table) {
        // Fallback to localStorage if cache is empty (for offline start)
        if (!_DB_CACHE[table]) {
            _DB_CACHE[table] = JSON.parse(localStorage.getItem(table) || '[]');
        }
        return _DB_CACHE[table];
    },
    save(table, data) {
        _DB_CACHE[table] = data; // Update cache
        localStorage.setItem(table, JSON.stringify(data)); // Sync to local
        database.ref(table).set(data); // Sync to Firebase
    },
    getById(table, id) { return this.getAll(table).find(r => r.id === id) || null; },
    insert(table, record) {
        const all = this.getAll(table);
        record.id = record.id || this._uid();
        record.createdAt = record.createdAt || new Date().toISOString();
        all.push(record);
        this.save(table, all);
        return record;
    },
    update(table, id, updates) {
        const all = this.getAll(table);
        const idx = all.findIndex(r => r.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        this.save(table, all);
        return all[idx];
    },
    delete(table, id) {
        const all = this.getAll(table).filter(r => r.id !== id);
        this.save(table, all);
    },
    _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

    // ---- Initialization & Sync ----
    init() {
        Object.values(this.TABLES).forEach(table => {
            database.ref(table).on('value', (snapshot) => {
                const data = snapshot.val() || [];
                _DB_CACHE[table] = data;
                localStorage.setItem(table, JSON.stringify(data));

                // Re-render current page if visible
                if (window.currentPage) {
                    const loaderName = 'load' + window.currentPage.charAt(0).toUpperCase() + window.currentPage.slice(1);
                    if (typeof window[loaderName] === 'function') {
                        window[loaderName]();
                    }
                }
            });
        });
    },

    // ---- Seed default data ----
    seed() {
        database.ref(this.TABLES.USERS).once('value').then(snapshot => {
            if (!snapshot.exists() || !snapshot.val() || snapshot.val().length === 0) {
                this.insert(this.TABLES.USERS, {
                    id: 'admin001', username: 'admin', password: 'admin1234',
                    role: 'admin', name: 'ผู้ดูแลระบบ', email: 'admin@school.ac.th'
                });
                this.insert(this.TABLES.USERS, {
                    id: 'teacher001', username: 'teacher', password: 'teacher1234',
                    role: 'teacher', name: 'ครูประจำชั้น (Demo)', email: 'teacher@school.ac.th'
                });
            }
        });
    }
};

// Start sync immediately
DB.init();

// ============================================================
// Classroom helpers
// ============================================================
const ClassroomDB = {
    getAll() { return DB.getAll(DB.TABLES.CLASSROOMS); },
    getById(id) { return DB.getById(DB.TABLES.CLASSROOMS, id); },
    getByName(name) { return this.getAll().find(c => c.name === name) || null; },
    getByLevel(level) { return this.getAll().filter(c => c.level === level); },
    getLevels() { return [...new Set(this.getAll().map(c => c.level))].sort(); },
    getRoomNames() { return this.getAll().map(c => c.name).sort((a, b) => a.localeCompare(b, 'th')); },
    add(data) {
        if (this.getByName(data.name)) return { error: 'ชื่อห้องนี้มีอยู่แล้ว' };
        return DB.insert(DB.TABLES.CLASSROOMS, data);
    },
    update(id, data) { return DB.update(DB.TABLES.CLASSROOMS, id, data); },
    // Hard delete a single classroom
    delete(id) { return DB.delete(DB.TABLES.CLASSROOMS, id); },
    // Delete multiple classrooms at once (bulk)
    deleteMany(ids) {
        ids.forEach(id => DB.delete(DB.TABLES.CLASSROOMS, id));
    },
    getStats(roomName) {
        const students = StudentDB.getByRoom(roomName);
        // Fix UTC timezone to Thai local timezone by offsetting
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        const today = d.toISOString().slice(0, 10);
        const ym = today.slice(0, 7);
        const todayRecs = AttendanceDB.getByDateRoom(today, roomName);
        const monthLate = AttendanceDB.getByRoomMonth(roomName, ym).filter(r => r.status === 'late').length;
        const curMonth = today.slice(0, 7);
        const atRisk = students.filter(s => AttendanceDB.getMonthlyLateCount(s.id, curMonth) >= 3).length;
        return {
            studentCount: students.length,
            todayLate: todayRecs.filter(r => r.status === 'late').length,
            todayAbsent: todayRecs.filter(r => r.status === 'absent').length,
            monthLate,
            atRisk,
            totalLate: AttendanceDB.getByRoom(roomName).filter(r => r.status === 'late').length,
        };
    }
};

// ============================================================
// Student helpers
// ============================================================
const StudentDB = {
    getAll() { return DB.getAll(DB.TABLES.STUDENTS); },
    getActive() { return this.getAll().filter(s => s.status === 'active'); },
    getByRoom(room) { return this.getActive().filter(s => s.room === room); },
    getRooms() {
        const fromClassrooms = ClassroomDB.getRoomNames();
        const fromStudents = [...new Set(this.getActive().map(s => s.room))];
        return [...new Set([...fromClassrooms, ...fromStudents])].sort((a, b) => a.localeCompare(b, 'th'));
    },
    getById(id) { return DB.getById(DB.TABLES.STUDENTS, id); },
    add(data) {
        const dup = this.getAll().find(s =>
            s.firstName === data.firstName && s.lastName === data.lastName && s.room === data.room
        );
        if (dup) return { error: 'นักเรียนซ้ำในฐานข้อมูล' };
        return DB.insert(DB.TABLES.STUDENTS, { ...data, status: 'active' });
    },
    update(id, data) { return DB.update(DB.TABLES.STUDENTS, id, data); },
    // ---- Deletion helpers ----
    // Soft‑delete a single student (set status to 'inactive')
    delete(id) { DB.delete(DB.TABLES.STUDENTS, id); },
    // Soft‑delete multiple students at once (bulk)
    deleteMany(ids) {
        ids.forEach(id => {
            // Update the record to inactive instead of removing it completely
            const student = DB.getById(DB.TABLES.STUDENTS, id);
            if (student) {
                DB.update(DB.TABLES.STUDENTS, id, { status: 'inactive' });
            }
        });
    },
    getBehaviorScore(studentId) {
        const recs = AttendanceDB.getByStudent(studentId);
        let score = 100;
        recs.forEach(r => {
            if (r.status === 'late') score -= 5;
            if (r.status === 'absent') score -= 10;
        });
        return score;
    }
};

// ============================================================
// Attendance Records helpers  (status: present | late | absent | leave)
// ============================================================
const AttendanceDB = {
    getAll() { return DB.getAll(DB.TABLES.ATTENDANCE); },

    // ---- Filters ----
    getByDate(date) { return this.getAll().filter(r => r.date === date); },
    getByDateRoom(date, room) { return this.getByDate(date).filter(r => r.room === room); },
    getByStudent(studentId) { return this.getAll().filter(r => r.studentId === studentId); },
    getByRoom(room) { return this.getAll().filter(r => r.room === room); },
    getByRoomMonth(room, ym) {
        return this.getAll().filter(r => r.room === room && r.date && r.date.startsWith(ym));
    },

    // ---- Status shortcuts ----
    getLateByDate(date) { return this.getByDate(date).filter(r => r.status === 'late'); },
    getAbsentByDate(date) { return this.getByDate(date).filter(r => r.status === 'absent'); },
    getLeaveByDate(date) { return this.getByDate(date).filter(r => r.status === 'leave'); },
    getPresentByDate(date) { return this.getByDate(date).filter(r => r.status === 'present'); },

    // ---- Monthly late count for a student ----
    // Returns number of 'late' records this student has in the given month (YYYY-MM)
    getMonthlyLateCount(studentId, ym) {
        return this.getByStudent(studentId)
            .filter(r => r.status === 'late' && r.date && r.date.startsWith(ym))
            .length;
    },

    // ---- All 'late' records for monthly chart ----
    getMonthlyLateStats(year, month) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        return this.getAll().filter(r => r.status === 'late' && r.date && r.date.startsWith(prefix));
    },

    // ---- Add / update attendance ----
    // Saves one record per student per date (upsert by studentId+date)
    save(studentId, date, room, status, time, note) {
        const all = this.getAll();
        const existing = all.find(r => r.studentId === studentId && r.date === date);
        if (existing) {
            // update status
            DB.update(DB.TABLES.ATTENDANCE, existing.id, { status, time, note, room });
        } else {
            DB.insert(DB.TABLES.ATTENDANCE, { studentId, date, room, status, time, note });
        }
        // If late → check notifications
        if (status === 'late') {
            const student = StudentDB.getById(studentId);
            if (student) NotificationDB.checkAndCreate(student, date);
        }
    },

    delete(id) {
        DB.delete(DB.TABLES.ATTENDANCE, id);
    },

    getTodayCount() {
        // Fix UTC timezone to Thai local timezone by offsetting
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        const today = d.toISOString().slice(0, 10);
        return {
            late: this.getLateByDate(today).length,
            absent: this.getAbsentByDate(today).length,
            leave: this.getLeaveByDate(today).length,
            present: this.getPresentByDate(today).length,
        };
    },

    // ---- Check if date has been recorded for a room ----
    getRoomDayStatus(room, date) {
        const recs = this.getByDateRoom(date, room);
        const students = StudentDB.getByRoom(room);
        return {
            recorded: recs.length,
            total: students.length,
            complete: students.length > 0 && recs.length >= students.length
        };
    }
};

// ============================================================
// Activity helpers
// ============================================================
const ActivityDB = {
    getAll() { return DB.getAll(DB.TABLES.ACTIVITIES); },
    getById(id) { return DB.getById(DB.TABLES.ACTIVITIES, id); },
    add(data) { return DB.insert(DB.TABLES.ACTIVITIES, data); },
    update(id, data) { return DB.update(DB.TABLES.ACTIVITIES, id, data); },
    delete(id) { DB.delete(DB.TABLES.ACTIVITIES, id); }
};

// ============================================================
// Student Activities helpers  (month-aware)
// ============================================================
const StudentActivityDB = {
    getAll() { return DB.getAll(DB.TABLES.STUDENT_ACTIVITIES); },
    getByStudent(studentId) { return this.getAll().filter(r => r.studentId === studentId); },
    getByStudentMonth(studentId, ym) {
        return this.getByStudent(studentId).filter(r => r.month === ym);
    },
    getPending() { return this.getAll().filter(r => r.status === 'pending'); },
    getOverdue() {
        const now = new Date();
        return this.getPending().filter(r => {
            const created = new Date(r.createdAt);
            return (now - created) / (1000 * 60 * 60 * 24) >= 30;
        });
    },
    assign(data) {
        // data should include: studentId, activityId, month (YYYY-MM), date, time, teacherId, note
        return DB.insert(DB.TABLES.STUDENT_ACTIVITIES, { ...data, status: 'pending' });
    },
    updateStatus(id, status) { return DB.update(DB.TABLES.STUDENT_ACTIVITIES, id, { status }); },
    delete(id) { DB.delete(DB.TABLES.STUDENT_ACTIVITIES, id); }
};

// ============================================================
// Notification helpers
// ============================================================
const NotificationDB = {
    getAll() { return DB.getAll(DB.TABLES.NOTIFICATIONS); },
    getUnread() { return this.getAll().filter(n => !n.read); },
    add(data) { return DB.insert(DB.TABLES.NOTIFICATIONS, { ...data, read: false }); },
    markRead(id) { DB.update(DB.TABLES.NOTIFICATIONS, id, { read: true }); },
    markAllRead() {
        const all = this.getAll().map(n => ({ ...n, read: true }));
        DB.save(DB.TABLES.NOTIFICATIONS, all);
    },
    checkAndCreate(student, date) {
        const ym = date.slice(0, 7);  // YYYY-MM
        const monthCount = AttendanceDB.getMonthlyLateCount(student.id, ym);

        if (monthCount === 3) {
            // Check not already notified for this month
            const exists = this.getAll().find(n =>
                n.studentId === student.id && n.type === 'warning3' && n.month === ym
            );
            if (!exists) {
                this.add({
                    type: 'warning3', month: ym,
                    title: 'นักเรียนมาสาย 3 ครั้งในเดือนนี้',
                    message: `${student.firstName} ${student.lastName} (${student.room}) มาสายครบ 3 ครั้งในเดือน ${ym} กรุณามอบหมายกิจกรรมแก้ไขพฤติกรรม`,
                    studentId: student.id, icon: '⚠️'
                });
            }
        } else if (monthCount === 6) {
            const exists = this.getAll().find(n =>
                n.studentId === student.id && n.type === 'danger6' && n.month === ym
            );
            if (!exists) {
                this.add({
                    type: 'danger6', month: ym,
                    title: 'นักเรียนมาสายเกิน 6 ครั้ง — แจ้งผู้ปกครอง',
                    message: `${student.firstName} ${student.lastName} (${student.room}) มาสาย ${monthCount} ครั้งในเดือน ${ym}`,
                    studentId: student.id, icon: '🚨'
                });
            }
        }
        // Overdue activities
        const overdue = StudentActivityDB.getOverdue().filter(a => a.studentId === student.id);
        if (overdue.length > 0) {
            this.add({
                type: 'info',
                title: 'กิจกรรมค้างดำเนินการ',
                message: `${student.firstName} ${student.lastName} มีกิจกรรมที่ยังไม่ได้ทำเกิน 30 วัน`,
                studentId: student.id, icon: '📋'
            });
        }
    }
};

// ============================================================
// Auth helpers
// ============================================================
const AuthDB = {
    login(username, password) {
        return DB.getAll(DB.TABLES.USERS)
            .find(u => u.username === username && u.password === password) || null;
    },
    getCurrentUser() {
        const data = sessionStorage.getItem('currentUser');
        return data ? JSON.parse(data) : null;
    },
    setCurrentUser(user) { sessionStorage.setItem('currentUser', JSON.stringify(user)); },
    logout() { sessionStorage.removeItem('currentUser'); },
    isAdmin() { const u = this.getCurrentUser(); return u && u.role === 'admin'; },
    getRole() { const u = this.getCurrentUser(); return u ? u.role : null; },
    canEdit() {
        const role = this.getRole();
        return role === 'admin' || role === 'teacher' || role === 'duty';
    }
};

// ============================================================
// Audit Log helpers
// ============================================================
const AuditLogDB = {
    getAll() { return DB.getAll(DB.TABLES.AUDIT_LOGS); },
    add(action, module, details) {
        const user = AuthDB.getCurrentUser();
        DB.insert(DB.TABLES.AUDIT_LOGS, {
            action,
            module,
            details,
            userId: user ? user.id : 'system',
            userName: user ? user.name : 'System',
            timestamp: new Date().toISOString()
        });
    }
};

// ============================================================
// Data Export/Import
// ============================================================
const BackupDB = {
    exportDatabase() {
        const data = {};
        Object.values(DB.TABLES).forEach(table => {
            data[table] = DB.getAll(table);
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// ============================================================
// Backward compat aliases (so classrooms.js / old code still works)
// ============================================================
const LateRecordDB = {
    getAll() { return AttendanceDB.getAll().filter(r => r.status === 'late'); },
    getByDate(date) { return AttendanceDB.getLateByDate(date); },
    getByStudent(id) { return AttendanceDB.getByStudent(id).filter(r => r.status === 'late'); },
    getByRoom(room) { return AttendanceDB.getByRoom(room).filter(r => r.status === 'late'); },
    getMonthlyStats(year, month) { return AttendanceDB.getMonthlyLateStats(year, month); },
    getTodayCount() { return AttendanceDB.getTodayCount().late; },
    delete(id) { AttendanceDB.delete(id); },
};