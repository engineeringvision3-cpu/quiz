import React, { useState, useEffect, useRef } from 'react';
import { studentApi } from '../api';
import { ArrowLeft, Send, CheckCircle, GraduationCap, Award } from 'lucide-react';

const shuffleArray = (array) => {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
};

const prepareQuestion = (question) => {
  const optionPairs = question.options.map((opt, index) => ({ opt, originalIndex: index }));
  const shuffledPairs = shuffleArray(optionPairs);
  const newCorrectIndex = shuffledPairs.findIndex(pair => pair.originalIndex === question.correct_index);
  return {
    ...question,
    options: shuffledPairs.map(pair => pair.opt),
    correct_index: newCorrectIndex,
  };
};

const prepareQuizQuestions = (questions) => {
  return shuffleArray(questions.map(q => prepareQuestion(q)));
};

function StudentPortal({ onBack }) {
  const [step, setStep] = useState('login'); // login, quiz, results
  const [studentInfo, setStudentInfo] = useState({ name: '', roll_no: '', test_name: '', teacher_username: '' });
  const [questions, setQuestions] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);
  const [savedSession, setSavedSession] = useState(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await studentApi.getTests();
        setAvailableTests(res.data);
      } catch (err) {
        console.error("Failed to load tests", err);
      }
    };
    fetchTests();

    const saved = localStorage.getItem('quiz_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step === 'quiz' && parsed.questions?.length > 0) {
          setStudentInfo(parsed.studentInfo);
          setQuestions(parsed.questions);
          setCurrentIndex(parsed.currentIndex);
          setAnswers(parsed.answers || {});
          setTimeLeft(parsed.timeLeft ?? 30);
          setTotalTimeLeft(parsed.totalTimeLeft ?? 0);
          setStep('quiz');
          setSavedSession(parsed);
        }
      } catch (error) {
        console.warn('Failed to restore saved quiz state:', error);
        localStorage.removeItem('quiz_progress');
      }
    }
  }, []);

  const saveQuizSession = (session) => {
    try {
      localStorage.setItem('quiz_progress', JSON.stringify(session));
      setSavedSession(session);
    } catch (err) {
      console.warn('Unable to save quiz progress', err);
    }
  };

  const clearQuizSession = () => {
    localStorage.removeItem('quiz_progress');
    setSavedSession(null);
  };

  const resumeSavedQuiz = () => {
    if (!savedSession) return;
    setStudentInfo(savedSession.studentInfo);
    setQuestions(savedSession.questions);
    setCurrentIndex(savedSession.currentIndex);
    setAnswers(savedSession.answers || {});
    setTimeLeft(savedSession.timeLeft ?? 30);
    setTotalTimeLeft(savedSession.totalTimeLeft ?? 0);
    setStep('quiz');
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finalScore, setFinalScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // FIX #7: Guard against double submission
  const hasSubmitted = useRef(false);
  const lastVisibilityAlertTs = useRef(0);

  // Proctoring: alert teacher when student leaves the quiz tab or browser window
  useEffect(() => {
    if (step !== 'quiz') return;

    const handleProctoringEvent = async (eventType) => {
      if (!studentInfo.name || !studentInfo.roll_no || !studentInfo.teacher_username || !studentInfo.test_name) return;

      const now = Date.now();
      // Throttle alerts for the same event type to every 5 seconds
      const lastAlertKey = `last_${eventType}_alert`;
      if (now - (window[lastAlertKey] || 0) < 5000) return;
      window[lastAlertKey] = now;

      try {
        await studentApi.sendAlert({
          student_name: studentInfo.name,
          roll_no: studentInfo.roll_no,
          teacher_username: studentInfo.teacher_username,
          test_name: studentInfo.test_name,
          event_type: eventType
        });
      } catch (err) {
        console.warn(`Failed to send proctoring alert: ${eventType}`, err);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleProctoringEvent('tab_change');
    };

    const onBlur = () => {
      handleProctoringEvent('app_switch');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [step, studentInfo]);

  // FIX #5: Timer Logic — auto-advance uses per-question timer_seconds
  useEffect(() => {
    if (step !== 'quiz' || questions.length === 0) return;

    if (timeLeft === 0) {
      if (currentIndex === questions.length - 1) {
        submitQuiz();
      } else {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        // FIX #5: Use the next question's actual timer value, not a hardcoded 30
        setTimeLeft(questions[nextIdx]?.timer_seconds || 30);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeLeft, currentIndex, questions.length]);

  useEffect(() => {
    if (step !== 'quiz' || questions.length === 0) return;
    if (totalTimeLeft === 0) {
      submitQuiz();
      return;
    }

    const overallTimer = setInterval(() => {
      setTotalTimeLeft(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(overallTimer);
  }, [step, totalTimeLeft, questions.length]);

  useEffect(() => {
    if (step !== 'quiz' || questions.length === 0) return;
    saveQuizSession({
      step: 'quiz',
      studentInfo,
      questions,
      currentIndex,
      answers,
      timeLeft,
      totalTimeLeft,
    });
  }, [step, studentInfo, questions, currentIndex, answers, timeLeft, totalTimeLeft]);

  // Reset timer on question change
  useEffect(() => {
    if (questions[currentIndex]) {
      setTimeLeft(questions[currentIndex].timer_seconds || 30);
    }
  }, [currentIndex, questions]);

  const startQuiz = async (e) => {
    e.preventDefault();
    if (!studentInfo.name || !studentInfo.roll_no || !studentInfo.test_name) return;
    clearQuizSession();
    setLoading(true);
    try {
      const res = await studentApi.getQuestions(studentInfo.test_name, studentInfo.teacher_username);
      const shuffledQuestions = prepareQuizQuestions(res.data);
      setQuestions(shuffledQuestions);
      if (shuffledQuestions.length > 0) {
        setTimeLeft(shuffledQuestions[0].timer_seconds || 30);
        const totalTime = shuffledQuestions.reduce((sum, q) => sum + (Number(q.timer_seconds) || 30), 0);
        setTotalTimeLeft(totalTime);
        setStep('quiz');
      } else {
        alert('No questions available yet. Please ask your teacher to add some.');
      }
    } catch (err) {
      console.error(err);
      alert('Could not load quiz. Is the backend running?');
    }
    setLoading(false);
  };

  const handleAnswer = (optionIndex) => {
    setAnswers({ ...answers, [currentIndex]: optionIndex });
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // FIX #6: prevQuestion removed — students cannot go back (strict exam mode)

  const submitQuiz = async () => {
    // FIX #7: Prevent double submission (timer expiry + manual click race condition)
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;

    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct_index) {
        score++;
      }
    });

    try {
      await studentApi.submitQuiz({
        student_name: studentInfo.name,
        roll_no: studentInfo.roll_no,
        score: score,
        total_questions: questions.length,
        test_name: studentInfo.test_name,
        teacher_username: studentInfo.teacher_username
      });
      clearQuizSession();
      setFinalScore(score);
      setStep('results');
    } catch (err) {
      console.error(err);
      clearQuizSession();
      if (err.response?.status === 409) {
        alert('⚠️ You have already submitted this test. Your previous score has been recorded.');
      } else {
        alert('Failed to submit results. Please take a screenshot of your score!');
      }
      setFinalScore(score);
      setStep('results');
    }
  };

  if (step === 'login') {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '500px', marginTop: '10vh' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '2rem' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="card" style={{ textAlign: 'center' }}>
          <GraduationCap size={48} color="var(--primary)" style={{ marginBottom: '1.5rem', marginInline: 'auto' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Student Identification</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Please enter your real name and roll number for the teacher's record.</p>
          {savedSession && (
            <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '0.75rem', marginBottom: '1rem', textAlign: 'left' }}>
              <strong>Resume saved quiz</strong>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                You have an in-progress quiz for <strong>{savedSession.studentInfo.test_name}</strong> by <strong>{savedSession.studentInfo.teacher_username}</strong>.
              </p>
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={resumeSavedQuiz}>
                Resume Quiz
              </button>
            </div>
          )}
          <form onSubmit={startQuiz}>
            <input 
              className="input" 
              placeholder="Full Name" 
              value={studentInfo.name} 
              onChange={e => setStudentInfo({...studentInfo, name: e.target.value})} 
              required 
            />
            <input 
              className="input" 
              placeholder="Roll Number (e.g. 21CS01)" 
              value={studentInfo.roll_no} 
              onChange={e => setStudentInfo({...studentInfo, roll_no: e.target.value})} 
              required 
            />
            <select 
              className="input" 
              value={studentInfo.test_name && studentInfo.teacher_username ? `${studentInfo.test_name}|${studentInfo.teacher_username}` : ""}
              onChange={e => {
                const [test_name, teacher_username] = e.target.value.split('|');
                setStudentInfo({...studentInfo, test_name, teacher_username});
              }}
              required
              style={{ paddingRight: '2rem' }}
            >
              <option value="" disabled>Select a Test</option>
              {availableTests.map((t, i) => (
                <option key={i} value={`${t.test_name}|${t.teacher_username}`}>
                  {t.test_name} (by {t.teacher_username})
                </option>
              ))}
            </select>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Loading Quiz...' : 'Start Assessment'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'quiz') {
    const q = questions[currentIndex];
    const isLast = currentIndex === questions.length - 1;
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Question {currentIndex + 1} of {questions.length}</span>
            <span style={{ 
              color: timeLeft <= 10 ? 'var(--error)' : 'var(--primary)', 
              fontWeight: 700,
              fontSize: '1.2rem',
              transition: 'all 0.3s ease'
            }}>
              ⏱️ {timeLeft}s
            </span>
            <span style={{ 
              color: totalTimeLeft <= 30 ? 'var(--error)' : 'var(--primary)',
              fontWeight: 700,
              fontSize: '1.2rem',
              transition: 'all 0.3s ease'
            }}>
              Overall ⏳ {formatTime(totalTimeLeft)}
            </span>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{Math.round(progress)}% Complete</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
          </div>
        </header>

        <div className="card">
          <h2 style={{ marginBottom: '2.5rem', lineHeight: 1.4 }}>{q.text}</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {q.options.map((opt, i) => (
              <button 
                key={i} 
                className={`btn ${answers[currentIndex] === i ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ 
                  justifyContent: 'flex-start', 
                  padding: '1.5rem', 
                  fontSize: '1.1rem',
                  border: answers[currentIndex] === i ? '2px solid var(--accent)' : '2px solid transparent'
                }}
                onClick={() => handleAnswer(i)}
              >
                <span style={{ 
                  width: '30px', 
                  height: '30px', 
                  borderRadius: '50%', 
                  background: 'rgba(255,255,255,0.1)', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: '1rem',
                  fontSize: '0.9rem'
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {/* FIX #6: No Previous button — strict exam mode */}
          <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            ⚠️ Once you move to the next question, you cannot go back.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            {isLast ? (
              <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={submitQuiz} disabled={answers[currentIndex] === undefined}>
                <Send size={18} /> Finish Quiz
              </button>
            ) : (
              <button className="btn btn-primary" onClick={nextQuestion} disabled={answers[currentIndex] === undefined}>
                Next Question
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'results') {
    const passed = finalScore / questions.length >= 0.5;
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '600px', textAlign: 'center', marginTop: '5vh' }}>
        <div className="card">
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            {passed ? <Award size={40} color="#10b981" /> : <CheckCircle size={40} color="#ef4444" />}
          </div>
          <h1>Assessment <span style={{ color: passed ? 'var(--success)' : 'var(--error)' }}>Complete</span></h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Great job, {studentInfo.name}!</p>
          
          <div style={{ margin: '3rem 0', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem' }}>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Your Final Score</p>
            <h2 style={{ fontSize: '4rem', fontWeight: 700 }}>{finalScore} <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/ {questions.length}</span></h2>
          </div>

          <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
            Your results have been securely sent to your teacher's dashboard. You may now close this window.
          </p>
          
          <button className="btn btn-secondary" onClick={onBack}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default StudentPortal;
