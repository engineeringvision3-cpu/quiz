import React, { useState, useEffect } from 'react';
import './App.css';
import TeacherDashboard from './components/TeacherDashboard';
import StudentPortal from './components/StudentPortal';
import { LogIn, GraduationCap, Users } from 'lucide-react';

function App() {
  const [view, setView] = useState('landing'); // landing, teacher, student

  useEffect(() => {
    // Check for direct role access in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'student') {
      setView('student');
    }
  }, []);

  if (view === 'teacher') return <TeacherDashboard onBack={() => setView('landing')} />;
  if (view === 'student') return <StudentPortal onBack={() => setView('landing')} />;

  return (
    <div className="container animate-fade-in">
      <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 700, marginBottom: '1rem' }}>
          <span style={{ color: 'var(--primary)' }}>Quiz</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
          The ultimate assessment platform for your classroom.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <GraduationCap size={48} color="var(--primary)" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '1rem' }}>Student Portal</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Enter your details and start your assessment.
          </p>
          <button className="btn btn-primary" onClick={() => setView('student')}>
            Take Quiz Now
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <Users size={48} color="var(--accent)" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '1rem' }}>Teacher Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Manage the question bank and view student performance reports in real-time.
          </p>
          <button className="btn btn-secondary" onClick={() => setView('teacher')}>
            Login as Teacher
          </button>
        </div>
      </div>

      <footer style={{ marginTop: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>&copy; 2026 Quiz Mastery System. Designed for Engineering Excellence.</p>
      </footer>
    </div>
  );
}

export default App;
