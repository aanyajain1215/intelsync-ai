import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 180000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('intelsync_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('intelsync_token');
      localStorage.removeItem('intelsync_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
