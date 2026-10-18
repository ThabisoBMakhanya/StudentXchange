import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sx-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type Category = { id: string; name: string; slug: string; category_type: 'physical' | 'service' };
export type Listing = { id: string; title: string; description: string; price: string; listing_type: 'physical' | 'service'; condition?: string; campus?: string; seller_name: string; category_name: string; created_at: string };
