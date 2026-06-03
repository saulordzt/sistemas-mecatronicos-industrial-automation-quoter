import axios from 'axios';

export const api = axios.create({
  baseURL: '/api'
});

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }).then((res) => res.data)
};

export const customersApi = {
  list: () => api.get('/customers').then((res) => res.data),
  get: (id: string) => api.get(`/customers/${id}`).then((res) => res.data),
  create: (data: unknown) => api.post('/customers', data).then((res) => res.data),
  update: (id: string, data: unknown) => api.put(`/customers/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete(`/customers/${id}`)
};

export const projectsApi = {
  list: () => api.get('/projects').then((res) => res.data),
  get: (id: string) => api.get(`/projects/${id}`).then((res) => res.data),
  create: (data: unknown) => api.post('/projects', data).then((res) => res.data),
  update: (id: string, data: unknown) => api.put(`/projects/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete(`/projects/${id}`)
};

export const quotesApi = {
  list: () => api.get('/quotes').then((res) => res.data),
  get: (id: string) => api.get(`/quotes/${id}`).then((res) => res.data),
  create: (data: unknown) => api.post('/quotes', data).then((res) => res.data),
  update: (id: string, data: unknown) => api.put(`/quotes/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete(`/quotes/${id}`),
  duplicate: (id: string) => api.post(`/quotes/${id}/duplicate`).then((res) => res.data),
  family: (id: string) => api.get(`/quotes/${id}/family`).then((res) => res.data),
  revise: (id: string) => api.post(`/quotes/${id}/revise`).then((res) => res.data),
  createVariant: (id: string, data: unknown) => api.post(`/quotes/${id}/variant`, data).then((res) => res.data)
};

export const serviceRatesApi = {
  list: () => api.get('/service-rates').then((res) => res.data),
  create: (data: unknown) => api.post('/service-rates', data).then((res) => res.data),
  update: (id: string, data: unknown) => api.put(`/service-rates/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete(`/service-rates/${id}`)
};

export const dashboardApi = {
  get: () => api.get('/dashboard').then((res) => res.data)
};


export const productsApi = {
  list: (params = {}) => api.get('/products', { params }).then((res) => res.data),
  providers: () => api.get('/products/providers').then((res) => res.data),
  categories: (supplier: string) => api.get('/products/categories', { params: { supplier } }).then((res) => res.data),
  get: (id: string) => api.get(`/products/${id}`).then((res) => res.data),
  create: (data: unknown) => api.post('/products', data).then((res) => res.data),
  update: (id: string, data: unknown) => api.put(`/products/${id}`, data).then((res) => res.data),
  remove: (id: string) => api.delete(`/products/${id}`),
  refreshAutomationDirect: (id: string) => api.post(`/products/${id}/refresh-automationdirect`).then((res) => res.data),
  importXlsx: (file: File) => {
    const data = new FormData();
    data.append('file', file);
    return api.post('/products/import-xlsx', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  }
};


export const publicQuotesApi = {
  get: (id: string) => api.get('/public/quotes/' + id).then((res) => res.data),
  trackPdfDownload: (id: string) => api.post('/public/quotes/' + id + '/pdf-download').then((res) => res.data)
};

export const aiApi = {
  generateQuoteAssistantPreview: (data: unknown) => api.post('/ai/quote-assistant-preview', data).then((res) => res.data)
};
