const express = require('express');
const cors = require('cors');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'quiz_secret_key_8051';
const SALT_ROUNDS = 10;

// FIX #13: Restrict CORS to known local origins (set CORS_ORIGIN env var in production)
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:8000', 'http://127.0.0.1:5173', 'http://127.0.0.1:8000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin '${origin}' not allowed.`));
    }
}));
app.use(express.json());

// ── FIX #2: JWT Auth Middleware ───────────────────────────────────────────────
const requireAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"
    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.teacher = decoded.username;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    }
};

// Database setup
let db;
(async () => {
    const dbPath = process.env.VERCEL ? '/tmp/quiz.db' : path.join(__dirname, 'quiz.db');

    if (process.env.VERCEL) {
        const fs = require('fs');
        if (!fs.existsSync(dbPath) && fs.existsSync(path.join(__dirname, 'quiz.db'))) {
            fs.copyFileSync(path.join(__dirname, 'quiz.db'), dbPath);
        }
    }

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    console.log(`Connected to SQLite database at ${dbPath}.`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT,
            options TEXT,
            correct_index INTEGER,
            timer_seconds INTEGER DEFAULT 30,
            teacher_username TEXT,
            test_name TEXT
        );
        CREATE TABLE IF NOT EXISTS admin_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT,
            roll_no TEXT,
            score INTEGER,
            total_questions INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            teacher_username TEXT,
            test_name TEXT
        );
        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            security_question TEXT,
            security_answer TEXT
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT,
            roll_no TEXT,
            teacher_username TEXT,
            test_name TEXT,
            event_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Backward-compatibility column additions
    try { await db.exec(`ALTER TABLE questions ADD COLUMN teacher_username TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE questions ADD COLUMN test_name TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE questions ADD COLUMN timer_seconds INTEGER DEFAULT 30;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE submissions ADD COLUMN teacher_username TEXT;`); } catch (e) { }
    try { await db.exec(`ALTER TABLE submissions ADD COLUMN test_name TEXT;`); } catch (e) { }

    // FIX #1: Migrate any existing plaintext passwords to bcrypt hashes
    const allTeachers = await db.all('SELECT id, password FROM teachers');
    for (const t of allTeachers) {
        const isAlreadyHashed = t.password && (t.password.startsWith('$2b$') || t.password.startsWith('$2a$'));
        if (!isAlreadyHashed && t.password) {
            const hashed = await bcrypt.hash(t.password, SALT_ROUNDS);
            await db.run('UPDATE teachers SET password = ? WHERE id = ?', [hashed, t.id]);
        }
    }

    console.log('Database tables verified/created. Passwords migrated.');

    // FIX #12: Start server AFTER DB is ready — eliminates startup race condition
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Students can join at http://[YOUR-IP]:${PORT}`);
    });
})();

