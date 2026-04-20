const express = require('express');
const cors = require('cors');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
let db;
(async () => {
    db = await open({
        filename: path.join(__dirname, 'quiz.db'),
        driver: sqlite3.Database
    });
    console.log('Connected to SQLite database.');

    // Initialize tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT,
            options TEXT,
            correct_index INTEGER,
            timer_seconds INTEGER DEFAULT 30
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
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            security_question TEXT,
            security_answer TEXT
        );
    `);
    console.log('Database tables verified/created.');
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
        // Check how many teachers exist limit to 15
        const countRes = await db.get('SELECT COUNT(*) as count FROM teachers');
        if (countRes.count >= 15) {
            return res.status(403).json({ error: 'Maximum of 15 teachers reached' });
        }
        await db.run(
            'INSERT INTO teachers (username, password, security_question, security_answer) VALUES (?, ?, ?, ?)',
            [username, password, security_question, security_answer]
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
        
        if (teacher.password !== password) {
            return res.status(401).json({ detail: 'Incorrect password' });
        }
        
        res.json({ status: 'success', message: 'Logged in' });
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
        await db.run('UPDATE teachers SET password = ? WHERE username = ?', [new_password, username]);
        res.json({ status: 'success', message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Question Management (Teacher) ---
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await db.all('SELECT * FROM questions');
        // Parse options JSON
        const parsedQuestions = questions.map(q => ({
            ...q,
            options: JSON.parse(q.options)
        }));
        res.json(parsedQuestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/questions', async (req, res) => {
    const { text, options, correct_index, timer_seconds } = req.body;
    try {
        const result = await db.run(
            'INSERT INTO questions (text, options, correct_index, timer_seconds) VALUES (?, ?, ?, ?)',
            [text, JSON.stringify(options), correct_index, timer_seconds]
        );
        res.status(201).json({ id: result.lastID, text, options, correct_index, timer_seconds });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/questions/:id', async (req, res) => {
    const { id } = req.params;
    const { text, options, correct_index, timer_seconds } = req.body;
    try {
        await db.run(
            'UPDATE questions SET text = ?, options = ?, correct_index = ?, timer_seconds = ? WHERE id = ?',
            [text, JSON.stringify(options), correct_index, timer_seconds, id]
        );
        res.json({ id, text, options, correct_index, timer_seconds });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/questions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM questions WHERE id = ?', id);
        res.json({ message: 'Question deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Student Submissions ---
app.post('/api/submissions', async (req, res) => {
    const { student_name, roll_no, score, total_questions } = req.body;
    const timestamp = new Date().toISOString();
    try {
        const result = await db.run(
            'INSERT INTO submissions (student_name, roll_no, score, total_questions, timestamp) VALUES (?, ?, ?, ?, ?)',
            [student_name, roll_no, score, total_questions, timestamp]
        );
        res.status(201).json({ id: result.lastID, student_name, roll_no, score, total_questions, timestamp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/submissions', async (req, res) => {
    try {
        const submissions = await db.all('SELECT * FROM submissions ORDER BY timestamp DESC');
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Serving Frontend ---
// Serve static files from the React app dist folder
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Students can join at http://[YOUR-IP]:${PORT}`);
});
