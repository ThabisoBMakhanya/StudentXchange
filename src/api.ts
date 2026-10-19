import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sx-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  const message = error?.response?.data?.error;
  if (error?.response?.status === 403 && message === 'This account is paused or unavailable.') {
    localStorage.removeItem('sx-token');
    localStorage.removeItem('sx-user');
    if (typeof window !== 'undefined') window.location.assign('/');
  }
  return Promise.reject(error);
});

export type Category = { id: string; name: string; slug: string; category_type: 'physical' | 'service' };
export type Listing = { id: string; title: string; description: string; price: string; stock?: number | null; listing_type: 'physical' | 'service'; condition?: string; images?: string[]; campus?: string; seller_name: string; category_name: string; created_at: string };