// --- Teacher Authentication & Setup ---
app.get('/api/teacher/setup-status', async (req, res) => {
    try {
        const adminTeacher = await db.get('SELECT * FROM teachers LIMIT 1');
        res.json({ is_setup: !!adminTeacher });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teacher/register', async (req, res) => {
    const { username, password, security_question, security_answer } = req.body;
    try {
        const countRes = await db.get('SELECT COUNT(*) as count FROM teachers');
        if (countRes.count >= 15) {
            return res.status(403).json({ error: 'Maximum of 15 teachers reached' });
        }
        // FIX #1: Hash password before storing
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await db.run(
            'INSERT INTO teachers (username, password, security_question, security_answer) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, security_question, security_answer]
        );
        res.json({ status: 'success', message: 'Teacher registered successfully' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/api/teacher/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const teacher = await db.get('SELECT * FROM teachers WHERE username = ?', [username]);

        if (!teacher) {
            return res.status(404).json({ detail: 'Teacher not found' });
        }

        // FIX #1: Compare with bcrypt
        const passwordMatch = await bcrypt.compare(password, teacher.password);
        if (!passwordMatch) {
            return res.status(401).json({ detail: 'Incorrect password' });
        }

        // FIX #2: Issue JWT token on successful login
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ status: 'success', message: 'Logged in', token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teacher/get-question', async (req, res) => {
    const { username } = req.body;
    try {
        const teacher = await db.get('SELECT security_question FROM teachers WHERE username = ?', [username]);
        if (!teacher) {
            return res.status(404).json({ detail: 'Username not found' });
        }
        res.json({ security_question: teacher.security_question });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teacher/reset-password', async (req, res) => {
    const { username, security_answer, new_password } = req.body;
    try {
        const teacher = await db.get('SELECT security_answer FROM teachers WHERE username = ?', [username]);
        if (!teacher) {
            return res.status(404).json({ detail: 'Username not found' });
        }
        if (teacher.security_answer.toLowerCase().trim() !== security_answer.toLowerCase().trim()) {
            return res.status(401).json({ detail: 'Incorrect security answer' });
        }
        // FIX #1: Hash the new password before storing
        const hashedNew = await bcrypt.hash(new_password, SALT_ROUNDS);
        await db.run('UPDATE teachers SET password = ? WHERE username = ?', [hashedNew, username]);
        res.json({ status: 'success', message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Question Management ---

app.get('/api/tests', async (req, res) => {
    try {
        const tests = await db.all(
            'SELECT DISTINCT test_name, teacher_username FROM questions WHERE test_name IS NOT NULL AND teacher_username IS NOT NULL'
        );
        res.json(tests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX #9: Return [] when no teacher_username provided (prevents exposing all questions)
app.get('/api/questions', async (req, res) => {
    const { teacher_username, test_name } = req.query;
    if (!teacher_username) return res.json([]);
    try {
        let query = 'SELECT * FROM questions WHERE teacher_username = ?';
        const params = [teacher_username];
        if (test_name) {
            query += ' AND test_name = ?';
            params.push(test_name);
        }
        const questions = await db.all(query, params);
        const parsedQuestions = questions.map(q => ({ ...q, options: JSON.parse(q.options) }));
        res.json(parsedQuestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX #2: Require JWT. Teacher username comes from token, not body.
// FIX #11: Validate all question fields before inserting
app.post('/api/questions', requireAuth, async (req, res) => {
    const { text, options, correct_index, timer_seconds, test_name } = req.body;
    const teacher_username = req.teacher;

    // Input validation
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Question text is required.' });
    }
    if (!Array.isArray(options) || options.length !== 4 || options.some(o => !o || o.trim() === '')) {
        return res.status(400).json({ error: 'Exactly 4 non-empty options are required.' });
    }
    if (typeof correct_index !== 'number' || correct_index < 0 || correct_index > 3) {
        return res.status(400).json({ error: 'correct_index must be a number between 0 and 3.' });
    }
    if (!test_name || typeof test_name !== 'string' || test_name.trim() === '') {
        return res.status(400).json({ error: 'Test name is required.' });
    }
    const timerVal = Number(timer_seconds);
    if (isNaN(timerVal) || timerVal < 5 || timerVal > 300) {
        return res.status(400).json({ error: 'timer_seconds must be between 5 and 300.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO questions (text, options, correct_index, timer_seconds, teacher_username, test_name) VALUES (?, ?, ?, ?, ?, ?)',
            [text.trim(), JSON.stringify(options.map(o => o.trim())), correct_index, timerVal, teacher_username, test_name.trim()]
        );
        res.status(201).json({ id: result.lastID, text, options, correct_index, timer_seconds: timerVal, teacher_username, test_name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX #2 + #4: JWT required + only owner can update
app.put('/api/questions/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { text, options, correct_index, timer_seconds, test_name } = req.body;
    const teacher_username = req.teacher;
    try {
        const result = await db.run(
            'UPDATE questions SET text = ?, options = ?, correct_index = ?, timer_seconds = ?, test_name = ? WHERE id = ? AND teacher_username = ?',
            [text, JSON.stringify(options), correct_index, timer_seconds, test_name, id, teacher_username]
        );
        if (result.changes === 0) {
            return res.status(403).json({ error: 'Not authorized to edit this question, or it was not found.' });
        }
        res.json({ id, text, options, correct_index, timer_seconds, teacher_username, test_name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX #2 + #4: JWT required + only owner can delete
app.delete('/api/questions/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const teacher_username = req.teacher;
    try {
        const result = await db.run(
            'DELETE FROM questions WHERE id = ? AND teacher_username = ?',
            [id, teacher_username]
        );
        if (result.changes === 0) {
            return res.status(403).json({ error: 'Not authorized to delete this question, or it was not found.' });
        }
        res.json({ message: 'Question deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Student Submissions ---

// FIX #3: Check for duplicate submission before inserting
app.post('/api/submissions', async (req, res) => {
    const { student_name, roll_no, score, total_questions, teacher_username, test_name } = req.body;
    const timestamp = new Date().toISOString();
    try {
        const existing = await db.get(
            'SELECT id FROM submissions WHERE roll_no = ? AND test_name = ? AND teacher_username = ?',
            [roll_no, test_name, teacher_username]
        );
        if (existing) {
            return res.status(409).json({ error: 'You have already submitted this test. Duplicate submissions are not allowed.' });
        }
        const result = await db.run(
            'INSERT INTO submissions (student_name, roll_no, score, total_questions, timestamp, teacher_username, test_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [student_name, roll_no, score, total_questions, timestamp, teacher_username, test_name]
        );
        res.status(201).json({ id: result.lastID, student_name, roll_no, score, total_questions, timestamp, teacher_username, test_name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX #2: Protected — teacher username comes from JWT, not query param
app.get('/api/submissions', requireAuth, async (req, res) => {
    const teacher_username = req.teacher;
    try {
        const submissions = await db.all(
            'SELECT * FROM submissions WHERE teacher_username = ? ORDER BY timestamp DESC',
            [teacher_username]
        );
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/submissions/stats', requireAuth, async (req, res) => {
    const teacher_username = req.teacher;
    try {
        const submissions = await db.all(
            'SELECT * FROM submissions WHERE teacher_username = ?',
            [teacher_username]
        );

        if (submissions.length === 0) {
            return res.json({ total_submissions: 0, average_score_pct: 0, pass_rate_pct: 0, tests: [] });
        }

        const totalSubmissions = submissions.length;
        let totalPct = 0;
        let passCount = 0;

        // Group by test
        const testMap = {};

        submissions.forEach(s => {
            const pct = (s.score / s.total_questions) * 100;
            totalPct += pct;
            if (pct >= 50) passCount++;

            const tName = s.test_name || 'Unnamed Test';
            if (!testMap[tName]) {
                testMap[tName] = { test_name: tName, count: 0, total_pct: 0, pass_count: 0 };
            }
            testMap[tName].count++;
            testMap[tName].total_pct += pct;
            if (pct >= 50) testMap[tName].pass_count++;
        });

        const tests = Object.values(testMap).map(t => ({
            test_name: t.test_name,
            count: t.count,
            avg_percentage: Math.round(t.total_pct / t.count),
            pass_count: t.pass_count
        }));

        res.json({
            total_submissions: totalSubmissions,
            average_score_pct: Math.round(totalPct / totalSubmissions),
            pass_rate_pct: Math.round((passCount / totalSubmissions) * 100),
            tests
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Proctoring Alerts ---

app.post('/api/alerts', async (req, res) => {
    const { student_name, roll_no, teacher_username, test_name, event_type } = req.body;
    console.log(`[ALERT] ${student_name} (${roll_no}) triggered ${event_type} on test ${test_name}`);
    try {
        await db.run(
            'INSERT INTO alerts (student_name, roll_no, teacher_username, test_name, event_type) VALUES (?, ?, ?, ?, ?)',
            [student_name, roll_no, teacher_username, test_name, event_type]
        );
        res.status(201).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/alerts', requireAuth, async (req, res) => {
    const teacher_username = req.teacher;
    try {
        const alerts = await db.all(
            'SELECT * FROM alerts WHERE teacher_username = ? ORDER BY created_at DESC LIMIT 100',
            [teacher_username]
        );
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Backup & Admin (Stubs) ---

app.post('/api/admin/backup', requireAuth, async (req, res) => {
    // Basic stub for manual backup triggering
    res.json({ message: 'Manual backup triggered (Simulation)' });
});

app.get('/api/admin/backups', requireAuth, async (req, res) => {
    // Basic stub for listing backups
    res.json([]);
});


// --- Serving Frontend ---
app.use(express.static(path.join(__dirname, 'frontend/dist')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});


7