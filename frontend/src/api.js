import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? `http://${window.location.hostname}:8000/api` 
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const teacherApi = {
  getSetupStatus: () => api.get('/teacher/setup-status'),
  login: (username, password) => api.post('/teacher/login', { username, password }),
  register: (data) => api.post('/teacher/register', data),
  getSecurityQuestion: (username) => api.post('/teacher/get-question', { username }),
  resetPassword: (data) => api.post('/teacher/reset-password', data),
  getQuestions: () => api.get('/questions'),
  createQuestion: (data) => api.post('/questions', data),
  updateQuestion: (id, data) => api.put(`/questions/${id}`, data),
  deleteQuestion: (id) => api.delete(`/questions/${id}`),
  getSubmissions: () => api.get('/submissions'),
};

export const studentApi = {
  getQuestions: () => api.get('/questions'),
  submitQuiz: (data) => api.post('/submissions', data),
};

export default api;
