import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:8000/api`
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// FIX #2: Attach JWT token to every outgoing request automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem('teacher_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const teacherApi = {
  getSetupStatus: () => api.get('/teacher/setup-status'),
  login: (username, password) => api.post('/teacher/login', { username, password }),
  register: (data) => api.post('/teacher/register', data),
  getSecurityQuestion: (username) => api.post('/teacher/get-question', { username }),
  resetPassword: (data) => api.post('/teacher/reset-password', data),
  getQuestions: (teacher_username) => api.get('/questions', { params: { teacher_username } }),
  createQuestion: (data) => api.post('/questions', data),
  updateQuestion: (id, data) => api.put(`/questions/${id}`, data),
  deleteQuestion: (id) => api.delete(`/questions/${id}`),
  getSubmissions: () => api.get('/submissions'), // teacher_username now comes from JWT
  getSubmissionStats: () => api.get('/submissions/stats'),
  createBackup: () => api.post('/admin/backup'),
  listBackups: () => api.get('/admin/backups'),
  getAlerts: () => api.get('/alerts'),
};

export const studentApi = {
  getTests: () => api.get('/tests'),
  getQuestions: (test_name, teacher_username) => api.get('/questions', { params: { test_name, teacher_username } }),
  submitQuiz: (data) => api.post('/submissions', data),
  sendAlert: (data) => api.post('/alerts', data),
};

export default api;
