const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
    const db = await open({
        filename: path.join(__dirname, 'quiz.db'),
        driver: sqlite3.Database
    });
    
    for(let i=1; i<=15; i++) {
        await db.run('INSERT OR IGNORE INTO teachers (username, password, security_question, security_answer) VALUES (?, ?, ?, ?)',
            [`teacher${i}`, 'password123', 'Favorite color?', 'blue']
        );
    }
    console.log("Seeded 15 teachers successfully. Defaults - Pass: password123, Answer to 'Favorite color?': blue");
})().catch(console.error);
