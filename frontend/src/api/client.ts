import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;

// API functions
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  getMe: () => apiClient.get('/auth/me'),
};

export const studentsApi = {
  getAll: (params?: { search?: string; status?: string; limit?: number; offset?: number }) =>
    apiClient.get('/students', { params }),
  getOne: (id: number) => apiClient.get(`/students/${id}`),
  getTicketSummary: (id: number) => apiClient.get(`/students/${id}/ticket-summary`),
  create: (data: any) => apiClient.post('/students', data),
  update: (id: number, data: any) => apiClient.put(`/students/${id}`, data),
  delete: (id: number) => apiClient.delete(`/students/${id}`),
};

export const instructorsApi = {
  getAll: (params?: { search?: string; limit?: number; offset?: number }) =>
    apiClient.get('/instructors', { params }),
  getOne: (id: number) => apiClient.get(`/instructors/${id}`),
  getStudents: (id: number) => apiClient.get(`/instructors/${id}/students`),
  create: (data: any) => apiClient.post('/instructors', data),
  update: (id: number, data: any) => apiClient.put(`/instructors/${id}`, data),
  delete: (id: number) => apiClient.delete(`/instructors/${id}`),
  createRewardSetting: (id: number, data: any) =>
    apiClient.post(`/instructors/${id}/reward-settings`, data),
};

export const ticketsApi = {
  getTypes: () => apiClient.get('/tickets/types'),
  getType: (id: number) => apiClient.get(`/tickets/types/${id}`),
  createType: (data: any) => apiClient.post('/tickets/types', data),
  updateType: (id: number, data: any) => apiClient.put(`/tickets/types/${id}`, data),
  deleteType: (id: number) => apiClient.delete(`/tickets/types/${id}`),
  issue: (data: { studentIds: number[]; ticketTypeId: number; issuedAt?: string }) =>
    apiClient.post('/tickets/issue', data),
  getStudentTickets: (studentId: number, status?: string) =>
    apiClient.get(`/tickets/student/${studentId}`, { params: { status } }),
  getActiveTickets: (studentId: number) =>
    apiClient.get(`/tickets/student/${studentId}/active`),
  getExpiring: (days?: number) => apiClient.get('/tickets/expiring', { params: { days } }),
  voidTicket: (id: number) => apiClient.put(`/tickets/${id}/void`),
};

export const lessonsApi = {
  getAll: (params?: {
    instructorId?: number;
    studentId?: number;
    dateFrom?: string;
    dateTo?: string;
    isConfirmed?: boolean;
    limit?: number;
    offset?: number;
  }) => apiClient.get('/lessons', { params }),
  getOne: (id: number) => apiClient.get(`/lessons/${id}`),
  consume: (data: {
    studentId: number;
    ticketId: number;
    executedAt?: string;
    lessonType?: string;
    notes?: string;
  }) => apiClient.post('/lessons/consume', data),
  consumeGroup: (data: {
    students: { studentId: number; ticketId: number }[];
    executedAt?: string;
    notes?: string;
  }) => apiClient.post('/lessons/consume-group', data),
  update: (id: number, data: { executedAt?: string; notes?: string }) =>
    apiClient.put(`/lessons/${id}`, data),
  delete: (id: number) => apiClient.delete(`/lessons/${id}`),
};

export const rewardsApi = {
  preview: (yearMonth: string, instructorId?: number) =>
    apiClient.get('/rewards/preview', { params: { yearMonth, instructorId } }),
  close: (yearMonth: string) => apiClient.post('/rewards/close', { yearMonth }),
  getResults: (params?: { yearMonth?: string; instructorId?: number }) =>
    apiClient.get('/rewards/results', { params }),
  getInstructorRewards: (id: number) => apiClient.get(`/rewards/instructor/${id}`),
};

export const csvApi = {
  monthlyLessons: (yearMonth: string) =>
    apiClient.get('/csv/monthly-lessons', {
      params: { yearMonth },
      responseType: 'blob',
    }),
  ticketIssuance: (yearMonth?: string) =>
    apiClient.get('/csv/ticket-issuance', {
      params: yearMonth ? { yearMonth } : undefined,
      responseType: 'blob',
    }),
  ticketBalance: () => apiClient.get('/csv/ticket-balance', { responseType: 'blob' }),
};

export const downloadCsv = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
