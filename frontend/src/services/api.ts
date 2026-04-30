import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  changePassword: (data: any) => api.put('/auth/change-password', data),
};

// Appointments
export const appointmentApi = {
  getAll: (params?: any) => api.get('/appointments', { params }),
  getOne: (id: string) => api.get(`/appointments/${id}`),
  create: (data: any) => api.post('/appointments', data),
  update: (id: string, data: any) => api.put(`/appointments/${id}`, data),
  confirm: (id: string) => api.post(`/appointments/${id}/confirm`),
  cancel: (id: string, reason?: string) => api.post(`/appointments/${id}/cancel`, { reason }),
  getSlots: (params: any) => api.get('/appointments/slots', { params }),
  getDashboard: () => api.get('/appointments/dashboard'),
};

// Departments
export const departmentApi = {
  getAll: () => api.get('/departments'),
  getOne: (id: string) => api.get(`/departments/${id}`),
  create: (data: any) => api.post('/departments', data),
  update: (id: string, data: any) => api.put(`/departments/${id}`, data),
  getDoctors: (departmentId: string) => api.get(`/departments/${departmentId}/doctors`),
  getSpecialties: (params?: any) => api.get('/departments/specialties/all', { params }),
  createSpecialty: (data: any) => api.post('/departments/specialties', data),
};

// Patients
export const patientApi = {
  getAll: (params?: any) => api.get('/patients', { params }),
  getOne: (id: string) => api.get(`/patients/${id}`),
  create: (data: any) => api.post('/patients', data),
  update: (id: string, data: any) => api.put(`/patients/${id}`, data),
  getHistory: (id: string) => api.get(`/patients/${id}/history`),
};

// Users
export const userApi = {
  getAll: (params?: any) => api.get('/users', { params }),
  getDoctors: (params?: any) => api.get('/users/doctors', { params }),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Walk-In
export const walkInApi = {
  addToQueue: (data: any) => api.post('/walk-in', data),
  getQueue: (departmentId: string) => api.get(`/walk-in/${departmentId}`),
  callNext: (departmentId: string) => api.post(`/walk-in/${departmentId}/call-next`),
  updateStatus: (id: string, status: string) => api.put(`/walk-in/${id}/status`, { status }),
};

// Reports
export const reportApi = {
  overview: () => api.get('/reports/overview'),
  noShows: (params?: any) => api.get('/reports/no-shows', { params }),
  reminders: (params?: any) => api.get('/reports/reminders', { params }),
};

// Notifications — role-aware feed computed live by the backend.
// The frontend tracks dismissed IDs in localStorage so the user can
// "mark as read" without us needing a notifications collection.
export const notificationApi = {
  list: () => api.get('/notifications'),
};

export default api;