import React, { useState, useEffect, useCallback } from 'react';
import { teacherApi } from '../api';
import { Trash2, Plus, ArrowLeft, BarChart2, BookOpen, LogOut, Share2, Copy, CheckCircle, Edit2, Eye, EyeOff, X, Bell } from 'lucide-react';

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
  const [tab, setTab] = useState('questions'); // questions, results, monitor
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ total_submissions: 0, average_score_pct: 0, pass_rate_pct: 0, tests: [] });
  const [backupFiles, setBackupFiles] = useState([]);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // FIX #10: Toast notification system — replaces all alert()
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Delete confirmation state (replaces window.confirm)
  const [deleteTarget, setDeleteTarget] = useState(null); // question id to delete

  // New Question Form
  const [newQ, setNewQ] = useState({ text: '', options: ['', ''], correct_index: 0, timer_seconds: 30, test_name: '' });

  // FIX #15: Results filter state
  const [resultFilter, setResultFilter] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

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

  useEffect(() => {
    if (!isAuthenticated || tab !== 'monitor') return;
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, tab]);

  const loadData = async () => {
    try {
      if (tab === 'questions') {
        const res = await teacherApi.getQuestions(username);
        setQuestions(res.data);
      } else if (tab === 'results') {
        const [submissionsRes, statsRes] = await Promise.all([teacherApi.getSubmissions(), teacherApi.getSubmissionStats()]);
        setResults(submissionsRes.data);
        setStats(statsRes.data);
      } else if (tab === 'monitor') {
        if (alerts.length === 0) setAlertsLoading(true);
        const res = await teacherApi.getAlerts();
        setAlerts(res.data);
        setAlertsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setAlertsLoading(false);
    }
  };

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const res = await teacherApi.listBackups();
      setBackupFiles(res.data);
    } catch (err) {
      console.error('Failed to load backups', err);
      showToast('Unable to load backup list.', 'error');
    }
    setBackupLoading(false);
  };

  const handleBackupNow = async () => {
    setBackupLoading(true);
    try {
      const res = await teacherApi.createBackup();
      showToast('Backup created successfully ✅', 'success');
      await loadBackups();
      setMsg(res.data.message || 'Backup created successfully.');
    } catch (err) {
      console.error('Backup failed', err);
      showToast('Backup creation failed.', 'error');
    }
    setBackupLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await teacherApi.login(username, password);
      // FIX #2 & #8: Save JWT token securely in localStorage
      if (res.data.token) {
        localStorage.setItem('teacher_token', res.data.token);
      }
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
        showToast('Question updated successfully ✅', 'success');
      } else {
        await teacherApi.createQuestion(qData);
        showToast('Question added successfully ✅', 'success');
      }
      setNewQ({ text: '', options: ['', ''], correct_index: 0, timer_seconds: 30, test_name: newQ.test_name });
      setEditId(null);
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Error saving question';
      showToast(msg, 'error');
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
    // FIX #10: Use in-UI confirmation modal instead of window.confirm()
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await teacherApi.deleteQuestion(id);
      showToast('Question deleted successfully ✅', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to delete question.', 'error');
    }
  };

  const handleCopyLink = (url) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('✅ Link copied to clipboard!', 'success'))
        .catch(() => {
          const el = document.getElementById('share-url-text');
          const range = document.createRange();
          range.selectNode(el);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
          showToast('⚠️ Auto-copy failed. Please manually copy the highlighted link.', 'error');
        });
    } else {
      const el = document.getElementById('share-url-text');
      const range = document.createRange();
      range.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      showToast('⚠️ Auto-copy not supported. Please manually copy the highlighted link.', 'error');
    }
  };

  // ── Auth Screen ──────────────────────────────────────────────────────────────
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

  // ── Dashboard (authenticated) ────────────────────────────────────────────────
  const studentUrl = `${window.location.origin}/?role=student`;

  return (
    <div className="container animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '1rem' }}>
            <ArrowLeft size={18} /> Home
          </button>
          <h1>Teacher <span style={{ color: 'var(--primary)' }}>Control Panel</span></h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowShareModal(true)}>
            <Share2 size={18} /> Share Quiz
          </button>
          <button className="btn btn-secondary" onClick={() => { setBackupModalOpen(true); loadBackups(); }}>
            <Copy size={18} /> Backup DB
          </button>
          <button className={`btn ${tab === 'questions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('questions')}>
            <BookOpen size={18} /> Questions
          </button>
          <button className={`btn ${tab === 'results' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('results')}>
            <BarChart2 size={18} /> Student Results
          </button>
          <button className={`btn ${tab === 'monitor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('monitor')}>
            <Bell size={18} /> Monitor {alerts.length > 0 ? `(${alerts.length})` : ''}
          </button>
          <button className="btn btn-secondary" onClick={() => {
            // FIX #8: Full state cleanup on logout — clear token and all sensitive data
            localStorage.removeItem('teacher_token');
            setIsAuthenticated(false);
            setUsername('');
            setPassword('');
            setQuestions([]);
            setResults([]);
            setError('');
            setMsg('');
            setTab('questions');
          }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Questions Tab */}
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
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Options (Select correct one) — {newQ.options.length} option{newQ.options.length === 1 ? '' : 's'}</p>
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
                    style={{ marginBottom: 0, flex: 1 }} 
                    placeholder={`Option ${i+1}`} 
                    value={opt} 
                    onChange={e => {
                      const opts = [...newQ.options];
                      opts[i] = e.target.value;
                      setNewQ({...newQ, options: opts});
                    }} 
                    required 
                  />
                  {newQ.options.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ minWidth: '80px', padding: '0.65rem 0.9rem' }}
                      onClick={() => {
                        const opts = newQ.options.filter((_, idx) => idx !== i);
                        let correct_index = newQ.correct_index;
                        if (correct_index === i) {
                          correct_index = 0;
                        } else if (correct_index > i) {
                          correct_index -= 1;
                        }
                        setNewQ({ ...newQ, options: opts, correct_index });
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Minimum 2, maximum 8 options.
                </span>
                {newQ.options.length < 8 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setNewQ({ ...newQ, options: [...newQ.options, ''] })}
                  >
                    Add option
                  </button>
                )}
              </div>

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
                    setNewQ({ text: '', options: ['', ''], correct_index: 0, timer_seconds: 30, test_name: newQ.test_name });
                  }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Current Question Bank ({questions.length})</h3>
            {/* FIX #14: Empty state for questions list */}
            {questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <BookOpen size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No questions yet</p>
                <p style={{ fontSize: '0.9rem' }}>Use the form on the left to add your first question!</p>
              </div>
            ) : (
              questions.map((q, qidx) => (
                <div key={q.id} style={{ padding: '1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', display: 'inline-block', marginBottom: '0.5rem', marginRight: '0.5rem' }}>
                        ⏱️ {q.timer_seconds}s Limit
                      </span>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', display: 'inline-block', marginBottom: '0.5rem' }}>
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
                        fontSize: '0.9rem', padding: '0.5rem', borderRadius: '0.5rem',
                        background: i === q.correct_index ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                        color: i === q.correct_index ? 'var(--success)' : 'var(--text-muted)',
                        border: i === q.correct_index ? '1px solid var(--success)' : '1px solid transparent'
                      }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : tab === 'results' ? (
        /* FIX #14 + #15: Results Tab — filter, CSV export, empty state */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3>Student Performance Report ({results.length} submissions)</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* FIX #15: Filter by test name */}
              <select
                className="input"
                style={{ marginBottom: 0, minWidth: '180px', paddingRight: '2rem' }}
                value={resultFilter}
                onChange={e => setResultFilter(e.target.value)}
              >
                <option value="">All Tests</option>
                {[...new Set(results.map(r => r.test_name).filter(Boolean))].map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {/* FIX #15: CSV Export */}
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const filtered = resultFilter ? results.filter(r => r.test_name === resultFilter) : results;
                  if (filtered.length === 0) { showToast('No data to export.', 'error'); return; }
                  const rows = [['Test Name', 'Student Name', 'Roll No', 'Score', 'Total Questions', 'Percentage', 'Status', 'Date']];
                  filtered.forEach(r => rows.push([
                    r.test_name || 'N/A',
                    r.student_name,
                    r.roll_no,
                    r.score,
                    r.total_questions,
                    `${Math.round((r.score / r.total_questions) * 100)}%`,
                    r.score / r.total_questions >= 0.5 ? 'Pass' : 'Fail',
                    new Date(r.timestamp).toLocaleString()
                  ]));
                  const csvContent = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `results_${resultFilter || 'all'}_${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('CSV exported successfully ✅', 'success');
                }}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.25rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Submissions</p>
              <h2 style={{ margin: 0, fontSize: '2rem' }}>{stats.total_submissions}</h2>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.25rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Average Score</p>
              <h2 style={{ margin: 0, fontSize: '2rem' }}>{stats.average_score_pct}%</h2>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '1rem', padding: '1.25rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Pass Rate</p>
              <h2 style={{ margin: 0, fontSize: '2rem' }}>{stats.pass_rate_pct}%</h2>
            </div>
          </div>

          {stats.tests.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Test-level performance</h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {stats.tests.map(test => (
                  <div key={test.test_name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', padding: '1rem' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>{test.test_name || 'Unnamed Test'}</p>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{test.count} submissions</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '1rem' }}>Avg: {test.avg_percentage}%</p>
                      <p style={{ margin: 0, color: 'var(--success)', fontSize: '0.9rem' }}>{Math.round((test.pass_count / test.count) * 100)}% passed</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FIX #14: Empty state for results */}
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <BarChart2 size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No submissions yet</p>
              <p style={{ fontSize: '0.9rem' }}>Student results will appear here after they complete a quiz.</p>
            </div>
          ) : (() => {
            const filtered = resultFilter ? results.filter(r => r.test_name === resultFilter) : results;
            return filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <p>No results found for test: <strong>{resultFilter}</strong></p>
              </div>
            ) : (
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
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.test_name || 'N/A'}</td>
                      <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                      <td>{r.roll_no}</td>
                      <td style={{ fontSize: '1.1rem', fontWeight: 700 }}>{r.score} / {r.total_questions}</td>
                      <td>{new Date(r.timestamp).toLocaleDateString()}</td>
                      <td>
                        <span style={{
                          background: r.score / r.total_questions >= 0.5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: r.score / r.total_questions >= 0.5 ? '#10b981' : '#ef4444',
                          padding: '0.25rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 600
                        }}>
                          {r.score / r.total_questions >= 0.5 ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      ) : tab === 'monitor' ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3>Live Student Monitor</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {alertsLoading ? 'Refreshing alerts...' : `${alerts.length} recent alert${alerts.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Students who switch tabs during the quiz will generate a notification here. This checks every 10 seconds while you are on the monitor screen.
          </p>
          {alertsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading alerts…</div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Bell size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No alerts yet</p>
              <p style={{ fontSize: '0.9rem' }}>Student tab switch alerts will appear here as they occur.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Test</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id}>
                    <td>{new Date(alert.created_at).toLocaleTimeString()}</td>
                    <td style={{ fontWeight: 600 }}>{alert.student_name}</td>
                    <td>{alert.roll_no}</td>
                    <td>{alert.test_name || 'Unknown'}</td>
                    <td style={{ color: 'var(--error)', fontWeight: 600 }}>{alert.event_type.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {/* Backup Modal */}
      {backupModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setBackupModalOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '640px', width: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>Database Backups</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Trigger a manual backup and review stored backup files.</p>
              </div>
              <button className="btn btn-secondary" onClick={handleBackupNow} disabled={backupLoading}>
                {backupLoading ? 'Backing up...' : 'Backup Now'}
              </button>
            </div>

            {backupLoading && backupFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading backups…</div>
            ) : (
              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {backupFiles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No backups available yet. Create one now.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                        <th>Name</th>
                        <th>Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupFiles.map(file => (
                        <tr key={file.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <td style={{ padding: '0.75rem 0' }}>{file.name}</td>
                          <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{file.path}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
              onClick={() => setBackupModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Share Quiz Modal */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '520px', width: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.5rem' }}>📤 Share Quiz with Students</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Send this link to your students. They will land directly on the Student Portal and can select the test from the dropdown.
            </p>

            {/* URL display box */}
            <div style={{
              display: 'flex', gap: '0.5rem', alignItems: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem'
            }}>
              <span
                id="share-url-text"
                style={{ flex: 1, fontSize: '0.85rem', wordBreak: 'break-all', color: 'var(--primary)', userSelect: 'all' }}
              >
                {studentUrl}
              </span>
              <button
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', flexShrink: 0 }}
                onClick={() => handleCopyLink(studentUrl)}
              >
                <Copy size={16} /> Copy
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              💡 Students will select the <strong>Test Name</strong> and <strong>Teacher</strong> from a dropdown after opening the link.
            </p>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setShowShareModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* FIX #10: Delete Confirmation Modal */}
      {deleteTarget !== null && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <Trash2 size={40} color="var(--error)" style={{ marginBottom: '1rem', marginInline: 'auto' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Delete Question?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              This action cannot be undone. The question will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--error)' }} onClick={confirmDelete}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIX #10: Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem',
          background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
          color: toast.type === 'success' ? 'var(--success)' : 'var(--error)',
          backdropFilter: 'blur(10px)',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          zIndex: 2000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          maxWidth: '380px',
          fontSize: '0.9rem', fontWeight: 500,
          animation: 'slideIn 0.3s ease'
        }}>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
