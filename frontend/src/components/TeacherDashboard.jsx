import React, { useState, useEffect } from 'react';
import { teacherApi } from '../api';
import { Trash2, Plus, ArrowLeft, BarChart2, BookOpen, LogOut, Share2, Copy, CheckCircle, Edit2, Eye, EyeOff } from 'lucide-react';

function TeacherDashboard({ onBack }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSetup, setIsSetup] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // login, register, forgot
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1);
  const [tab, setTab] = useState('questions'); // questions, results
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);

  const [showPassword, setShowPassword] = useState(false);

  // New Question Form
  const [newQ, setNewQ] = useState({ text: '', options: ['', '', '', ''], correct_index: 0, timer_seconds: 30, test_name: '' });

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const res = await teacherApi.getSetupStatus();
      setIsSetup(res.data.is_setup);
      if (!res.data.is_setup) setAuthMode('register');
    } catch (err) {
      console.error("Error checking setup status", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, tab]);

  const loadData = async () => {
    try {
      if (tab === 'questions') {
        const res = await teacherApi.getQuestions(username);
        setQuestions(res.data);
      } else {
        const res = await teacherApi.getSubmissions(username);
        setResults(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await teacherApi.login(username, password);
      setIsAuthenticated(true);
      setError(''); setMsg('');
    } catch (err) {
      if (err.response?.status === 404) {
        setMsg("Account not found. Please set a security question to complete registration.");
        setAuthMode('register');
        setError('');
      } else {
        setError(err.response?.data?.detail || err.response?.data?.error || 'Invalid credentials');
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await teacherApi.register({ username, password, security_question: securityQuestion, security_answer: securityAnswer });
      setMsg('Registration successful! Please login.');
      setAuthMode('login');
      setError('');
      setUsername('');
      setPassword('');
      setSecurityQuestion('');
      setSecurityAnswer('');
      if (!isSetup) setIsSetup(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleGetQuestion = async (e) => {
    e.preventDefault();
    try {
      const res = await teacherApi.getSecurityQuestion(username);
      setSecurityQuestion(res.data.security_question);
      setForgotStep(2);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Username not found');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await teacherApi.resetPassword({ username, security_answer: securityAnswer, new_password: newPassword });
      setMsg('Password reset successful! Please login.');
      setAuthMode('login');
      setForgotStep(1);
      setError('');
      setPassword('');
      setNewPassword('');
      setSecurityAnswer('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      const qData = { ...newQ, teacher_username: username };
      if (editId) {
        await teacherApi.updateQuestion(editId, qData);
        alert('Question updated successfully');
      } else {
        await teacherApi.createQuestion(qData);
        alert('Question added successfully');
      }
      setNewQ({ text: '', options: ['', '', '', ''], correct_index: 0, timer_seconds: 30, test_name: newQ.test_name });
      setEditId(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error saving question');
    }
  };

  const handleEditClick = (q) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditId(q.id);
    setNewQ({
      text: q.text,
      options: [...q.options],
      correct_index: q.correct_index,
      timer_seconds: q.timer_seconds || 30,
      test_name: q.test_name || ''
    });
  };

  const handleDeleteQuestion = async (id) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await teacherApi.deleteQuestion(id);
        alert('Question deleted successfully');
        loadData();
      } catch (err) {
        alert('Failed to delete question. Please check backend connection.');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '500px', marginTop: '10vh' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '2rem' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="card">
          <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>
            {!isSetup ? 'System Initialization' : 
             authMode === 'login' ? 'Teacher Access' : 
             authMode === 'register' ? 'Register Teacher' : 'Reset Password'}
          </h2>
          
          {msg && <p style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>{msg}</p>}

          <div style={{ marginTop: '1rem' }}>
            {authMode === 'login' && (
              <form onSubmit={handleLogin}>
                <input className="input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? "text" : "password"} className="input" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '24px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {error && <p style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>Login</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {setAuthMode('forgot'); setForgotStep(1); setError(''); setMsg('');}}>Forgot Password?</span>
                  <span style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {setAuthMode('register'); setError(''); setMsg('');}}>Register New Teacher</span>
                </div>
              </form>
            )}

            {authMode === 'register' && (
              <form onSubmit={handleRegister}>
                {!isSetup && <p style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>Create the first Master Administrator account.</p>}
                <input className="input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? "text" : "password"} className="input" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '24px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <input className="input" placeholder="Security Question (e.g., First pet?)" value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} required />
                <input className="input" placeholder="Security Answer" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} required />
                {error && <p style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>Register</button>
                {isSetup && (
                  <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
                    <span style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {setAuthMode('login'); setError(''); setMsg('');}}>Back to Login</span>
                  </div>
                )}
              </form>
            )}

            {authMode === 'forgot' && (
              <div>
                {forgotStep === 1 ? (
                  <form onSubmit={handleGetQuestion}>
                    <input className="input" placeholder="Enter Username" value={username} onChange={e => setUsername(e.target.value)} required />
                    {error && <p style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
                    <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>Get Security Question</button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword}>
                    <p style={{ marginBottom: '1rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '0.5rem' }}>Q: {securityQuestion}</p>
                    <input className="input" placeholder="Your Answer" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} required />
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? "text" : "password"} className="input" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '24px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {error && <p style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
                    <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>Reset Password</button>
                  </form>
                )}
                <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {setAuthMode('login'); setError(''); setMsg('');}}>Back to Login</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '1rem' }}>
            <ArrowLeft size={18} /> Home
          </button>
          <h1>Teacher <span style={{ color: 'var(--primary)' }}>Control Panel</span></h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => {
            const studentUrl = `${window.location.origin}/?role=student`;
            navigator.clipboard.writeText(studentUrl);
            alert('Student Quiz Link copied to clipboard!');
          }}>
            <Share2 size={18} /> Share Quiz
          </button>
          <button className={`btn ${tab === 'questions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('questions')}>
            <BookOpen size={18} /> Questions
          </button>
          <button className={`btn ${tab === 'results' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('results')}>
            <BarChart2 size={18} /> Student Results
          </button>
          <button className="btn btn-secondary" onClick={() => setIsAuthenticated(false)}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {tab === 'questions' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{editId ? 'Edit Question' : 'Add New Question'}</h3>
            <form onSubmit={handleAddQuestion}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Test / Quiz Name</p>
              <input 
                className="input" 
                placeholder="e.g. Midterm, Quiz 1" 
                value={newQ.test_name} 
                onChange={e => setNewQ({...newQ, test_name: e.target.value})} 
                required 
              />

              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Question Content</p>
              <input 
                className="input" 
                placeholder="Question Text" 
                value={newQ.text} 
                onChange={e => setNewQ({...newQ, text: e.target.value})} 
                required 
              />
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Options (Select correct one)</p>
              {newQ.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input 
                    type="radio" 
                    name="correct" 
                    checked={newQ.correct_index === i} 
                    onChange={() => setNewQ({...newQ, correct_index: i})} 
                  />
                  <input 
                    className="input" 
                    style={{ marginBottom: 0 }} 
                    placeholder={`Option ${i+1}`} 
                    value={opt} 
                    onChange={e => {
                      const opts = [...newQ.options];
                      opts[i] = e.target.value;
                      setNewQ({...newQ, options: opts});
                    }} 
                    required 
                  />
                </div>
              ))}

              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>⏱️ Question Timer (seconds)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input 
                    type="range" 
                    min="5" 
                    max="300" 
                    step="5"
                    value={newQ.timer_seconds} 
                    onChange={e => setNewQ({...newQ, timer_seconds: parseInt(e.target.value)})}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontWeight: 700, minWidth: '3rem', color: 'var(--primary)' }}>{newQ.timer_seconds}s</span>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {editId ? <CheckCircle size={18} /> : <Plus size={18} />}
                  {editId ? 'Save Changes' : 'Add Question'}
                </button>
                {editId && (
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                    setEditId(null);
                    setNewQ({ text: '', options: ['', '', '', ''], correct_index: 0, timer_seconds: 30, test_name: newQ.test_name });
                  }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Current Question Bank ({questions.length})</h3>
            {questions.map((q, qidx) => (
              <div key={q.id} style={{ padding: '1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: 'rgba(99, 102, 241, 0.1)', 
                      color: 'var(--primary)', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '0.4rem',
                      display: 'inline-block',
                      marginBottom: '0.5rem',
                      marginRight: '0.5rem'
                    }}>
                      ⏱️ {q.timer_seconds}s Limit
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      color: 'var(--success)', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '0.4rem',
                      display: 'inline-block',
                      marginBottom: '0.5rem'
                    }}>
                      📝 {q.test_name || 'No Test Name'}
                    </span>
                    <p style={{ fontWeight: 600 }}>{qidx + 1}. {q.text}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleEditClick(q)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteQuestion(q.id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                  {q.options.map((opt, i) => (
                    <div key={i} style={{ 
                      fontSize: '0.9rem', 
                      padding: '0.5rem', 
                      borderRadius: '0.5rem',
                      background: i === q.correct_index ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                      color: i === q.correct_index ? 'var(--success)' : 'var(--text-muted)',
                      border: i === q.correct_index ? '1px solid var(--success)' : '1px solid transparent'
                    }}>
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Student Performance Report</h3>
          <table>
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Student Name</th>
                <th>Roll No</th>
                <th>Score</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.test_name || 'N/A'}</td>
                  <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                  <td>{r.roll_no}</td>
                  <td style={{ fontSize: '1.1rem', fontWeight: 700 }}>{r.score} / {r.total_questions}</td>
                  <td>{new Date(r.timestamp).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${r.score / r.total_questions >= 0.5 ? 'badge-success' : 'badge-error'}`} style={{ 
                      background: r.score / r.total_questions >= 0.5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: r.score / r.total_questions >= 0.5 ? '#10b981' : '#ef4444'
                    }}>
                      {r.score / r.total_questions >= 0.5 ? 'Passed' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
